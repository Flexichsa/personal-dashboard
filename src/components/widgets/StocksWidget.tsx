import { useState, useEffect, useCallback } from 'react';
import { BarChart2, RefreshCw, Plus, X, AlertCircle, Clock, Loader } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { useLocalStorage } from '../../hooks/useLocalStorage';

interface StockData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  date: string;
  history: number[]; // letzte Schlusskurse für Sparkline
}

interface StockCache {
  [symbol: string]: { data: StockData; fetchedAt: number };
}

const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'SAP.DE'];
const CACHE_KEY = 'stocks-cache-v2';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 Stunde

function loadStocksCache(): StockCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StockCache;
  } catch { return {}; }
}

function saveStocksCache(cache: StockCache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* quota */ }
}

// ── Symbol-Hilfsfunktionen ────────────────────────────────────────────────────

function toStooqSymbol(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s.includes('.')) return s;
  return s + '.US';
}

function currencyFromSymbol(stooqSym: string): string {
  if (stooqSym.endsWith('.DE') || stooqSym.endsWith('.AT') || stooqSym.endsWith('.PA')) return 'EUR';
  if (stooqSym.endsWith('.SW') || stooqSym.endsWith('.VX')) return 'CHF';
  if (stooqSym.endsWith('.L') || stooqSym.endsWith('.UK')) return 'GBP';
  return 'USD';
}

function parseStooqCSV(csv: string, symbol: string, stooqSym: string): StockData | null {
  const lines = csv
    .trim()
    .split('\n')
    .filter(l => l && !l.toLowerCase().startsWith('date') && !l.toLowerCase().includes('no data'));
  if (lines.length < 1) return null;

  const allPrices: number[] = [];
  for (const line of lines) {
    const parts = line.split(',');
    const close = parseFloat(parts[4]);
    if (!isNaN(close) && close > 0) allPrices.push(close);
  }
  if (allPrices.length === 0) return null;

  const lastRow = lines[lines.length - 1].split(',');
  const prevRow = lines.length >= 2 ? lines[lines.length - 2].split(',') : null;

  const price = parseFloat(lastRow[4]);
  const prevClose = prevRow ? parseFloat(prevRow[4]) : parseFloat(lastRow[1]);
  const dateStr = lastRow[0]?.trim() || '';

  if (isNaN(price) || price === 0) return null;

  const change = price - prevClose;
  const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

  // Letzte 7 Schlusskurse für Sparkline
  const history = allPrices.slice(-7);

  // Datum formatieren
  let date = '';
  if (dateStr.length === 8) {
    date = `${dateStr.slice(6, 8)}.${dateStr.slice(4, 6)}.${dateStr.slice(0, 4)}`;
  } else {
    date = dateStr;
  }

  return {
    symbol,
    price,
    change,
    changePercent,
    currency: currencyFromSymbol(stooqSym),
    date,
    history,
  };
}

// ── Fetch mit mehreren Proxy-Fallbacks ────────────────────────────────────────

const PROXIES = [
  (url: string) => url,                                           // Direktversuch
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

async function fetchStock(symbol: string): Promise<StockData | null> {
  const stooqSym = toStooqSymbol(symbol);
  const d2 = new Date();
  const d1 = new Date(d2.getTime() - 21 * 24 * 60 * 60 * 1000); // 21 Tage
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const stooqUrl = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSym)}&d1=${fmt(d1)}&d2=${fmt(d2)}&i=d`;

  for (const makeUrl of PROXIES) {
    try {
      const res = await fetch(makeUrl(stooqUrl), { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const text = await res.text();
      const result = parseStooqCSV(text, symbol, stooqSym);
      if (result) return result;
    } catch { continue; }
  }
  return null;
}

// ── Sparkline-Minibar ─────────────────────────────────────────────────────────

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 48;
  const h = 18;
  const step = w / (values.length - 1);

  const points = values
    .map((v, i) => `${i * step},${h - ((v - min) / range) * h}`)
    .join(' ');

  return (
    <svg width={w} height={h} className="stocks-sparkline" viewBox={`0 0 ${w} ${h}`}>
      <polyline
        points={points}
        fill="none"
        stroke={positive ? 'var(--success)' : 'var(--danger)'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function StockSkeletonRow() {
  return (
    <div className="stocks-row stocks-skeleton-row">
      <div className="stocks-symbol-block">
        <div className="crypto-skeleton crypto-skeleton-sm" style={{ width: 48 }} />
      </div>
      <div className="crypto-skeleton" style={{ width: 48, height: 18, borderRadius: 4 }} />
      <div className="stocks-price-block">
        <div className="crypto-skeleton crypto-skeleton-sm" style={{ width: 64 }} />
        <div className="crypto-skeleton crypto-skeleton-sm" style={{ width: 44, marginTop: 3 }} />
      </div>
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function StocksWidget() {
  const [symbols, setSymbols] = useLocalStorage<string[]>('stocks-symbols', DEFAULT_SYMBOLS);
  const [data, setData] = useState<Record<string, StockData>>({});
  const [loadingSet, setLoadingSet] = useState<Set<string>>(new Set());
  const [fetchError, setFetchError] = useState(false);
  const [fromCacheSet, setFromCacheSet] = useState<Set<string>>(new Set());
  const [newSymbol, setNewSymbol] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchAll = useCallback(async () => {
    if (symbols.length === 0) return;

    const cache = loadStocksCache();
    const now = Date.now();

    // Markiere alle als "lädt"
    setLoadingSet(new Set(symbols));
    setFetchError(false);

    let anySuccess = false;
    const newData: Record<string, StockData> = {};
    const newFromCache = new Set<string>();

    await Promise.all(
      symbols.map(async sym => {
        const cached = cache[sym];

        // Frischer Cache vorhanden?
        if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
          newData[sym] = cached.data;
          newFromCache.add(sym);
          anySuccess = true;
          setLoadingSet(prev => {
            const next = new Set(prev);
            next.delete(sym);
            return next;
          });
          return;
        }

        // Frisch laden
        const result = await fetchStock(sym);
        if (result) {
          newData[sym] = result;
          cache[sym] = { data: result, fetchedAt: now };
          anySuccess = true;
        } else if (cached) {
          // Veralteter Cache als Fallback
          newData[sym] = cached.data;
          newFromCache.add(sym);
          anySuccess = true;
        }

        setLoadingSet(prev => {
          const next = new Set(prev);
          next.delete(sym);
          return next;
        });
      })
    );

    saveStocksCache(cache);
    if (!anySuccess && symbols.length > 0) setFetchError(true);
    setData(newData);
    setFromCacheSet(newFromCache);
    setLastUpdated(
      new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    );
  }, [symbols]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const addSymbol = () => {
    const sym = newSymbol.trim().toUpperCase();
    if (sym && !symbols.includes(sym)) setSymbols([...symbols, sym]);
    setNewSymbol('');
    setShowAdd(false);
  };

  const removeSymbol = (sym: string) => {
    setSymbols(symbols.filter(s => s !== sym));
    setData(prev => { const next = { ...prev }; delete next[sym]; return next; });
  };

  const fmtPrice = (price: number, currency: string) => {
    const prefix =
      currency === 'EUR' ? '€' :
      currency === 'USD' ? '$' :
      currency === 'CHF' ? 'CHF ' :
      (currency ? currency + ' ' : '');
    return `${prefix}${price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const globalLoading = loadingSet.size > 0;

  return (
    <WidgetWrapper widgetId="stocks" title="Aktien" icon={<BarChart2 size={16} />}>
      <div className="stocks-widget">

        {/* Toolbar */}
        <div className="stocks-toolbar">
          <span className="stocks-source">Stooq</span>
          <div className="crypto-toolbar-right">
            {lastUpdated && (
              <span className="crypto-timestamp" title="Letzte Aktualisierung">
                {fromCacheSet.size > 0 && (
                  <Clock size={9} style={{ marginRight: 2, verticalAlign: 'middle' }} />
                )}
                {lastUpdated}
              </span>
            )}
            <button
              className="btn-icon"
              onClick={fetchAll}
              disabled={globalLoading}
              title="Aktualisieren"
            >
              <RefreshCw size={13} className={globalLoading ? 'spin' : ''} />
            </button>
            <button className="btn-icon" onClick={() => setShowAdd(v => !v)} title="Symbol hinzufügen">
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/* Symbol hinzufügen */}
        {showAdd && (
          <div className="crypto-add-row">
            <input
              placeholder="AAPL · MSFT · SAP.DE · NESN.SW"
              value={newSymbol}
              onChange={e => setNewSymbol(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') addSymbol();
                if (e.key === 'Escape') { setShowAdd(false); setNewSymbol(''); }
              }}
              autoFocus
            />
            <button className="btn-primary" style={{ padding: '6px 14px', flexShrink: 0 }} onClick={addSymbol}>+</button>
          </div>
        )}

        {/* Fehler */}
        {fetchError && (
          <div className="stocks-cors-note">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={12} />
              <span>Kurse nicht verfügbar – alle Quellen nicht erreichbar</span>
            </div>
            <button
              className="btn-primary"
              style={{ marginTop: 6, padding: '4px 10px', fontSize: 11 }}
              onClick={fetchAll}
              disabled={globalLoading}
            >
              Erneut versuchen
            </button>
          </div>
        )}

        {/* Liste */}
        <div className="stocks-list">
          {symbols.map(sym => {
            const d = data[sym];
            const isLoading = loadingSet.has(sym);
            const isCached = fromCacheSet.has(sym);

            if (isLoading && !d) return <StockSkeletonRow key={sym} />;

            return (
              <div key={sym} className={`stocks-row ${isCached ? 'stocks-row-cached' : ''}`}>

                {/* Symbol + Datum */}
                <div className="stocks-symbol-block">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isLoading && <Loader size={10} className="spin" style={{ color: 'var(--text-muted)' }} />}
                    <span className="stocks-symbol">{sym}</span>
                    {isCached && (
                      <span className="stocks-cache-badge" title="Gecachte Daten">
                        <Clock size={8} />
                      </span>
                    )}
                  </div>
                  {d?.date && (
                    <span className="stocks-date">Daten vom {d.date}</span>
                  )}
                </div>

                {/* Sparkline */}
                {d && d.history.length >= 2 && (
                  <Sparkline values={d.history} positive={d.changePercent >= 0} />
                )}

                {/* Preis */}
                <div className="stocks-price-block">
                  {d ? (
                    <>
                      <span className="stocks-price">{fmtPrice(d.price, d.currency)}</span>
                      <span className={`crypto-change ${d.changePercent >= 0 ? 'up' : 'down'}`}>
                        {d.changePercent >= 0 ? '▲' : '▼'} {Math.abs(d.changePercent).toFixed(2)}%
                      </span>
                    </>
                  ) : (
                    <span className="stocks-no-data">{isLoading ? '…' : '–'}</span>
                  )}
                </div>

                <button
                  className="btn-icon-sm delete-btn crypto-remove"
                  onClick={() => removeSymbol(sym)}
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </WidgetWrapper>
  );
}

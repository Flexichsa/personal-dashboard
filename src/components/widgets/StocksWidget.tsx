import { useState, useEffect, useCallback } from 'react';
import { BarChart2, RefreshCw, Plus, X } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { useLocalStorage } from '../../hooks/useLocalStorage';

interface StockData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
}

const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'SAP.DE'];

// AAPL → AAPL.US (US-Börse als Default); SAP.DE bleibt SAP.DE
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
  // CSV-Format: Date,Open,High,Low,Close,Volume
  const lines = csv.trim().split('\n').filter(l => l && !l.startsWith('Date') && !l.startsWith('No data'));
  if (lines.length < 1) return null;

  // Letzte Zeile = aktuellster Handelstag
  const lastRow = lines[lines.length - 1].split(',');
  const prevRow = lines.length >= 2 ? lines[lines.length - 2].split(',') : null;

  const price = parseFloat(lastRow[4]);   // Close
  const prevClose = prevRow ? parseFloat(prevRow[4]) : parseFloat(lastRow[1]); // Vortages-Close oder Open

  if (isNaN(price) || price === 0) return null;

  const change = price - prevClose;
  const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

  return { symbol, price, change, changePercent, currency: currencyFromSymbol(stooqSym) };
}

async function fetchStock(symbol: string): Promise<StockData | null> {
  const stooqSym = toStooqSymbol(symbol);

  // Letzten 14 Tage → sicher 2+ Handelstage abgedeckt
  const d2 = new Date();
  const d1 = new Date(d2.getTime() - 14 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const stooqUrl = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSym)}&d1=${fmt(d1)}&d2=${fmt(d2)}&i=d`;

  // Direktversuch (Stooq erlaubt häufig Cross-Origin)
  try {
    const res = await fetch(stooqUrl, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const text = await res.text();
      const result = parseStooqCSV(text, symbol, stooqSym);
      if (result) return result;
    }
  } catch { /* CORS oder Timeout → Proxy */ }

  // CORS-Proxy-Fallback
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(stooqUrl)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const text = await res.text();
    return parseStooqCSV(text, symbol, stooqSym);
  } catch {
    return null;
  }
}

export default function StocksWidget() {
  const [symbols, setSymbols] = useLocalStorage<string[]>('stocks-symbols', DEFAULT_SYMBOLS);
  const [data, setData] = useState<Record<string, StockData>>({});
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchAll = useCallback(async () => {
    if (symbols.length === 0) return;
    setLoading(true);
    setFetchError(false);
    const results: Record<string, StockData> = {};
    let anySuccess = false;

    await Promise.all(
      symbols.map(async sym => {
        const d = await fetchStock(sym);
        if (d) { results[sym] = d; anySuccess = true; }
      })
    );

    if (!anySuccess && symbols.length > 0) setFetchError(true);

    setData(results);
    setLastUpdated(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    setLoading(false);
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
    const prefix = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'CHF' ? 'CHF ' : (currency ? currency + ' ' : '');
    return `${prefix}${price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <WidgetWrapper widgetId="stocks" title="Aktien" icon={<BarChart2 size={16} />}>
      <div className="stocks-widget">
        <div className="stocks-toolbar">
          <span className="stocks-source">Stooq</span>
          <div className="crypto-toolbar-right">
            {lastUpdated && <span className="crypto-timestamp">{lastUpdated}</span>}
            <button className="btn-icon" onClick={fetchAll} disabled={loading} title="Aktualisieren">
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
            </button>
            <button className="btn-icon" onClick={() => setShowAdd(v => !v)} title="Symbol hinzufügen">
              <Plus size={13} />
            </button>
          </div>
        </div>

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

        {fetchError && (
          <div className="stocks-cors-note">
            <span>⚠ Kurse nicht verfügbar</span>
            <span>Stooq ist gerade nicht erreichbar. Bitte in einigen Minuten erneut versuchen.</span>
          </div>
        )}

        <div className="stocks-list">
          {loading && Object.keys(data).length === 0 && (
            <div className="crypto-loading">Lade Kurse…</div>
          )}
          {symbols.map(sym => {
            const d = data[sym];
            return (
              <div key={sym} className="stocks-row">
                <div className="stocks-symbol-block">
                  <span className="stocks-symbol">{sym}</span>
                </div>
                <div className="stocks-price-block">
                  {d ? (
                    <>
                      <span className="stocks-price">{fmtPrice(d.price, d.currency)}</span>
                      <span className={`crypto-change ${d.changePercent >= 0 ? 'up' : 'down'}`}>
                        {d.changePercent >= 0 ? '▲' : '▼'} {Math.abs(d.changePercent).toFixed(2)}%
                      </span>
                    </>
                  ) : (
                    <span className="stocks-no-data">{loading ? '…' : '–'}</span>
                  )}
                </div>
                <button className="btn-icon-sm delete-btn crypto-remove" onClick={() => removeSymbol(sym)}>
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

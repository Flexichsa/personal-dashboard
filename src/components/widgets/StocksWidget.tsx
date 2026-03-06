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

async function fetchStock(symbol: string): Promise<StockData | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price: number = meta.regularMarketPrice ?? 0;
    const prev: number = meta.previousClose ?? meta.chartPreviousClose ?? price;
    const change = price - prev;
    const changePercent = prev !== 0 ? (change / prev) * 100 : 0;
    return { symbol, price, change, changePercent, currency: meta.currency ?? '' };
  } catch {
    return null;
  }
}

export default function StocksWidget() {
  const [symbols, setSymbols] = useLocalStorage<string[]>('stocks-symbols', DEFAULT_SYMBOLS);
  const [data, setData] = useState<Record<string, StockData>>({});
  const [loading, setLoading] = useState(false);
  const [corsError, setCorsError] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchAll = useCallback(async () => {
    if (symbols.length === 0) return;
    setLoading(true);
    setCorsError(false);
    const results: Record<string, StockData> = {};
    let anySuccess = false;

    await Promise.all(
      symbols.map(async sym => {
        const d = await fetchStock(sym);
        if (d) { results[sym] = d; anySuccess = true; }
      })
    );

    if (!anySuccess && symbols.length > 0) setCorsError(true);

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
    const prefix = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : (currency ? currency + ' ' : '');
    return `${prefix}${price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <WidgetWrapper widgetId="stocks" title="Aktien" icon={<BarChart2 size={16} />}>
      <div className="stocks-widget">
        <div className="stocks-toolbar">
          <span className="stocks-source">Yahoo Finance</span>
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
              placeholder="Symbol (z.B. AAPL, SAP.DE, BTC-EUR)"
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

        {corsError && (
          <div className="stocks-cors-note">
            <span>⚠ Kurse nicht verfügbar</span>
            <span>Yahoo Finance blockiert direkte Browser-Anfragen (CORS). Verwende eine Browser-Extension wie „CORS Everywhere" oder öffne die App lokal.</span>
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
                    <span className="stocks-no-data">–</span>
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

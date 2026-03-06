import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, RefreshCw, Plus, X } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { useLocalStorage } from '../../hooks/useLocalStorage';

interface CoinData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  image: string;
}

const DEFAULT_COINS = ['bitcoin', 'ethereum', 'solana', 'ripple'];

export default function CryptoWidget() {
  const [coins, setCoins] = useLocalStorage<string[]>('crypto-coins', DEFAULT_COINS);
  const [currency, setCurrency] = useLocalStorage<'eur' | 'usd'>('crypto-currency', 'eur');
  const [data, setData] = useState<CoinData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCoin, setNewCoin] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchData = useCallback(async () => {
    if (coins.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const ids = coins.join(',');
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}&ids=${ids}&order=market_cap_desc&per_page=20&page=1&sparkline=false`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: CoinData[] = await res.json();
      const ordered = coins.map(id => json.find(c => c.id === id)).filter(Boolean) as CoinData[];
      setData(ordered);
      setLastUpdated(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      setError('Kurse nicht verfügbar – Rate-Limit oder Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  }, [coins, currency]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const addCoin = () => {
    const id = newCoin.trim().toLowerCase().replace(/\s+/g, '-');
    if (id && !coins.includes(id)) setCoins([...coins, id]);
    setNewCoin('');
    setShowAdd(false);
  };

  const removeCoin = (id: string) => {
    setCoins(coins.filter(c => c !== id));
    setData(prev => prev.filter(d => d.id !== id));
  };

  const sym = currency === 'eur' ? '€' : '$';

  const fmt = (price: number) => {
    if (price >= 10000) return price.toLocaleString('de-DE', { maximumFractionDigits: 0 });
    if (price >= 1) return price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return price.toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  };

  return (
    <WidgetWrapper widgetId="crypto" title="Krypto" icon={<TrendingUp size={16} />}>
      <div className="crypto-widget">
        <div className="crypto-toolbar">
          <div className="crypto-currency-toggle">
            <button className={currency === 'eur' ? 'active' : ''} onClick={() => setCurrency('eur')}>EUR</button>
            <button className={currency === 'usd' ? 'active' : ''} onClick={() => setCurrency('usd')}>USD</button>
          </div>
          <div className="crypto-toolbar-right">
            {lastUpdated && <span className="crypto-timestamp">{lastUpdated}</span>}
            <button className="btn-icon" onClick={fetchData} disabled={loading} title="Aktualisieren">
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
            </button>
            <button className="btn-icon" onClick={() => setShowAdd(v => !v)} title="Coin hinzufügen">
              <Plus size={13} />
            </button>
          </div>
        </div>

        {showAdd && (
          <div className="crypto-add-row">
            <input
              placeholder="Coin-ID (z.B. bitcoin, solana)"
              value={newCoin}
              onChange={e => setNewCoin(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') addCoin();
                if (e.key === 'Escape') { setShowAdd(false); setNewCoin(''); }
              }}
              autoFocus
            />
            <button className="btn-primary" style={{ padding: '6px 14px', flexShrink: 0 }} onClick={addCoin}>+</button>
          </div>
        )}

        {error && <div className="crypto-error">{error}</div>}

        <div className="crypto-list">
          {loading && data.length === 0 && (
            <div className="crypto-loading">Lade Kurse…</div>
          )}
          {data.map(coin => (
            <div key={coin.id} className="crypto-row">
              <img src={coin.image} alt={coin.symbol} className="crypto-icon" />
              <div className="crypto-info">
                <span className="crypto-symbol">{coin.symbol.toUpperCase()}</span>
                <span className="crypto-name">{coin.name}</span>
              </div>
              <div className="crypto-price-block">
                <span className="crypto-price">{sym}{fmt(coin.current_price)}</span>
                <span className={`crypto-change ${coin.price_change_percentage_24h >= 0 ? 'up' : 'down'}`}>
                  {coin.price_change_percentage_24h >= 0 ? '▲' : '▼'} {Math.abs(coin.price_change_percentage_24h).toFixed(2)}%
                </span>
              </div>
              <button className="btn-icon-sm delete-btn crypto-remove" onClick={() => removeCoin(coin.id)}>
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </WidgetWrapper>
  );
}

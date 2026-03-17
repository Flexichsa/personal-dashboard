import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, RefreshCw, Plus, X, AlertCircle, Clock } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { useLocalStorage } from '../../hooks/useLocalStorage';

interface CoinData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  image: string;
}

const DEFAULT_COINS = ['bitcoin', 'ethereum', 'solana', 'ripple'];

// Ticker-Symbol → CoinGecko-ID Mapping (damit User "VET" statt "vechain" eingeben kann)
const COIN_SYMBOL_MAP: Record<string, string> = {
  'btc': 'bitcoin', 'eth': 'ethereum', 'sol': 'solana', 'xrp': 'ripple',
  'vet': 'vechain', 'ada': 'cardano', 'dot': 'polkadot', 'bnb': 'binancecoin',
  'doge': 'dogecoin', 'shib': 'shiba-inu', 'avax': 'avalanche-2', 'link': 'chainlink',
  'ltc': 'litecoin', 'matic': 'matic-network', 'pol': 'matic-network',
  'uni': 'uniswap', 'atom': 'cosmos', 'trx': 'tron', 'xlm': 'stellar',
  'etc': 'ethereum-classic', 'fil': 'filecoin', 'near': 'near',
  'icp': 'internet-computer', 'hbar': 'hedera-hashgraph', 'apt': 'aptos',
  'sui': 'sui', 'op': 'optimism', 'arb': 'arbitrum', 'pepe': 'pepe',
  'floki': 'floki', 'bonk': 'bonk', 'ton': 'the-open-network',
};

const CACHE_KEY = 'crypto-cache';
const CACHE_TTL_MS = 10 * 60 * 1000 as number; // 10 Minuten — wird in isCacheValid genutzt
void CACHE_TTL_MS; // temporär: TTL-Validierung wird noch implementiert

interface CachedData {
  data: CoinData[];
  timestamp: number;
  currency: string;
}

function loadCache(): CachedData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedData;
  } catch {
    return null;
  }
}

function saveCache(data: CoinData[], currency: string) {
  try {
    const payload: CachedData = { data, timestamp: Date.now(), currency };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch { /* quota */ }
}

async function fetchWithRetry(
  url: string,
  retries = 3,
  baseDelay = 2000
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (res.status === 429 && attempt < retries) {
        // Rate limit: exponential backoff
        await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)));
    }
  }
  throw new Error('Max retries exceeded');
}

function fmtMarketCap(value: number): string {
  if (value >= 1e12) return (value / 1e12).toFixed(2) + ' Bio';
  if (value >= 1e9) return (value / 1e9).toFixed(1) + ' Mrd';
  if (value >= 1e6) return (value / 1e6).toFixed(0) + ' Mio';
  return value.toLocaleString('de-DE');
}

function fmtVolume(value: number): string {
  if (value >= 1e9) return (value / 1e9).toFixed(1) + ' Mrd';
  if (value >= 1e6) return (value / 1e6).toFixed(0) + ' Mio';
  return value.toLocaleString('de-DE');
}

// Skeleton-Zeile
function SkeletonRow() {
  return (
    <div className="crypto-row crypto-skeleton-row">
      <div className="crypto-skeleton crypto-skeleton-icon" />
      <div className="crypto-info">
        <div className="crypto-skeleton crypto-skeleton-sm" style={{ width: 40 }} />
        <div className="crypto-skeleton crypto-skeleton-sm" style={{ width: 60, marginTop: 3 }} />
      </div>
      <div className="crypto-price-block">
        <div className="crypto-skeleton crypto-skeleton-sm" style={{ width: 70 }} />
        <div className="crypto-skeleton crypto-skeleton-sm" style={{ width: 45, marginTop: 3 }} />
      </div>
    </div>
  );
}

export default function CryptoWidget() {
  const [coins, setCoins] = useLocalStorage<string[]>('crypto-coins', DEFAULT_COINS);
  const [currency, setCurrency] = useLocalStorage<'eur' | 'usd'>('crypto-currency', 'eur');
  const [data, setData] = useState<CoinData[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCoin, setNewCoin] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [retrying, setRetrying] = useState(false);

  const fetchData = useCallback(async (isRetry = false) => {
    if (coins.length === 0) return;
    if (isRetry) setRetrying(true);
    setLoading(true);
    setError(null);
    setFromCache(false);

    try {
      // Ticker-Symbole (z.B. "vet") → CoinGecko-IDs (z.B. "vechain") auflösen
      const resolvedIds = coins.map(id => COIN_SYMBOL_MAP[id] || id);
      const ids = resolvedIds.join(',');
      const url =
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}` +
        `&ids=${ids}&order=market_cap_desc&per_page=20&page=1&sparkline=false`;

      const res = await fetchWithRetry(url, 3, 1500);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json: CoinData[] = await res.json();
      if (!Array.isArray(json)) throw new Error('Ungültige API-Antwort');

      const ordered = coins
        .map(id => {
          const resolvedId = COIN_SYMBOL_MAP[id] || id;
          return json.find(c => c.id === resolvedId);
        })
        .filter(Boolean) as CoinData[];
      setData(ordered);
      saveCache(ordered, currency);
      setLastUpdated(
        new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      );
    } catch {
      // Versuche Cache zu laden
      const cached = loadCache();
      if (cached && cached.currency === currency) {
        const ageMin = Math.round((Date.now() - cached.timestamp) / 60000);
        setData(cached.data);
        setFromCache(true);
        setLastUpdated(
          new Date(cached.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
        );
        setError(`Gecachte Daten (vor ${ageMin} Min.) – API nicht erreichbar`);
      } else {
        setError('Kurse nicht verfügbar – Rate-Limit oder Netzwerkfehler');
      }
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, [coins, currency]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const addCoin = () => {
    const input = newCoin.trim().toLowerCase().replace(/\s+/g, '-');
    // Ticker-Symbol zu CoinGecko-ID auflösen (z.B. "vet" → "vechain")
    const id = COIN_SYMBOL_MAP[input] || input;
    if (id && !coins.includes(id)) setCoins([...coins, id]);
    setNewCoin('');
    setShowAdd(false);
  };

  const removeCoin = (id: string) => {
    setCoins(coins.filter(c => c !== id));
    setData(prev => prev.filter(d => d.id !== id));
  };

  const sym = currency === 'eur' ? '€' : '$';

  const fmtPrice = (price: number) => {
    if (price >= 10000) return price.toLocaleString('de-DE', { maximumFractionDigits: 0 });
    if (price >= 1) return price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return price.toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  };

  return (
    <WidgetWrapper widgetId="crypto" title="Krypto" icon={<TrendingUp size={16} />}>
      <div className="crypto-widget">

        {/* Toolbar */}
        <div className="crypto-toolbar">
          <div className="crypto-currency-toggle">
            <button className={currency === 'eur' ? 'active' : ''} onClick={() => setCurrency('eur')}>EUR</button>
            <button className={currency === 'usd' ? 'active' : ''} onClick={() => setCurrency('usd')}>USD</button>
          </div>
          <div className="crypto-toolbar-right">
            {lastUpdated && (
              <span className="crypto-timestamp" title={fromCache ? 'Gecachte Daten' : 'Letzte Aktualisierung'}>
                {fromCache && <Clock size={9} style={{ marginRight: 2, verticalAlign: 'middle' }} />}
                {lastUpdated}
              </span>
            )}
            <button
              className="btn-icon"
              onClick={() => fetchData(true)}
              disabled={loading}
              title="Aktualisieren"
            >
              <RefreshCw size={13} className={(loading || retrying) ? 'spin' : ''} />
            </button>
            <button className="btn-icon" onClick={() => setShowAdd(v => !v)} title="Coin hinzufügen">
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/* Coin hinzufügen */}
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

        {/* Fehler / Cache-Hinweis */}
        {error && (
          <div className={`crypto-error ${fromCache ? 'crypto-error-cache' : ''}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={12} />
              <span>{error}</span>
            </div>
            {!fromCache && (
              <button
                className="btn-primary"
                style={{ marginTop: 6, padding: '4px 10px', fontSize: 11 }}
                onClick={() => fetchData(true)}
                disabled={loading}
              >
                {loading ? 'Lade…' : 'Erneut versuchen'}
              </button>
            )}
          </div>
        )}

        {/* Liste */}
        <div className="crypto-list">
          {loading && data.length === 0
            ? coins.map(id => <SkeletonRow key={id} />)
            : coins.map(coinId => {
                const resolvedId = COIN_SYMBOL_MAP[coinId] || coinId;
                const coin = data.find(c => c.id === resolvedId);
                const isLoading = loading && !coin;
                if (isLoading) return <SkeletonRow key={coinId} />;
                return (
                  <div key={coinId} className="crypto-row">
                    {coin ? (
                      <img src={coin.image} alt={coin.symbol} className="crypto-icon" />
                    ) : (
                      <div className="crypto-icon-placeholder" />
                    )}

                    <div className="crypto-info">
                      <span className="crypto-symbol">
                        {coin ? coin.symbol.toUpperCase() : coinId.toUpperCase()}
                      </span>
                      <span className="crypto-name">
                        {coin ? coin.name : '–'}
                      </span>
                    </div>

                    <div className="crypto-price-block">
                      {coin ? (
                        <>
                          <span className="crypto-price">{sym}{fmtPrice(coin.current_price)}</span>
                          <span className={`crypto-change ${coin.price_change_percentage_24h >= 0 ? 'up' : 'down'}`}>
                            {coin.price_change_percentage_24h >= 0 ? '▲' : '▼'}{' '}
                            {Math.abs(coin.price_change_percentage_24h).toFixed(2)}%
                          </span>
                        </>
                      ) : (
                        <span className="crypto-price" style={{ color: 'var(--text-muted)' }}>–</span>
                      )}
                    </div>

                    {/* Marktdaten */}
                    {coin && (
                      <div className="crypto-market-data">
                        <span className="crypto-market-label">MCap</span>
                        <span className="crypto-market-value">{sym}{fmtMarketCap(coin.market_cap)}</span>
                        <span className="crypto-market-label">Vol</span>
                        <span className="crypto-market-value">{sym}{fmtVolume(coin.total_volume)}</span>
                      </div>
                    )}

                    <button
                      className="btn-icon-sm delete-btn crypto-remove"
                      onClick={() => removeCoin(coinId)}
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

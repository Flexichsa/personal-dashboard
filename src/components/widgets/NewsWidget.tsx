import { useState, useEffect, useCallback } from 'react';
import { Newspaper, RefreshCw, ExternalLink, ChevronDown } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { useLocalStorage } from '../../hooks/useLocalStorage';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
}

const FEEDS = [
  { id: 'tagesschau', label: 'Tagesschau', url: 'https://www.tagesschau.de/xml/rss2' },
  { id: 'heise', label: 'Heise Online', url: 'https://www.heise.de/rss/heise.rdf' },
  { id: 'spiegel', label: 'Spiegel', url: 'https://www.spiegel.de/schlagzeilen/tops/index.rss' },
  { id: 'bbc', label: 'BBC News', url: 'http://feeds.bbci.co.uk/news/rss.xml' },
  { id: 'hn', label: 'Hacker News', url: 'https://news.ycombinator.com/rss' },
  { id: 'golem', label: 'Golem.de', url: 'https://rss.golem.de/rss.php?feed=RSS2.0' },
];

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').trim();

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
};

export default function NewsWidget() {
  const [activeFeedId, setActiveFeedId] = useLocalStorage<string>('news-feed', 'tagesschau');
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const feed = FEEDS.find(f => f.id === activeFeedId) ?? FEEDS[0];

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const encoded = encodeURIComponent(feed.url);
      const res = await fetch(
        `https://api.rss2json.com/v1/api.json?rss_url=${encoded}&count=20`,
        { signal: AbortSignal.timeout(12000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.status !== 'ok') throw new Error(json.message ?? 'Feed-Fehler');
      setItems(json.items ?? []);
    } catch {
      setError('Feed nicht verfügbar');
    } finally {
      setLoading(false);
    }
  }, [feed.url]);

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  return (
    <WidgetWrapper widgetId="news" title="News" icon={<Newspaper size={16} />}>
      <div className="news-widget">
        <div className="news-toolbar">
          <button className="news-feed-selector" onClick={() => setShowPicker(v => !v)}>
            <span>{feed.label}</span>
            <ChevronDown size={13} />
          </button>
          <button className="btn-icon" onClick={fetchFeed} disabled={loading} title="Aktualisieren">
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
        </div>

        {showPicker && (
          <div className="news-feed-picker">
            {FEEDS.map(f => (
              <button
                key={f.id}
                className={`news-feed-option ${f.id === activeFeedId ? 'active' : ''}`}
                onClick={() => { setActiveFeedId(f.id); setShowPicker(false); }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {error && <div className="crypto-error">{error}</div>}

        <div className="news-list">
          {loading && items.length === 0 && (
            <div className="crypto-loading">Lade Nachrichten…</div>
          )}
          {items.map((item, i) => (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="news-item"
            >
              <div className="news-item-content">
                <span className="news-title">{item.title}</span>
                {item.description && (
                  <span className="news-description">
                    {stripHtml(item.description).slice(0, 120)}
                    {stripHtml(item.description).length > 120 ? '…' : ''}
                  </span>
                )}
                {item.pubDate && (
                  <span className="news-date">{formatDate(item.pubDate)}</span>
                )}
              </div>
              <ExternalLink size={11} className="news-link-icon" />
            </a>
          ))}
        </div>
      </div>
    </WidgetWrapper>
  );
}

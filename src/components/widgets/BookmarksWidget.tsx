import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { Bookmark, Plus, Search, Trash2, ExternalLink, Folder } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { useSupabase } from '../../hooks/useSupabase';
import type { Bookmark as BookmarkType } from '../../types';

export default function BookmarksWidget() {
  const [bookmarks, setBookmarks] = useSupabase<BookmarkType>('bookmarks', []);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', url: '', category: '' });
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const handleAdd = () => {
    if (!form.title || !form.url) return;
    let url = form.url;
    if (!url.startsWith('http')) url = 'https://' + url;
    const bookmark: BookmarkType = {
      id: uuid(),
      title: form.title,
      url,
      category: form.category || undefined,
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`,
      createdAt: Date.now(),
    };
    setBookmarks(prev => [bookmark, ...prev]);
    setForm({ title: '', url: '', category: '' });
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  const categories = [...new Set(bookmarks.map(b => b.category).filter(Boolean))] as string[];

  const filtered = bookmarks.filter(b => {
    const matchSearch = b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.url.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !activeCategory || b.category === activeCategory;
    return matchSearch && matchCategory;
  });

  return (
    <WidgetWrapper widgetId="bookmarks" title="Lesezeichen" icon={<Bookmark size={16} />}>
      <div className="vault-toolbar">
        <div className="search-box">
          <Search size={14} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen..." />
        </div>
        <button className="btn-icon" onClick={() => setShowForm(!showForm)}><Plus size={16} /></button>
      </div>

      {categories.length > 0 && (
        <div className="category-tabs">
          <button className={`category-tab ${!activeCategory ? 'active' : ''}`} onClick={() => setActiveCategory(null)}>Alle</button>
          {categories.map(cat => (
            <button key={cat} className={`category-tab ${activeCategory === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat)}>
              <Folder size={11} /> {cat}
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <div className="vault-form">
          <input placeholder="Titel *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <input placeholder="URL *" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
          <input placeholder="Kategorie" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
          <div className="form-actions">
            <button className="btn-primary" onClick={handleAdd}>Speichern</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      <div className="bookmark-list">
        {filtered.map(bm => (
          <div key={bm.id} className="bookmark-card">
            <img src={bm.favicon} alt="" className="bookmark-favicon" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div className="bookmark-info">
              <a href={bm.url} target="_blank" rel="noopener noreferrer" className="bookmark-link">
                {bm.title} <ExternalLink size={11} />
              </a>
              <span className="bookmark-url">{new URL(bm.url).hostname}</span>
            </div>
            <button className="btn-icon-sm delete-btn" onClick={() => handleDelete(bm.id)}><Trash2 size={12} /></button>
          </div>
        ))}
        {filtered.length === 0 && <p className="empty-text">{search ? 'Keine Treffer' : 'Noch keine Lesezeichen'}</p>}
      </div>
    </WidgetWrapper>
  );
}

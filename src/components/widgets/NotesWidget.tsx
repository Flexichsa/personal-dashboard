import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { FileText, Plus, Search, Trash2, Pin, PinOff, ChevronLeft } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import VoiceInputButton from '../VoiceInputButton';
import { useSupabase } from '../../hooks/useSupabase';
import type { Note } from '../../types';

export default function NotesWidget() {
  const [notes, setNotes] = useSupabase<Note>('notes', []);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = () => {
    const note: Note = {
      id: uuid(),
      title: 'Neue Notiz',
      content: '',
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setNotes(prev => [note, ...prev]);
    setEditingId(note.id);
  };

  const handleUpdate = (id: string, updates: Partial<Note>) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n));
  };

  const handleDelete = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const togglePin = (id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
  };

  const sorted = [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

  const filtered = sorted.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  );

  const editing = editingId ? notes.find(n => n.id === editingId) : null;

  if (editing) {
    return (
      <WidgetWrapper widgetId="notes" title="Notizen" icon={<FileText size={16} />}>
        <div className="note-editor">
          <button className="btn-back" onClick={() => setEditingId(null)}>
            <ChevronLeft size={16} /> Zurück
          </button>
          <input
            className="note-title-input"
            value={editing.title}
            onChange={e => handleUpdate(editing.id, { title: e.target.value })}
            placeholder="Titel"
          />
          <div style={{ position: 'relative' }}>
            <textarea
              className="note-content-input"
              value={editing.content}
              onChange={e => handleUpdate(editing.id, { content: e.target.value })}
              placeholder="Notiz schreiben... (Markdown unterstützt)"
            />
            <div style={{ position: 'absolute', top: 8, right: 8 }}>
              <VoiceInputButton
                onTranscript={(text) => handleUpdate(editing.id, { content: editing.content + (editing.content ? ' ' : '') + text })}
              />
            </div>
          </div>
        </div>
      </WidgetWrapper>
    );
  }

  return (
    <WidgetWrapper widgetId="notes" title="Notizen" icon={<FileText size={16} />}>
      <div className="vault-toolbar">
        <div className="search-box">
          <Search size={14} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen..." />
        </div>
        <button className="btn-icon" onClick={handleAdd}><Plus size={16} /></button>
      </div>
      <div className="notes-list">
        {filtered.map(note => (
          <div key={note.id} className="note-card" onClick={() => setEditingId(note.id)}>
            <div className="note-card-header">
              <strong>{note.title}</strong>
              <div className="note-actions">
                <button className="btn-icon-sm" onClick={e => { e.stopPropagation(); togglePin(note.id); }}>
                  {note.pinned ? <PinOff size={12} /> : <Pin size={12} />}
                </button>
                <button className="btn-icon-sm delete-btn" onClick={e => { e.stopPropagation(); handleDelete(note.id); }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            <p className="note-preview">{note.content || 'Leer...'}</p>
            <span className="note-date">{new Date(note.updatedAt).toLocaleDateString('de-DE')}</span>
          </div>
        ))}
        {filtered.length === 0 && <p className="empty-text">{search ? 'Keine Treffer' : 'Noch keine Notizen'}</p>}
      </div>
    </WidgetWrapper>
  );
}

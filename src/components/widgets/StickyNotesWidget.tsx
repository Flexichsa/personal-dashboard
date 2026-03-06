import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { StickyNote, Plus, Trash2 } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import VoiceInputButton from '../VoiceInputButton';
import { useSupabase } from '../../hooks/useSupabase';
import type { StickyNote as StickyNoteType } from '../../types';

const COLORS = ['#fbbf24', '#fb923c', '#f87171', '#a78bfa', '#60a5fa', '#34d399', '#f472b6'];

export default function StickyNotesWidget() {
  const [notes, setNotes] = useSupabase<StickyNoteType>('sticky-notes', []);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const addNote = (color: string) => {
    setNotes(prev => [...prev, { id: uuid(), content: '', color, createdAt: Date.now() }]);
    setShowColorPicker(false);
  };

  const updateNote = (id: string, content: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, content } : n));
  };

  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  return (
    <WidgetWrapper widgetId="stickynotes" title="Schnellnotizen" icon={<StickyNote size={16} />}>
      <div className="sticky-grid">
        {notes.map(note => (
          <div key={note.id} className="sticky-card" style={{ background: note.color + '22', borderColor: note.color + '66' }}>
            <textarea
              value={note.content}
              onChange={e => updateNote(note.id, e.target.value)}
              placeholder="Notiz..."
              style={{ color: note.color }}
            />
            <div style={{ position: 'absolute', bottom: 6, right: 28 }}>
              <VoiceInputButton
                size={12}
                onTranscript={(text) => updateNote(note.id, note.content + (note.content ? ' ' : '') + text)}
              />
            </div>
            <button className="btn-icon-sm delete-btn sticky-delete" onClick={() => deleteNote(note.id)}>
              <Trash2 size={11} />
            </button>
          </div>
        ))}

        {showColorPicker ? (
          <div className="sticky-color-picker">
            {COLORS.map(color => (
              <button
                key={color}
                className="color-dot"
                style={{ background: color }}
                onClick={() => addNote(color)}
              />
            ))}
          </div>
        ) : (
          <button className="sticky-add" onClick={() => setShowColorPicker(true)}>
            <Plus size={20} />
          </button>
        )}
      </div>
    </WidgetWrapper>
  );
}

import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { CheckSquare, Plus, Trash2, Circle, CheckCircle2 } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import VoiceInputButton from '../VoiceInputButton';
import { useSupabase } from '../../hooks/useSupabase';
import type { TodoItem } from '../../types';

const PRIORITY_COLORS = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' };
const PRIORITY_LABELS = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch' };

export default function TodoWidget() {
  const [todos, setTodos] = useSupabase<TodoItem>('todos', []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ text: '', priority: 'medium' as TodoItem['priority'], dueDate: '' });
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');

  const handleAdd = () => {
    if (!form.text) return;
    const todo: TodoItem = {
      id: uuid(),
      text: form.text,
      completed: false,
      priority: form.priority,
      dueDate: form.dueDate || undefined,
      createdAt: Date.now(),
    };
    setTodos(prev => [todo, ...prev]);
    setForm({ text: '', priority: 'medium', dueDate: '' });
    setShowForm(false);
  };

  const toggleComplete = (id: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleDelete = (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  const filtered = todos
    .filter(t => filter === 'all' || (filter === 'active' && !t.completed) || (filter === 'done' && t.completed))
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const pOrder = { high: 0, medium: 1, low: 2 };
      return pOrder[a.priority] - pOrder[b.priority];
    });

  const completedCount = todos.filter(t => t.completed).length;
  const progress = todos.length ? Math.round((completedCount / todos.length) * 100) : 0;

  return (
    <WidgetWrapper widgetId="todos" title="Aufgaben" icon={<CheckSquare size={16} />}>
      {todos.length > 0 && (
        <div className="todo-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-text">{completedCount}/{todos.length} erledigt</span>
        </div>
      )}

      <div className="todo-filters">
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Alle</button>
        <button className={`filter-btn ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')}>Offen</button>
        <button className={`filter-btn ${filter === 'done' ? 'active' : ''}`} onClick={() => setFilter('done')}>Erledigt</button>
        <button className="btn-icon" onClick={() => setShowForm(!showForm)}><Plus size={16} /></button>
      </div>

      {showForm && (
        <div className="vault-form compact">
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input style={{ flex: 1 }} placeholder="Aufgabe *" value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            <VoiceInputButton onTranscript={(text) => setForm(f => ({ ...f, text: f.text + (f.text ? ' ' : '') + text }))} />
          </div>
          <div className="todo-form-row">
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as TodoItem['priority'] })}>
              <option value="low">Niedrig</option>
              <option value="medium">Mittel</option>
              <option value="high">Hoch</option>
            </select>
            <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={handleAdd}>Hinzufügen</button>
          </div>
        </div>
      )}

      <div className="todo-list">
        {filtered.map(todo => (
          <div key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
            <button className="todo-check" onClick={() => toggleComplete(todo.id)}>
              {todo.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </button>
            <div className="todo-content">
              <span className="todo-text">{todo.text}</span>
              <div className="todo-meta">
                <span className="priority-dot" style={{ background: PRIORITY_COLORS[todo.priority] }} title={PRIORITY_LABELS[todo.priority]} />
                {todo.dueDate && <span className="todo-due">{new Date(todo.dueDate + 'T00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</span>}
              </div>
            </div>
            <button className="btn-icon-sm delete-btn" onClick={() => handleDelete(todo.id)}><Trash2 size={12} /></button>
          </div>
        ))}
        {filtered.length === 0 && <p className="empty-text">Keine Aufgaben</p>}
      </div>
    </WidgetWrapper>
  );
}

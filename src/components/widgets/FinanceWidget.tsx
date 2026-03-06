import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { Wallet, Plus, Trash2, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { useSupabase } from '../../hooks/useSupabase';
import type { FinanceEntry } from '../../types';

const CATEGORIES = {
  income: ['Gehalt', 'Freelance', 'Investitionen', 'Sonstiges'],
  expense: ['Miete', 'Lebensmittel', 'Transport', 'Unterhaltung', 'Abos', 'Gesundheit', 'Sonstiges'],
};

export default function FinanceWidget() {
  const [entries, setEntries] = useSupabase<FinanceEntry>('finance', []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    description: '',
    amount: '',
    type: 'expense' as 'income' | 'expense',
    category: 'Sonstiges',
    date: new Date().toISOString().split('T')[0],
  });

  const handleAdd = () => {
    if (!form.description || !form.amount) return;
    const entry: FinanceEntry = {
      id: uuid(),
      description: form.description,
      amount: parseFloat(form.amount),
      type: form.type,
      category: form.category,
      date: form.date,
      createdAt: Date.now(),
    };
    setEntries(prev => [entry, ...prev]);
    setForm({ description: '', amount: '', type: 'expense', category: 'Sonstiges', date: new Date().toISOString().split('T')[0] });
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  // Current month stats
  const now = new Date();
  const currentMonth = entries.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const income = currentMonth.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const expenses = currentMonth.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const balance = income - expenses;

  const formatCurrency = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  return (
    <WidgetWrapper widgetId="finance" title="Finanzen" icon={<Wallet size={16} />}>
      <div className="finance-summary">
        <div className="finance-card income">
          <TrendingUp size={16} />
          <span className="finance-label">Einnahmen</span>
          <span className="finance-amount">{formatCurrency(income)}</span>
        </div>
        <div className="finance-card expense">
          <TrendingDown size={16} />
          <span className="finance-label">Ausgaben</span>
          <span className="finance-amount">{formatCurrency(expenses)}</span>
        </div>
        <div className={`finance-card balance ${balance >= 0 ? 'positive' : 'negative'}`}>
          <Wallet size={16} />
          <span className="finance-label">Bilanz</span>
          <span className="finance-amount">{formatCurrency(balance)}</span>
        </div>
      </div>

      <div className="finance-header">
        <span className="finance-month">
          {now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
        </span>
        <button className="btn-icon" onClick={() => setShowForm(!showForm)}><Plus size={16} /></button>
      </div>

      {showForm && (
        <div className="vault-form compact">
          <div className="finance-type-toggle">
            <button
              className={`type-btn ${form.type === 'expense' ? 'active expense' : ''}`}
              onClick={() => setForm({ ...form, type: 'expense', category: 'Sonstiges' })}
            >
              <ArrowDownRight size={14} /> Ausgabe
            </button>
            <button
              className={`type-btn ${form.type === 'income' ? 'active income' : ''}`}
              onClick={() => setForm({ ...form, type: 'income', category: 'Sonstiges' })}
            >
              <ArrowUpRight size={14} /> Einnahme
            </button>
          </div>
          <input placeholder="Beschreibung *" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <input type="number" placeholder="Betrag *" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} step="0.01" />
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES[form.type].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          <div className="form-actions">
            <button className="btn-primary" onClick={handleAdd}>Hinzufügen</button>
          </div>
        </div>
      )}

      <div className="finance-list">
        {currentMonth.slice(0, 10).map(entry => (
          <div key={entry.id} className={`finance-entry ${entry.type}`}>
            <div className="finance-entry-icon">
              {entry.type === 'income' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            </div>
            <div className="finance-entry-info">
              <span>{entry.description}</span>
              <span className="finance-entry-cat">{entry.category}</span>
            </div>
            <span className={`finance-entry-amount ${entry.type}`}>
              {entry.type === 'income' ? '+' : '-'}{formatCurrency(entry.amount)}
            </span>
            <button className="btn-icon-sm delete-btn" onClick={() => handleDelete(entry.id)}><Trash2 size={11} /></button>
          </div>
        ))}
        {currentMonth.length === 0 && <p className="empty-text">Keine Einträge diesen Monat</p>}
      </div>
    </WidgetWrapper>
  );
}

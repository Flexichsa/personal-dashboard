import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { Lock, Plus, Eye, EyeOff, Copy, Trash2, Key, Search, RefreshCw } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { useSupabaseVault } from '../../hooks/useSupabaseVault';
import { encrypt, decrypt, hashPassword, generatePassword } from '../../utils/encryption';
import type { PasswordEntry } from '../../types';

export default function PasswordVault() {
  const { masterHash, setMasterHash, encryptedData, setEncryptedData, loading } = useSupabaseVault();
  const [unlocked, setUnlocked] = useState(false);
  const [masterInput, setMasterInput] = useState('');
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [masterKey, setMasterKey] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({ title: '', username: '', password: '', url: '', category: '', notes: '' });

  const saveEntries = (newEntries: PasswordEntry[], key: string) => {
    setEntries(newEntries);
    setEncryptedData(encrypt(JSON.stringify(newEntries), key));
  };

  const handleSetup = () => {
    if (masterInput.length < 4) {
      setError('Mindestens 4 Zeichen');
      return;
    }
    const hash = hashPassword(masterInput);
    setMasterHash(hash);
    setMasterKey(masterInput);
    setEncryptedData(encrypt(JSON.stringify([]), masterInput));
    setEntries([]);
    setUnlocked(true);
    setMasterInput('');
    setError('');
  };

  const handleUnlock = () => {
    const hash = hashPassword(masterInput);
    if (hash !== masterHash) {
      setError('Falsches Master-Passwort');
      return;
    }
    try {
      const decrypted = decrypt(encryptedData, masterInput);
      setEntries(JSON.parse(decrypted));
      setMasterKey(masterInput);
      setUnlocked(true);
      setMasterInput('');
      setError('');
    } catch {
      setError('Entschlüsselung fehlgeschlagen');
    }
  };

  const handleAdd = () => {
    if (!form.title || !form.password) return;
    const entry: PasswordEntry = {
      id: uuid(),
      ...form,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const newEntries = [entry, ...entries];
    saveEntries(newEntries, masterKey);
    setForm({ title: '', username: '', password: '', url: '', category: '', notes: '' });
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    saveEntries(entries.filter(e => e.id !== id), masterKey);
  };

  const toggleVisible = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const filtered = entries.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.username.toLowerCase().includes(search.toLowerCase()) ||
    (e.category || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <WidgetWrapper widgetId="passwords" title="Passwort-Tresor" icon={<Lock size={16} />}>
        <div className="vault-lock">
          <Lock size={40} className="vault-icon" />
          <p>Laden...</p>
        </div>
      </WidgetWrapper>
    );
  }

  const handleReset = () => {
    if (!confirm('Tresor wirklich zurücksetzen? Alle gespeicherten Passwörter gehen verloren!')) return;
    setMasterHash('');
    setEncryptedData('');
    setEntries([]);
    setMasterKey('');
    setUnlocked(false);
    setError('');
  };

  if (!unlocked) {
    return (
      <WidgetWrapper widgetId="passwords" title="Passwort-Tresor" icon={<Lock size={16} />}>
        <div className="vault-lock">
          <Lock size={40} className="vault-icon" />
          <p>{masterHash ? 'Master-Passwort eingeben' : 'Master-Passwort erstellen'}</p>
          <input
            type="password"
            value={masterInput}
            onChange={e => { setMasterInput(e.target.value); setError(''); }}
            placeholder="Master-Passwort"
            onKeyDown={e => e.key === 'Enter' && (masterHash ? handleUnlock() : handleSetup())}
          />
          {error && <span className="error-text">{error}</span>}
          <button className="btn-primary" onClick={masterHash ? handleUnlock : handleSetup}>
            {masterHash ? 'Entsperren' : 'Erstellen'}
          </button>
          {masterHash && (
            <button className="btn-reset" onClick={handleReset}>
              Tresor zurücksetzen
            </button>
          )}
        </div>
      </WidgetWrapper>
    );
  }

  return (
    <WidgetWrapper widgetId="passwords" title="Passwort-Tresor" icon={<Lock size={16} />}>
      <div className="vault-toolbar">
        <div className="search-box">
          <Search size={14} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suchen..."
          />
        </div>
        <button className="btn-icon" onClick={() => setShowForm(!showForm)} title="Neuer Eintrag">
          <Plus size={16} />
        </button>
        <button className="btn-icon" onClick={() => { setUnlocked(false); setMasterKey(''); }} title="Sperren">
          <Lock size={16} />
        </button>
      </div>

      {showForm && (
        <div className="vault-form">
          <input placeholder="Titel *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <input placeholder="Benutzername" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
          <div className="password-input-row">
            <input placeholder="Passwort *" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            <button className="btn-icon" onClick={() => setForm({ ...form, password: generatePassword() })} title="Generieren">
              <RefreshCw size={14} />
            </button>
          </div>
          <input placeholder="URL" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
          <input placeholder="Kategorie" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
          <div className="form-actions">
            <button className="btn-primary" onClick={handleAdd}>Speichern</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      <div className="vault-list">
        {filtered.map(entry => (
          <div key={entry.id} className="vault-entry">
            <div className="vault-entry-header">
              <Key size={14} />
              <strong>{entry.title}</strong>
              {entry.category && <span className="tag">{entry.category}</span>}
            </div>
            {entry.username && <div className="vault-field">
              <span className="field-label">User:</span>
              <span>{entry.username}</span>
              <button className="btn-icon-sm" onClick={() => copyToClipboard(entry.username)} title="Kopieren"><Copy size={12} /></button>
            </div>}
            <div className="vault-field">
              <span className="field-label">Pass:</span>
              <span className="password-value">{visiblePasswords.has(entry.id) ? entry.password : '••••••••'}</span>
              <button className="btn-icon-sm" onClick={() => toggleVisible(entry.id)}>
                {visiblePasswords.has(entry.id) ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
              <button className="btn-icon-sm" onClick={() => copyToClipboard(entry.password)} title="Kopieren"><Copy size={12} /></button>
            </div>
            <button className="btn-icon-sm delete-btn" onClick={() => handleDelete(entry.id)}><Trash2 size={12} /></button>
          </div>
        ))}
        {filtered.length === 0 && <p className="empty-text">{search ? 'Keine Treffer' : 'Noch keine Einträge'}</p>}
      </div>
    </WidgetWrapper>
  );
}

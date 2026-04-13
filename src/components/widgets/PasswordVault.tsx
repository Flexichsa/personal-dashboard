import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import {
  Lock, Plus, Eye, EyeOff, Copy, Trash2, Key, Search,
  RefreshCw, Pencil, Check, X, Shield, Globe, Sliders
} from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { useSupabaseVault } from '../../hooks/useSupabaseVault';
import { encrypt, decrypt, hashPassword, generatePassword } from '../../utils/encryption';
import type { PasswordEntry } from '../../types';

const PRESET_CATEGORIES = ['Email', 'Social', 'Banking', 'Shopping', 'Work', 'Server', 'Sonstiges'];
const AUTO_LOCK_MS = 5 * 60 * 1000; // 5 Minuten
const SESSION_KEY = 'vault_session_key'; // Für Fullscreen-Sync: Master-Key in sessionStorage teilen

const CATEGORY_COLORS: Record<string, string> = {
  email: '#60a5fa',
  social: '#38bdf8',
  banking: '#34d399',
  shopping: '#a78bfa',
  work: '#fbbf24',
  server: '#fb923c',
  sonstiges: '#94a3b8',
  'api-keys': '#f472b6',
  'kneuss-apps': '#fb923c',
  datenbanken: '#06b6d4',
  azure: '#0078d4',
  github: '#8b5cf6',
  'eigene apps': '#10b981',
};

function getCategoryColor(category?: string): string {
  if (!category) return 'var(--color-passwords)';
  return CATEGORY_COLORS[category.toLowerCase()] || 'var(--color-passwords)';
}

// Static logo mapping for known services (title keyword → logo URL)
const SERVICE_LOGOS: Record<string, string> = {
  supabase: 'https://supabase.com/favicon/favicon-32x32.png',
  github: 'https://github.githubassets.com/favicons/favicon.png',
  openai: 'https://cdn.oaistatic.com/assets/favicon-miwm3e3e.svg',
  azure: 'https://portal.azure.com/favicon.ico',
  vercel: 'https://vercel.com/favicon.ico',
  'n8n': 'https://n8n.io/favicon.ico',
  docker: 'https://www.docker.com/favicon.ico',
  google: 'https://www.google.com/favicon.ico',
  outlook: 'https://outlook.live.com/favicon.ico',
  microsoft: 'https://www.microsoft.com/favicon.ico',
  slack: 'https://a.slack-edge.com/80588/marketing/img/meta/favicon-32.png',
  notion: 'https://www.notion.so/images/favicon.ico',
  gitlab: 'https://gitlab.com/assets/favicon-72a2cad5025aa931d6ea56c3201d1f18e68a8571999c0.png',
  bitbucket: 'https://bitbucket.org/favicon.ico',
  aws: 'https://a0.awsstatic.com/libra-css/images/site/fav/favicon.ico',
  cloudflare: 'https://www.cloudflare.com/favicon.ico',
  stripe: 'https://stripe.com/favicon.ico',
  firebase: 'https://firebase.google.com/favicon.ico',
  jira: 'https://jira.atlassian.com/favicon.ico',
  npm: 'https://static-production.npmjs.com/b0f1a8318363185cc2ea6a40ac23eeb2.png',
  linkedin: 'https://static.licdn.com/aero-v1/sc/h/al2o9zrvru7aqj8e1x2rzsrca',
  twitter: 'https://abs.twimg.com/favicons/twitter.3.ico',
  discord: 'https://discord.com/assets/favicon.ico',
  reddit: 'https://www.reddit.com/favicon.ico',
  wordpress: 'https://s1.wp.com/i/favicon.ico',
  grafana: 'https://grafana.com/static/assets/img/fav32.png',
  postgres: 'https://www.postgresql.org/favicon.ico',
  mongodb: 'https://www.mongodb.com/assets/images/global/favicon.ico',
  redis: 'https://redis.io/favicon.ico',
  ssh: 'https://www.openssh.com/favicon.ico',
};

function getServiceLogo(title?: string, url?: string): string | null {
  // 1. Check title against known service logos
  if (title) {
    const lower = title.toLowerCase();
    for (const [keyword, logoUrl] of Object.entries(SERVICE_LOGOS)) {
      if (lower.includes(keyword)) return logoUrl;
    }
  }
  // 2. Check URL against known service logos
  if (url) {
    const lower = url.toLowerCase();
    for (const [keyword, logoUrl] of Object.entries(SERVICE_LOGOS)) {
      if (lower.includes(keyword)) return logoUrl;
    }
  }
  return null;
}

function getFaviconUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    // Skip localhost and internal hosts — Google favicon won't find them
    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.includes('intra.')) return null;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return null;
  }
}

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (password.length >= 16) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    return Math.min(score, 5);
  }, [password]);

  const labels = ['Sehr schwach', 'Schwach', 'Mittel', 'Gut', 'Stark', 'Sehr stark'];
  const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981'];

  if (!password) return null;

  return (
    <div className="vault-strength">
      <div className="vault-strength-bar">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="vault-strength-segment"
            style={{ background: i < strength ? colors[strength] : 'var(--border)' }}
          />
        ))}
      </div>
      <span className="vault-strength-label" style={{ color: colors[strength] }}>
        {labels[strength]}
      </span>
    </div>
  );
}

export default function PasswordVault() {
  const { masterHash, encryptedData, saveVault, loading } = useSupabaseVault();
  const [unlocked, setUnlocked] = useState(false);
  const [masterInput, setMasterInput] = useState('');
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [masterKey, setMasterKey] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [genLength, setGenLength] = useState(20);
  const [genOptions, setGenOptions] = useState({ upper: true, lower: true, numbers: true, symbols: true });

  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', username: '', password: '', url: '', category: '', notes: '' });

  const autoLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Auto-Unlock: Wenn eine andere Instanz (z.B. Grid-Widget) bereits entsperrt hat,
  // den Master-Key aus sessionStorage übernehmen (für Fullscreen-Modus)
  useEffect(() => {
    if (unlocked || !masterHash || !encryptedData) return;
    try {
      const sessionKey = sessionStorage.getItem(SESSION_KEY);
      if (!sessionKey) return;
      if (hashPassword(sessionKey) !== masterHash) return;
      const decrypted = decrypt(encryptedData, sessionKey);
      setEntries(JSON.parse(decrypted));
      setMasterKey(sessionKey);
      setUnlocked(true);
    } catch { /* Session-Key ungültig — ignorieren */ }
  }, [masterHash, encryptedData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-Lock nach Inaktivitaet
  const resetAutoLock = useCallback(() => {
    if (!unlocked) return;
    if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
    autoLockTimer.current = setTimeout(() => {
      setUnlocked(false);
      setMasterKey('');
      sessionStorage.removeItem(SESSION_KEY);
      setEntries([]);
      setVisiblePasswords(new Set());
      setSearch('');
      setShowForm(false);
      setEditId(null);
    }, AUTO_LOCK_MS);
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    resetAutoLock();
    const events = ['mousemove', 'keydown', 'click', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetAutoLock));
    return () => {
      events.forEach(e => window.removeEventListener(e, resetAutoLock));
      if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
    };
  }, [unlocked, resetAutoLock]);

  const saveEntries = useCallback((newEntries: PasswordEntry[], key: string) => {
    setEntries(newEntries);
    saveVault(masterHash, encrypt(JSON.stringify(newEntries), key));
  }, [masterHash, saveVault]);

  const handleSetup = () => {
    if (masterInput.length < 8) {
      setError('Mindestens 8 Zeichen');
      return;
    }
    const hash = hashPassword(masterInput);
    saveVault(hash, encrypt(JSON.stringify([]), masterInput));
    setMasterKey(masterInput);
    setEntries([]);
    setUnlocked(true);
    sessionStorage.setItem(SESSION_KEY, masterInput);
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
      sessionStorage.setItem(SESSION_KEY, masterInput);
      setMasterInput('');
      setError('');
    } catch {
      setError('Entschluesselung fehlgeschlagen');
    }
  };

  const handleLock = () => {
    setUnlocked(false);
    setMasterKey('');
    sessionStorage.removeItem(SESSION_KEY);
    setEntries([]);
    setVisiblePasswords(new Set());
    setSearch('');
    setShowForm(false);
    setEditId(null);
    setConfirmDeleteId(null);
  };

  const openEdit = (entry: PasswordEntry) => {
    setEditId(entry.id);
    setForm({
      title: entry.title,
      username: entry.username,
      password: entry.password,
      url: entry.url || '',
      category: entry.category || '',
      notes: entry.notes || '',
    });
    setShowForm(true);
    setSubmitted(false);
    // Nach oben scrollen damit das Formular sichtbar wird
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const handleSave = () => {
    setSubmitted(true);
    if (!form.title || !form.password) return;
    if (editId) {
      saveEntries(
        entries.map(e => e.id === editId ? { ...e, ...form, updatedAt: Date.now() } : e),
        masterKey
      );
      setEditId(null);
    } else {
      saveEntries(
        [{ id: uuid(), ...form, createdAt: Date.now(), updatedAt: Date.now() }, ...entries],
        masterKey
      );
    }
    setForm({ title: '', username: '', password: '', url: '', category: '', notes: '' });
    setShowForm(false);
    setSubmitted(false);
  };

  const handleDelete = (id: string) => {
    saveEntries(entries.filter(e => e.id !== id), masterKey);
    setConfirmDeleteId(null);
  };

  const toggleVisible = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleNewForm = () => {
    if (showForm) {
      setShowForm(false);
      setEditId(null);
      setForm({ title: '', username: '', password: '', url: '', category: '', notes: '' });
      setSubmitted(false);
    } else {
      setEditId(null);
      setForm({ title: '', username: '', password: '', url: '', category: '', notes: '' });
      setShowForm(true);
      setSubmitted(false);
    }
  };

  const allCategories = useMemo(() => {
    const existing = entries.map(e => e.category).filter(Boolean) as string[];
    return [...new Set([...PRESET_CATEGORIES, ...existing])].sort();
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return entries;
    return entries.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.username.toLowerCase().includes(q) ||
      (e.category || '').toLowerCase().includes(q)
    );
  }, [entries, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, PasswordEntry[]> = {};
    filtered.forEach(e => {
      const cat = e.category || 'Ohne Kategorie';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(e);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const handleReset = () => {
    if (!confirm('Tresor wirklich zuruecksetzen? Alle gespeicherten Passwoerter gehen verloren!')) return;
    saveVault('', '');
    setEntries([]);
    setMasterKey('');
    setUnlocked(false);
    setError('');
  };

  if (loading) {
    return (
      <WidgetWrapper widgetId="passwords" title="Passwort-Tresor" icon={<Lock size={16} />}>
        <div className="vault-lock">
          <Lock size={40} className="vault-icon vault-pulse" />
          <p>Laden...</p>
        </div>
      </WidgetWrapper>
    );
  }

  if (!unlocked) {
    return (
      <WidgetWrapper widgetId="passwords" title="Passwort-Tresor" icon={<Lock size={16} />}>
        <div className="vault-lock">
          <div className="vault-lock-icon-wrap">
            <Shield size={48} className="vault-icon" />
          </div>
          <p>{masterHash ? 'Master-Passwort eingeben' : 'Master-Passwort erstellen'}</p>
          <input
            type="password"
            value={masterInput}
            onChange={e => { setMasterInput(e.target.value); setError(''); }}
            placeholder={masterHash ? 'Master-Passwort' : 'Neues Master-Passwort (min. 8 Zeichen)'}
            onKeyDown={e => e.key === 'Enter' && (masterHash ? handleUnlock() : handleSetup())}
            aria-label="Master-Passwort"
          />
          {!masterHash && masterInput && <PasswordStrengthBar password={masterInput} />}
          {error && <span className="error-text" role="alert">{error}</span>}
          <button className="btn-primary" onClick={masterHash ? handleUnlock : handleSetup}>
            {masterHash ? 'Entsperren' : 'Erstellen'}
          </button>
          {masterHash && (
            <button className="btn-reset" onClick={handleReset}>
              Tresor zuruecksetzen
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
            aria-label="Passwoerter durchsuchen"
          />
        </div>
        <button className="btn-icon" onClick={toggleNewForm} title="Neuer Eintrag" aria-label="Neuer Eintrag">
          {showForm ? <X size={16} /> : <Plus size={16} />}
        </button>
        <button className="btn-icon" onClick={handleLock} title="Sperren" aria-label="Tresor sperren">
          <Lock size={16} />
        </button>
      </div>

      {showForm && (
        <div className="vault-form" ref={formRef}>
          <div className="vault-form-header">
            <span>{editId ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</span>
          </div>
          <div className="vault-form-field">
            <label className="vault-label">Titel <span className="required">*</span></label>
            <input
              placeholder="z.B. Gmail, Netflix..."
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className={submitted && !form.title ? 'input-error' : ''}
              aria-label="Titel"
            />
          </div>
          <div className="vault-form-field">
            <label className="vault-label">Benutzername</label>
            <input
              placeholder="user@example.com"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              aria-label="Benutzername"
            />
          </div>
          <div className="vault-form-field">
            <label className="vault-label">Passwort <span className="required">*</span></label>
            <div className="password-input-row">
              <input
                placeholder="Passwort"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className={submitted && !form.password ? 'input-error' : ''}
                aria-label="Passwort"
              />
              <button
                className="btn-icon"
                onClick={() => setShowGenerator(!showGenerator)}
                title="Generator"
                aria-label="Passwort-Generator"
              >
                <Sliders size={14} />
              </button>
              <button
                className="btn-icon"
                onClick={() => setForm({ ...form, password: generatePassword(genLength, genOptions) })}
                title="Zufaelliges Passwort"
                aria-label="Zufaelliges Passwort generieren"
              >
                <RefreshCw size={14} />
              </button>
            </div>
            {form.password && <PasswordStrengthBar password={form.password} />}
          </div>

          {showGenerator && (
            <div className="vault-generator">
              <div className="vault-gen-length">
                <label>Laenge: <strong>{genLength}</strong></label>
                <input
                  type="range"
                  min={8}
                  max={64}
                  value={genLength}
                  onChange={e => setGenLength(+e.target.value)}
                />
              </div>
              <div className="vault-gen-options">
                {Object.entries(genOptions).map(([key, val]) => (
                  <label key={key} className="vault-gen-toggle">
                    <input
                      type="checkbox"
                      checked={val}
                      onChange={() => setGenOptions(o => ({ ...o, [key]: !o[key as keyof typeof o] }))}
                    />
                    <span>{key === 'upper' ? 'A-Z' : key === 'lower' ? 'a-z' : key === 'numbers' ? '0-9' : '!@#'}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="vault-form-field">
            <label className="vault-label">URL</label>
            <input
              placeholder="https://..."
              value={form.url}
              onChange={e => setForm({ ...form, url: e.target.value })}
              aria-label="URL"
            />
          </div>
          <div className="vault-form-field">
            <label className="vault-label">Kategorie</label>
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              className="vault-select"
              aria-label="Kategorie"
            >
              <option value="">Kategorie waehlen...</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="vault-form-field">
            <label className="vault-label">Notizen</label>
            <textarea
              placeholder="Optionale Notizen..."
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="vault-textarea"
              aria-label="Notizen"
            />
          </div>
          {submitted && (!form.title || !form.password) && (
            <span className="error-text" role="alert">Titel und Passwort sind Pflichtfelder</span>
          )}
          <div className="form-actions">
            <button className="btn-primary" onClick={handleSave}>
              {editId ? 'Aktualisieren' : 'Speichern'}
            </button>
            <button className="btn-secondary" onClick={toggleNewForm}>Abbrechen</button>
          </div>
        </div>
      )}

      <div className="vault-list">
        {grouped.map(([category, items]) => (
          <div key={category} className="vault-group">
            {(grouped.length > 1 || category !== 'Ohne Kategorie') && (
              <div className="vault-group-header">
                <span>{category}</span>
                <span className="vault-group-count">{items.length}</span>
              </div>
            )}
            {items.map((entry, idx) => {
              const serviceLogo = getServiceLogo(entry.title, entry.url);
              const favicon = getFaviconUrl(entry.url);
              const logoSrc = serviceLogo || favicon;
              const catColor = getCategoryColor(entry.category);
              return (
                <div
                  key={entry.id}
                  className="vault-entry"
                  style={{
                    borderLeftColor: catColor,
                    animationDelay: `${Math.min(idx * 50, 300)}ms`,
                  }}
                >
                  <div className="vault-entry-main">
                    <div className="vault-entry-icon" style={{ background: `${catColor}20` }}>
                      {logoSrc ? (
                        <img
                          src={logoSrc}
                          alt=""
                          width={18}
                          height={18}
                          loading="lazy"
                          onError={(e) => {
                            // Fallback: try Google favicon, then hide
                            const img = e.currentTarget;
                            if (serviceLogo && favicon && img.src !== favicon) {
                              img.src = favicon;
                            } else {
                              img.style.display = 'none';
                              img.parentElement?.classList.add('vault-icon-fallback');
                            }
                          }}
                        />
                      ) : (
                        <Key size={16} style={{ color: catColor }} />
                      )}
                    </div>
                    <div className="vault-entry-info">
                      <strong>{entry.title}</strong>
                      {entry.username && (
                        <span className="vault-subtitle">{entry.username}</span>
                      )}
                    </div>
                    {entry.category && <span className="tag" style={{ background: `${catColor}18`, color: catColor }}>{entry.category}</span>}
                  </div>

                  <div className="vault-entry-fields">
                    {entry.username && (
                      <button
                        className="vault-action-btn"
                        onClick={() => copyToClipboard(entry.username, `user-${entry.id}`)}
                        aria-label="Benutzername kopieren"
                      >
                        {copiedId === `user-${entry.id}` ? (
                          <><Check size={14} className="copy-success-icon" /> <span>Kopiert!</span></>
                        ) : (
                          <><Copy size={14} /> <span>User kopieren</span></>
                        )}
                      </button>
                    )}
                    <button
                      className="vault-action-btn vault-action-primary"
                      onClick={() => copyToClipboard(entry.password, `pass-${entry.id}`)}
                      aria-label="Passwort kopieren"
                    >
                      {copiedId === `pass-${entry.id}` ? (
                        <><Check size={14} className="copy-success-icon" /> <span>Kopiert!</span></>
                      ) : (
                        <><Copy size={14} /> <span>Passwort kopieren</span></>
                      )}
                    </button>
                    <button
                      className="vault-action-btn vault-action-sm"
                      onClick={() => toggleVisible(entry.id)}
                      aria-label={visiblePasswords.has(entry.id) ? 'Passwort verbergen' : 'Passwort anzeigen'}
                    >
                      {visiblePasswords.has(entry.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  {visiblePasswords.has(entry.id) && (
                    <div className="vault-password-reveal">
                      <code>{entry.password}</code>
                    </div>
                  )}

                  {entry.notes && visiblePasswords.has(entry.id) && (
                    <div className="vault-notes-reveal">
                      <span className="field-label">Notiz:</span> {entry.notes}
                    </div>
                  )}

                  <div className="vault-entry-bottom">
                    <button
                      className="vault-action-btn vault-action-sm"
                      onClick={() => openEdit(entry)}
                      aria-label="Eintrag bearbeiten"
                    >
                      <Pencil size={14} /> <span>Bearbeiten</span>
                    </button>
                    {confirmDeleteId === entry.id ? (
                      <div className="vault-delete-confirm">
                        <span>Loeschen?</span>
                        <button
                          className="vault-action-btn vault-action-danger"
                          onClick={() => handleDelete(entry.id)}
                          aria-label="Loeschen bestaetigen"
                        >
                          Ja
                        </button>
                        <button
                          className="vault-action-btn"
                          onClick={() => setConfirmDeleteId(null)}
                          aria-label="Loeschen abbrechen"
                        >
                          Nein
                        </button>
                      </div>
                    ) : (
                      <button
                        className="vault-action-btn vault-action-sm vault-action-danger-ghost"
                        onClick={() => setConfirmDeleteId(entry.id)}
                        aria-label="Eintrag loeschen"
                      >
                        <Trash2 size={14} /> <span>Loeschen</span>
                      </button>
                    )}
                    {entry.url && (
                      <a
                        href={entry.url.startsWith('http') ? entry.url : `https://${entry.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="vault-action-btn vault-action-sm"
                        aria-label="Website oeffnen"
                      >
                        <Globe size={14} /> <span>Oeffnen</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="empty-text">{search ? 'Keine Treffer' : 'Noch keine Eintraege'}</p>
        )}
      </div>
    </WidgetWrapper>
  );
}

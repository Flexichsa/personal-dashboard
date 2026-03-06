import { useState, useMemo, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import {
  Users, Plus, Search, Trash2, Mail, Phone, Building, Tag,
  Camera, ChevronDown, ChevronRight, X, Check, Scan,
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import WidgetWrapper from '../WidgetWrapper';
import { useSupabase } from '../../hooks/useSupabase';
import type { Contact } from '../../types';

const EMPTY_FORM = { name: '', email: '', phone: '', company: '', tags: '', notes: '', avatar: '' };

function compressToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 80;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const ratio = Math.max(size / img.width, size / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function extractOcrLines(text: string): string[] {
  return text
    .split(/[\n\r]+/)
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(l => l.length > 2);
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getAvatarColor(name: string) {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#f97316', '#06b6d4'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function ContactsWidget() {
  const [contacts, setContacts] = useSupabase<Contact>('contacts', []);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [groupByCompany, setGroupByCompany] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrLines, setOcrLines] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cardInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.company ?? '').toLowerCase().includes(search.toLowerCase()) ||
    c.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  ), [contacts, search]);

  const grouped = useMemo(() => {
    if (!groupByCompany) return null;
    const map = new Map<string, Contact[]>();
    for (const c of filtered) {
      const key = c.company?.trim() || '— Ohne Firma —';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === '— Ohne Firma —') return 1;
      if (b === '— Ohne Firma —') return -1;
      return a.localeCompare(b);
    });
  }, [filtered, groupByCompany]);

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (c: Contact) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      email: c.email ?? '',
      phone: c.phone ?? '',
      company: c.company ?? '',
      tags: c.tags.join(', '),
      notes: c.notes ?? '',
      avatar: c.avatar ?? '',
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const base: Omit<Contact, 'id' | 'createdAt'> = {
      name: form.name.trim(),
      email: form.email || undefined,
      phone: form.phone || undefined,
      company: form.company || undefined,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      notes: form.notes || undefined,
      avatar: form.avatar || undefined,
    };
    if (editId) {
      setContacts(prev => prev.map(c => c.id === editId ? { ...c, ...base } : c));
    } else {
      setContacts(prev => [{ id: uuid(), createdAt: Date.now(), ...base }, ...prev]);
    }
    setForm(EMPTY_FORM);
    setShowForm(false);
    setEditId(null);
  };

  const confirmDelete = (id: string) => setConfirmDeleteId(id);

  const handleDelete = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
    setConfirmDeleteId(null);
    if (editId === id) { setShowForm(false); setEditId(null); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await compressToBase64(file);
      setForm(f => ({ ...f, avatar: b64 }));
    } catch { /* ignore */ }
    e.target.value = '';
  };

  const handleCardScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    setOcrProgress(0);
    setOcrLines([]);
    try {
      const result = await Tesseract.recognize(file, 'deu+eng', {
        logger: m => { if (m.status === 'recognizing text') setOcrProgress(Math.round(m.progress * 100)); },
      });
      setOcrLines(extractOcrLines(result.data.text));
    } catch { /* ignore */ }
    setOcrLoading(false);
    e.target.value = '';
  };

  const assignOcrLine = (line: string, field: 'name' | 'company' | 'email' | 'phone') => {
    setForm(f => ({ ...f, [field]: line }));
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const renderContact = (c: Contact, hideCompany = false) => (
    <div key={c.id} className="contact-card">
      <div className="contact-avatar-wrap" onClick={() => openEdit(c)}>
        {c.avatar
          ? <img src={c.avatar} alt={c.name} className="contact-avatar-img" />
          : <div className="contact-avatar" style={{ background: getAvatarColor(c.name) }}>{getInitials(c.name)}</div>
        }
      </div>
      <div className="contact-info" onClick={() => openEdit(c)}>
        <strong>{c.name}</strong>
        {!hideCompany && c.company && <span className="contact-detail"><Building size={11} /> {c.company}</span>}
        {c.email && <span className="contact-detail"><Mail size={11} /> {c.email}</span>}
        {c.phone && <span className="contact-detail"><Phone size={11} /> {c.phone}</span>}
        {c.tags.length > 0 && (
          <div className="contact-tags">
            {c.tags.map(tag => <span key={tag} className="tag"><Tag size={10} /> {tag}</span>)}
          </div>
        )}
      </div>
      {confirmDeleteId === c.id ? (
        <div className="contact-confirm-delete">
          <span>Löschen?</span>
          <button className="btn-confirm-yes" onClick={() => handleDelete(c.id)}>Ja</button>
          <button className="btn-confirm-no" onClick={() => setConfirmDeleteId(null)}>Nein</button>
        </div>
      ) : (
        <button className="btn-icon-sm delete-btn" onClick={() => confirmDelete(c.id)}><Trash2 size={12} /></button>
      )}
    </div>
  );

  return (
    <WidgetWrapper widgetId="contacts" title="Kontakte" icon={<Users size={16} />}>
      <div className="contacts-widget">
        <div className="vault-toolbar">
          <div className="search-box">
            <Search size={14} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen…" />
          </div>
          <button
            className={`btn-icon ${groupByCompany ? 'active' : ''}`}
            onClick={() => setGroupByCompany(v => !v)}
            title="Nach Firma gruppieren"
          >
            <Building size={15} />
          </button>
          <button className="btn-icon" onClick={openAdd}><Plus size={16} /></button>
        </div>

        {showForm && (
          <div className="contact-form">
            <div className="contact-form-header">
              <span>{editId ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}</span>
              <button className="btn-icon-sm" onClick={() => setShowForm(false)}><X size={14} /></button>
            </div>

            {/* Avatar preview + upload */}
            <div className="contact-form-avatar">
              <div
                className="contact-form-avatar-preview"
                onClick={() => photoInputRef.current?.click()}
                title="Foto auswählen"
              >
                {form.avatar
                  ? <img src={form.avatar} alt="Avatar" />
                  : <div className="contact-avatar-placeholder"><Camera size={20} /></div>
                }
              </div>
              <div className="contact-form-avatar-actions">
                <button className="btn-secondary btn-sm" onClick={() => photoInputRef.current?.click()}>
                  <Camera size={13} /> Foto
                </button>
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => cardInputRef.current?.click()}
                  disabled={ocrLoading}
                >
                  <Scan size={13} />
                  {ocrLoading ? `OCR ${ocrProgress}%` : 'Visitenkarte'}
                </button>
                {form.avatar && (
                  <button className="btn-secondary btn-sm" onClick={() => setForm(f => ({ ...f, avatar: '' }))}>
                    <X size={13} /> Foto entfernen
                  </button>
                )}
              </div>
            </div>
            <input type="file" ref={photoInputRef} accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
            <input type="file" ref={cardInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleCardScan} />

            {/* OCR line picker */}
            {ocrLines.length > 0 && (
              <div className="ocr-picker">
                <div className="ocr-picker-header">
                  <Scan size={13} />
                  <span>Visitenkarte erkannt — Zeile zuweisen:</span>
                  <button className="btn-icon-sm" onClick={() => setOcrLines([])}><X size={12} /></button>
                </div>
                <div className="ocr-picker-lines">
                  {ocrLines.map((line, i) => (
                    <div key={i} className="ocr-line">
                      <span className="ocr-line-text">{line}</span>
                      <div className="ocr-line-btns">
                        <button onClick={() => assignOcrLine(line, 'name')} title="Als Name übernehmen">Name</button>
                        <button onClick={() => assignOcrLine(line, 'company')} title="Als Firma übernehmen">Firma</button>
                        <button onClick={() => assignOcrLine(line, 'email')} title="Als E-Mail übernehmen">Mail</button>
                        <button onClick={() => assignOcrLine(line, 'phone')} title="Als Telefon übernehmen">Tel</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="vault-form">
              <input placeholder="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input placeholder="Firma" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
              <input placeholder="E-Mail" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <input placeholder="Telefon" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <input placeholder="Tags (kommagetrennt)" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
              <textarea
                placeholder="Notizen"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={3}
                style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '12px' }}
              />
              <div className="form-actions">
                <button className="btn-primary" onClick={handleSave}><Check size={14} /> Speichern</button>
                <button className="btn-secondary" onClick={() => setShowForm(false)}>Abbrechen</button>
                {editId && (
                  confirmDeleteId === editId ? (
                    <div className="contact-confirm-delete">
                      <span>Wirklich löschen?</span>
                      <button className="btn-confirm-yes" onClick={() => handleDelete(editId)}>Ja</button>
                      <button className="btn-confirm-no" onClick={() => setConfirmDeleteId(null)}>Nein</button>
                    </div>
                  ) : (
                    <button className="btn-danger btn-sm" onClick={() => confirmDelete(editId)}>
                      <Trash2 size={13} /> Löschen
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        <div className="contact-list">
          {grouped ? (
            grouped.map(([company, members]) => (
              <div key={company} className="contact-group">
                <button className="contact-group-header" onClick={() => toggleGroup(company)}>
                  {collapsedGroups.has(company)
                    ? <ChevronRight size={14} />
                    : <ChevronDown size={14} />
                  }
                  <Building size={13} className="contact-group-icon" />
                  <span className="contact-group-name">{company}</span>
                  <span className="contact-group-count">{members.length}</span>
                </button>
                {!collapsedGroups.has(company) && (
                  <div className="contact-group-members">
                    {members.map(c => renderContact(c, true))}
                  </div>
                )}
              </div>
            ))
          ) : (
            filtered.map(c => renderContact(c))
          )}
          {filtered.length === 0 && (
            <p className="empty-text">{search ? 'Keine Treffer' : 'Noch keine Kontakte'}</p>
          )}
        </div>
      </div>
    </WidgetWrapper>
  );
}

import { useState, useMemo, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import {
  Users, Plus, Search, Trash2, Mail, Phone, Building, Tag,
  Camera, ChevronDown, ChevronRight, X, Check, Scan, Globe, Pencil,
  Image as ImageIcon, Sparkles,
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import jsQR from 'jsqr';
import WidgetWrapper from '../WidgetWrapper';
import { useSupabase } from '../../hooks/useSupabase';
import {
  getAiApiKey, saveAiApiKey,
  extractContactFromText, extractContactFromImage,
  extractCompanyFromText, extractCompanyFromImage,
} from '../../lib/aiExtract';
import type { Contact, Company } from '../../types';

// --- Image helpers ---
function compressToBase64(file: File, size = 80): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const ratio = Math.max(size / img.width, size / img.height);
      const w = img.width * ratio; const h = img.height * ratio;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Bild für KI — behält Seitenverhältnis, max 1024px
function imageToBase64ForAI(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1024;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
    };
    img.onerror = reject;
    img.src = url;
  });
}

function extractOcrLines(text: string): string[] {
  return text.split(/[\n\r]+/).map(l => l.replace(/\s+/g, ' ').trim()).filter(l => {
    if (l.length < 4) return false;
    const letters = (l.match(/[a-zA-ZÄÖÜäöüß]/g) ?? []).length;
    if (letters < 2) return false;
    if (letters / l.length < 0.35) return false;
    return true;
  });
}

function isHeic(file: File): boolean {
  return file.type === 'image/heic' || file.type === 'image/heif' || /\.(heic|heif)$/i.test(file.name);
}

function decodeQrFromFile(file: File): Promise<string | null> {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      resolve(code?.data ?? null);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function parseVCard(text: string): Partial<{ name: string; email: string; phone: string }> | null {
  const result: Partial<{ name: string; email: string; phone: string }> = {};
  if (text.startsWith('MECARD:')) {
    text.replace(/^MECARD:/, '').split(';').forEach(part => {
      const idx = part.indexOf(':'); if (idx === -1) return;
      const key = part.slice(0, idx).trim().toUpperCase();
      const val = part.slice(idx + 1).trim(); if (!val) return;
      if (key === 'N') result.name = val.split(',').reverse().join(' ').trim();
      if (key === 'TEL' && !result.phone) result.phone = val;
      if (key === 'EMAIL' && !result.email) result.email = val.toLowerCase();
    });
    return Object.keys(result).length > 0 ? result : null;
  }
  if (text.includes('BEGIN:VCARD')) {
    text.split(/[\r\n]+/).forEach(line => {
      const idx = line.indexOf(':'); if (idx === -1) return;
      const rawKey = line.slice(0, idx).split(';')[0].toUpperCase();
      const val = line.slice(idx + 1).trim(); if (!val) return;
      if (rawKey === 'FN' && !result.name) result.name = val;
      if (rawKey === 'N' && !result.name) {
        const parts = val.split(';');
        result.name = [parts[1], parts[0]].filter(Boolean).join(' ').trim();
      }
      if (rawKey === 'EMAIL' && !result.email) result.email = val.toLowerCase();
      if (rawKey === 'TEL' && !result.phone) result.phone = val;
    });
    return Object.keys(result).length > 0 ? result : null;
  }
  return null;
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

const EMPTY_CONTACT = { name: '', email: '', phone: '', companyId: '', tags: '', notes: '', avatar: '' };
const EMPTY_COMPANY = { name: '', logo: '', phone: '', email: '', website: '', address: '', notes: '' };

export default function ContactsWidget() {
  const [contacts, setContacts] = useSupabase<Contact>('contacts', []);
  const [companies, setCompanies] = useSupabase<Company>('companies', []);

  type FormMode = 'none' | 'contact' | 'company';
  const [formMode, setFormMode] = useState<FormMode>('none');
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT);
  const [companyForm, setCompanyForm] = useState(EMPTY_COMPANY);
  const [editContactId, setEditContactId] = useState<string | null>(null);
  const [editCompanyId, setEditCompanyId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [confirmDeleteContact, setConfirmDeleteContact] = useState<string | null>(null);
  const [confirmDeleteCompany, setConfirmDeleteCompany] = useState<string | null>(null);

  // OCR state (Kontaktformular)
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrLines, setOcrLines] = useState<string[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);

  // Smart Fill state
  const [showSmartFill, setShowSmartFill] = useState(false);
  const [sfText, setSfText] = useState('');
  const [sfImage, setSfImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [sfImageName, setSfImageName] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(() => !!getAiApiKey());

  // Refs
  const photoRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const sfImgRef = useRef<HTMLInputElement>(null);

  // --- Filtered & grouped data ---
  const q = search.toLowerCase();
  const filteredContacts = useMemo(() => {
    if (!q) return contacts;
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q) ||
      (c.company ?? '').toLowerCase().includes(q) ||
      c.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [contacts, q]);

  const filteredCompanies = useMemo(() => {
    if (!q) return companies;
    const ids = new Set(filteredContacts.filter(c => c.companyId).map(c => c.companyId!));
    return companies.filter(co => co.name.toLowerCase().includes(q) || ids.has(co.id));
  }, [companies, filteredContacts, q]);

  const contactsByCompany = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const c of filteredContacts) {
      const key = c.companyId ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [filteredContacts]);

  const unlinkedContacts = contactsByCompany.get('') ?? [];
  const sortedCompanies = useMemo(() => [...filteredCompanies].sort((a, b) => a.name.localeCompare(b.name)), [filteredCompanies]);
  const sortedCompanyList = useMemo(() => [...companies].sort((a, b) => a.name.localeCompare(b.name)), [companies]);

  const resetSmartFill = () => {
    setShowSmartFill(false);
    setSfText('');
    setSfImage(null);
    setSfImageName('');
    setAiError(null);
  };

  // --- Form openers ---
  const openNewContact = (preCompanyId = '') => {
    setEditContactId(null);
    setContactForm({ ...EMPTY_CONTACT, companyId: preCompanyId });
    setOcrLines([]); setScanError(null);
    resetSmartFill();
    setFormMode('contact');
  };

  const openEditContact = (c: Contact) => {
    setEditContactId(c.id);
    setContactForm({
      name: c.name, email: c.email ?? '', phone: c.phone ?? '',
      companyId: c.companyId ?? '', tags: c.tags.join(', '),
      notes: c.notes ?? '', avatar: c.avatar ?? '',
    });
    setOcrLines([]); setScanError(null);
    resetSmartFill();
    setFormMode('contact');
  };

  const openNewCompany = () => {
    setEditCompanyId(null);
    setCompanyForm(EMPTY_COMPANY);
    resetSmartFill();
    setFormMode('company');
  };

  const openEditCompany = (co: Company) => {
    setEditCompanyId(co.id);
    setCompanyForm({
      name: co.name, logo: co.logo ?? '', phone: co.phone ?? '',
      email: co.email ?? '', website: co.website ?? '',
      address: co.address ?? '', notes: co.notes ?? '',
    });
    resetSmartFill();
    setFormMode('company');
  };

  // --- Save handlers ---
  const saveContact = () => {
    if (!contactForm.name.trim()) return;
    const base: Omit<Contact, 'id' | 'createdAt'> = {
      name: contactForm.name.trim(),
      email: contactForm.email || undefined,
      phone: contactForm.phone || undefined,
      companyId: contactForm.companyId || undefined,
      tags: contactForm.tags ? contactForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      notes: contactForm.notes || undefined,
      avatar: contactForm.avatar || undefined,
    };
    if (editContactId) {
      setContacts(prev => prev.map(c => c.id === editContactId ? { ...c, ...base } : c));
    } else {
      setContacts(prev => [{ id: uuid(), createdAt: Date.now(), ...base }, ...prev]);
    }
    setFormMode('none'); setEditContactId(null);
  };

  const saveCompany = () => {
    if (!companyForm.name.trim()) return;
    const base: Omit<Company, 'id' | 'createdAt'> = {
      name: companyForm.name.trim(),
      logo: companyForm.logo || undefined,
      phone: companyForm.phone || undefined,
      email: companyForm.email || undefined,
      website: companyForm.website || undefined,
      address: companyForm.address || undefined,
      notes: companyForm.notes || undefined,
    };
    if (editCompanyId) {
      setCompanies(prev => prev.map(co => co.id === editCompanyId ? { ...co, ...base } : co));
    } else {
      setCompanies(prev => [{ id: uuid(), createdAt: Date.now(), ...base }, ...prev]);
    }
    setFormMode('none'); setEditCompanyId(null);
  };

  const deleteContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
    setConfirmDeleteContact(null);
    if (editContactId === id) { setFormMode('none'); setEditContactId(null); }
  };

  const deleteCompany = (id: string) => {
    setContacts(prev => prev.map(c => c.companyId === id ? { ...c, companyId: undefined } : c));
    setCompanies(prev => prev.filter(co => co.id !== id));
    setConfirmDeleteCompany(null);
    if (editCompanyId === id) { setFormMode('none'); setEditCompanyId(null); }
  };

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // --- File uploads ---
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { const b64 = await compressToBase64(file, 80); setContactForm(f => ({ ...f, avatar: b64 })); } catch { /* ignore */ }
    e.target.value = '';
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { const b64 = await compressToBase64(file, 100); setCompanyForm(f => ({ ...f, logo: b64 })); } catch { /* ignore */ }
    e.target.value = '';
  };

  const handleCardScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setScanError(null); setOcrLines([]);
    if (isHeic(file)) {
      setScanError('HEIC-Format nicht unterstützt. iPhone: Einstellungen → Kamera → Format → „Maximale Kompatibilität".');
      e.target.value = ''; return;
    }
    setOcrLoading(true); setOcrProgress(0);
    try {
      const qrData = await decodeQrFromFile(file);
      if (qrData) {
        const parsed = parseVCard(qrData);
        if (parsed) {
          setContactForm(f => ({ ...f, name: parsed.name || f.name, email: parsed.email || f.email, phone: parsed.phone || f.phone }));
          setOcrLoading(false); e.target.value = ''; return;
        }
      }
      const result = await Tesseract.recognize(file, 'deu+eng', {
        logger: m => { if (m.status === 'recognizing text') setOcrProgress(Math.round(m.progress * 100)); },
      });
      setOcrLines(extractOcrLines(result.data.text));
    } catch { /* ignore */ }
    setOcrLoading(false); e.target.value = '';
  };

  // --- Smart Fill image upload ---
  const handleSfImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const result = await imageToBase64ForAI(file);
      setSfImage(result);
      setSfImageName(file.name);
      setAiError(null);
    } catch { setAiError('Bild konnte nicht geladen werden.'); }
    e.target.value = '';
  };

  // --- Smart Fill API key save ---
  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim()) return;
    saveAiApiKey(apiKeyInput.trim());
    setHasApiKey(true);
    setApiKeyInput('');
  };

  // --- Smart Fill: AI extraction ---
  const handleSmartFill = async () => {
    const apiKey = getAiApiKey();
    if (!apiKey) { setAiError('Bitte zuerst den Anthropic API Key eingeben.'); return; }
    if (!sfText.trim() && !sfImage) { setAiError('Bitte Text einfügen oder ein Bild hochladen.'); return; }

    setAiLoading(true); setAiError(null);
    try {
      if (formMode === 'contact') {
        const result = sfImage
          ? await extractContactFromImage(sfImage.base64, sfImage.mimeType, apiKey)
          : await extractContactFromText(sfText, apiKey);
        setContactForm(f => ({
          ...f,
          name: result.name || f.name,
          email: result.email || f.email,
          phone: result.phone || f.phone,
          // Firma per Name suchen und companyId setzen
          companyId: result.company
            ? (sortedCompanyList.find(co => co.name.toLowerCase() === result.company!.toLowerCase())?.id ?? f.companyId)
            : f.companyId,
        }));
      } else if (formMode === 'company') {
        const result = sfImage
          ? await extractCompanyFromImage(sfImage.base64, sfImage.mimeType, apiKey)
          : await extractCompanyFromText(sfText, apiKey);
        setCompanyForm(f => ({
          ...f,
          name: result.name || f.name,
          phone: result.phone || f.phone,
          email: result.email || f.email,
          website: result.website || f.website,
          address: result.address || f.address,
        }));
      }
      resetSmartFill();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Fehler bei der KI-Extraktion.');
    }
    setAiLoading(false);
  };

  // --- Smart Fill Panel ---
  const SmartFillPanel = () => (
    <div className="smart-fill-panel">
      <div className="smart-fill-header">
        <Sparkles size={13} />
        <span>KI-Extraktion — Text oder Bild einfügen</span>
        <button className="btn-icon-sm" onClick={resetSmartFill}><X size={12} /></button>
      </div>

      {!hasApiKey && (
        <div className="smart-fill-apikey">
          <input
            type="password"
            placeholder="Anthropic API Key (sk-ant-…)"
            value={apiKeyInput}
            onChange={e => setApiKeyInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveApiKey()}
          />
          <button className="btn-secondary btn-sm" onClick={handleSaveApiKey}>
            <Check size={12} /> Speichern
          </button>
        </div>
      )}

      <textarea
        className="smart-fill-textarea"
        placeholder="E-Mail, Signatur, Text mit Kontaktdaten einfügen…"
        value={sfText}
        onChange={e => setSfText(e.target.value)}
        rows={4}
      />

      <div className="smart-fill-actions">
        <button className="btn-secondary btn-sm" onClick={() => sfImgRef.current?.click()}>
          <Camera size={13} /> {sfImageName || 'Bild hochladen'}
        </button>
        {sfImage && (
          <button className="btn-secondary btn-sm" onClick={() => { setSfImage(null); setSfImageName(''); }}>
            <X size={12} />
          </button>
        )}
        <button
          className="btn-primary btn-sm"
          onClick={handleSmartFill}
          disabled={aiLoading || (!sfText.trim() && !sfImage)}
          style={{ marginLeft: 'auto' }}
        >
          <Sparkles size={13} />
          {aiLoading ? 'Analysiere…' : 'Ausfüllen'}
        </button>
      </div>

      {aiError && (
        <div className="scan-error" style={{ marginTop: '6px' }}>
          <X size={13} /><span>{aiError}</span>
        </div>
      )}
    </div>
  );

  // --- Render contact card ---
  const renderContactCard = (c: Contact, hideCompany = true) => {
    const isConfirmDelete = confirmDeleteContact === c.id;
    return (
      <div key={c.id} className="contact-card">
        <div className="contact-avatar-wrap" onClick={() => openEditContact(c)}>
          {c.avatar
            ? <img src={c.avatar} alt={c.name} className="contact-avatar-img" />
            : <div className="contact-avatar" style={{ background: getAvatarColor(c.name) }}>{getInitials(c.name)}</div>
          }
        </div>
        <div className="contact-info" onClick={() => openEditContact(c)}>
          <strong>{c.name}</strong>
          {!hideCompany && c.companyId && (
            <span className="contact-detail"><Building size={11} /> {companies.find(co => co.id === c.companyId)?.name ?? ''}</span>
          )}
          {!hideCompany && !c.companyId && c.company && (
            <span className="contact-detail"><Building size={11} /> {c.company}</span>
          )}
          {c.email && <span className="contact-detail"><Mail size={11} /> {c.email}</span>}
          {c.phone && <span className="contact-detail"><Phone size={11} /> {c.phone}</span>}
          {c.tags.length > 0 && (
            <div className="contact-tags">
              {c.tags.map(tag => <span key={tag} className="tag"><Tag size={10} /> {tag}</span>)}
            </div>
          )}
        </div>
        {isConfirmDelete ? (
          <div className="contact-confirm-delete">
            <span>Löschen?</span>
            <button className="btn-confirm-yes" onClick={() => deleteContact(c.id)}>Ja</button>
            <button className="btn-confirm-no" onClick={() => setConfirmDeleteContact(null)}>Nein</button>
          </div>
        ) : (
          <button className="btn-icon-sm delete-btn" onClick={() => setConfirmDeleteContact(c.id)}><Trash2 size={12} /></button>
        )}
      </div>
    );
  };

  const isEmpty = sortedCompanies.length === 0 && unlinkedContacts.length === 0;

  return (
    <WidgetWrapper widgetId="contacts" title="Kontakte" icon={<Users size={16} />}>
      <div className="contacts-widget">

        {/* Toolbar */}
        <div className="vault-toolbar">
          <div className="search-box">
            <Search size={14} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen…" />
          </div>
          <button className="btn-icon" onClick={openNewCompany} title="Neue Firma"><Building size={15} /></button>
          <button className="btn-icon" onClick={() => openNewContact()} title="Neuer Kontakt"><Plus size={16} /></button>
        </div>

        {/* === FIRMA FORM === */}
        {formMode === 'company' && (
          <div className="contact-form">
            <div className="contact-form-header">
              <span>{editCompanyId ? 'Firma bearbeiten' : 'Neue Firma'}</span>
              <button className="btn-icon-sm" onClick={() => setFormMode('none')}><X size={14} /></button>
            </div>

            <div className="contact-form-avatar">
              <div className="company-logo-upload" onClick={() => logoRef.current?.click()} title="Logo auswählen">
                {companyForm.logo
                  ? <img src={companyForm.logo} alt="Logo" />
                  : <div className="contact-avatar-placeholder"><ImageIcon size={20} /></div>
                }
              </div>
              <div className="contact-form-avatar-actions">
                <button className="btn-secondary btn-sm" onClick={() => logoRef.current?.click()}>
                  <ImageIcon size={13} /> Logo
                </button>
                {companyForm.logo && (
                  <button className="btn-secondary btn-sm" onClick={() => setCompanyForm(f => ({ ...f, logo: '' }))}>
                    <X size={13} /> Entfernen
                  </button>
                )}
                <button
                  className={`btn-secondary btn-sm${showSmartFill ? ' active' : ''}`}
                  onClick={() => setShowSmartFill(v => !v)}
                  title="KI-Extraktion"
                >
                  <Sparkles size={13} /> Smart Fill
                </button>
              </div>
            </div>

            {showSmartFill && <SmartFillPanel />}

            <div className="vault-form">
              <input placeholder="Firmenname *" value={companyForm.name} onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })} />
              <input placeholder="Telefon" value={companyForm.phone} onChange={e => setCompanyForm({ ...companyForm, phone: e.target.value })} />
              <input placeholder="E-Mail" value={companyForm.email} onChange={e => setCompanyForm({ ...companyForm, email: e.target.value })} />
              <input placeholder="Website" value={companyForm.website} onChange={e => setCompanyForm({ ...companyForm, website: e.target.value })} />
              <input placeholder="Adresse" value={companyForm.address} onChange={e => setCompanyForm({ ...companyForm, address: e.target.value })} />
              <textarea
                placeholder="Notizen"
                value={companyForm.notes}
                onChange={e => setCompanyForm({ ...companyForm, notes: e.target.value })}
                rows={2}
                style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '12px' }}
              />
              <div className="form-actions">
                <button className="btn-primary" onClick={saveCompany}><Check size={14} /> Speichern</button>
                <button className="btn-secondary" onClick={() => setFormMode('none')}>Abbrechen</button>
                {editCompanyId && (
                  confirmDeleteCompany === editCompanyId ? (
                    <div className="contact-confirm-delete">
                      <span>Firma löschen?</span>
                      <button className="btn-confirm-yes" onClick={() => deleteCompany(editCompanyId)}>Ja</button>
                      <button className="btn-confirm-no" onClick={() => setConfirmDeleteCompany(null)}>Nein</button>
                    </div>
                  ) : (
                    <button className="btn-danger btn-sm" onClick={() => setConfirmDeleteCompany(editCompanyId)}>
                      <Trash2 size={13} /> Löschen
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* === KONTAKT FORM === */}
        {formMode === 'contact' && (
          <div className="contact-form">
            <div className="contact-form-header">
              <span>{editContactId ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}</span>
              <button className="btn-icon-sm" onClick={() => setFormMode('none')}><X size={14} /></button>
            </div>

            <div className="contact-form-avatar">
              <div className="contact-form-avatar-preview" onClick={() => photoRef.current?.click()} title="Foto auswählen">
                {contactForm.avatar
                  ? <img src={contactForm.avatar} alt="Avatar" />
                  : <div className="contact-avatar-placeholder"><Camera size={20} /></div>
                }
              </div>
              <div className="contact-form-avatar-actions">
                <button className="btn-secondary btn-sm" onClick={() => photoRef.current?.click()}>
                  <Camera size={13} /> Foto
                </button>
                <button className="btn-secondary btn-sm" onClick={() => cardRef.current?.click()} disabled={ocrLoading}>
                  <Scan size={13} /> {ocrLoading ? `OCR ${ocrProgress}%` : 'Visitenkarte'}
                </button>
                {contactForm.avatar && (
                  <button className="btn-secondary btn-sm" onClick={() => setContactForm(f => ({ ...f, avatar: '' }))}>
                    <X size={13} /> Entfernen
                  </button>
                )}
                <button
                  className={`btn-secondary btn-sm${showSmartFill ? ' active' : ''}`}
                  onClick={() => setShowSmartFill(v => !v)}
                  title="KI-Extraktion"
                >
                  <Sparkles size={13} /> Smart Fill
                </button>
              </div>
            </div>

            {showSmartFill && <SmartFillPanel />}

            {scanError && (
              <div className="scan-error">
                <X size={13} /><span>{scanError}</span>
                <button className="btn-icon-sm" onClick={() => setScanError(null)}><X size={11} /></button>
              </div>
            )}

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
                        <button onClick={() => setContactForm(f => ({ ...f, name: line }))}>Name</button>
                        <button onClick={() => setContactForm(f => ({ ...f, email: line }))}>Mail</button>
                        <button onClick={() => setContactForm(f => ({ ...f, phone: line }))}>Tel</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="vault-form">
              <input placeholder="Name *" value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} />
              <select value={contactForm.companyId} onChange={e => setContactForm({ ...contactForm, companyId: e.target.value })} className="vault-select">
                <option value="">— Ohne Firma —</option>
                {sortedCompanyList.map(co => <option key={co.id} value={co.id}>{co.name}</option>)}
              </select>
              <input placeholder="E-Mail" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} />
              <input placeholder="Telefon" value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} />
              <input placeholder="Tags (kommagetrennt)" value={contactForm.tags} onChange={e => setContactForm({ ...contactForm, tags: e.target.value })} />
              <textarea
                placeholder="Notizen"
                value={contactForm.notes}
                onChange={e => setContactForm({ ...contactForm, notes: e.target.value })}
                rows={3}
                style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '12px' }}
              />
              <div className="form-actions">
                <button className="btn-primary" onClick={saveContact}><Check size={14} /> Speichern</button>
                <button className="btn-secondary" onClick={() => setFormMode('none')}>Abbrechen</button>
                {editContactId && (
                  confirmDeleteContact === editContactId ? (
                    <div className="contact-confirm-delete">
                      <span>Wirklich löschen?</span>
                      <button className="btn-confirm-yes" onClick={() => deleteContact(editContactId)}>Ja</button>
                      <button className="btn-confirm-no" onClick={() => setConfirmDeleteContact(null)}>Nein</button>
                    </div>
                  ) : (
                    <button className="btn-danger btn-sm" onClick={() => setConfirmDeleteContact(editContactId)}>
                      <Trash2 size={13} /> Löschen
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hidden file inputs */}
        <input type="file" ref={photoRef} accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
        <input type="file" ref={cardRef} accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={handleCardScan} />
        <input type="file" ref={logoRef} accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
        <input type="file" ref={sfImgRef} accept="image/*" style={{ display: 'none' }} onChange={handleSfImageUpload} />

        {/* === KONTAKT-LISTE === */}
        <div className="contact-list">
          {sortedCompanies.map(co => {
            const members = contactsByCompany.get(co.id) ?? [];
            const isCollapsed = collapsed.has(co.id);
            const isConfirmDelete = confirmDeleteCompany === co.id;
            return (
              <div key={co.id} className="company-block">
                <div className="company-header">
                  <button className="company-collapse-btn" onClick={() => toggleCollapse(co.id)}>
                    {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                  </button>
                  <div className="company-logo-display" onClick={() => openEditCompany(co)}>
                    {co.logo
                      ? <img src={co.logo} alt={co.name} className="company-logo-img" />
                      : <div className="company-logo-placeholder" style={{ background: getAvatarColor(co.name) }}>{getInitials(co.name)}</div>
                    }
                  </div>
                  <div className="company-info" onClick={() => openEditCompany(co)}>
                    <span className="company-name">{co.name}</span>
                    {(co.phone || co.email || co.website) && (
                      <div className="company-details">
                        {co.phone && <span className="contact-detail"><Phone size={10} /> {co.phone}</span>}
                        {co.email && <span className="contact-detail"><Mail size={10} /> {co.email}</span>}
                        {co.website && <span className="contact-detail"><Globe size={10} /> {co.website}</span>}
                      </div>
                    )}
                  </div>
                  <span className="contact-group-count">{members.length}</span>
                  <button className="btn-icon-sm" onClick={() => openNewContact(co.id)} title="Person hinzufügen"><Plus size={13} /></button>
                  <button className="btn-icon-sm" onClick={() => openEditCompany(co)} title="Firma bearbeiten"><Pencil size={12} /></button>
                  {isConfirmDelete ? (
                    <div className="contact-confirm-delete">
                      <span>Löschen?</span>
                      <button className="btn-confirm-yes" onClick={() => deleteCompany(co.id)}>Ja</button>
                      <button className="btn-confirm-no" onClick={() => setConfirmDeleteCompany(null)}>Nein</button>
                    </div>
                  ) : (
                    <button className="btn-icon-sm" onClick={() => setConfirmDeleteCompany(co.id)}><Trash2 size={12} /></button>
                  )}
                </div>
                {!isCollapsed && members.length > 0 && (
                  <div className="company-members">{members.map(c => renderContactCard(c, true))}</div>
                )}
                {!isCollapsed && members.length === 0 && (
                  <div className="company-empty">
                    <span>Noch keine Personen —&nbsp;</span>
                    <button className="link-btn" onClick={() => openNewContact(co.id)}>Person hinzufügen</button>
                  </div>
                )}
              </div>
            );
          })}

          {unlinkedContacts.length > 0 && (
            <div className="company-block company-block--unlinked">
              <button className="contact-group-header" onClick={() => toggleCollapse('__unlinked__')}>
                {collapsed.has('__unlinked__') ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <Users size={13} className="contact-group-icon" />
                <span className="contact-group-name">Ohne Firma</span>
                <span className="contact-group-count">{unlinkedContacts.length}</span>
              </button>
              {!collapsed.has('__unlinked__') && (
                <div className="company-members">{unlinkedContacts.map(c => renderContactCard(c, false))}</div>
              )}
            </div>
          )}

          {isEmpty && <p className="empty-text">{search ? 'Keine Treffer' : 'Noch keine Kontakte'}</p>}
        </div>
      </div>
    </WidgetWrapper>
  );
}

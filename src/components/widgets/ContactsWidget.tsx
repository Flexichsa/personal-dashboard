import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { Users, Plus, Search, Trash2, Mail, Phone, Building, Tag } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { useSupabase } from '../../hooks/useSupabase';
import type { Contact } from '../../types';

export default function ContactsWidget() {
  const [contacts, setContacts] = useSupabase<Contact>('contacts', []);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', tags: '', notes: '' });

  const handleAdd = () => {
    if (!form.name) return;
    const contact: Contact = {
      id: uuid(),
      name: form.name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      company: form.company || undefined,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
      notes: form.notes || undefined,
      createdAt: Date.now(),
    };
    setContacts(prev => [contact, ...prev]);
    setForm({ name: '', email: '', phone: '', company: '', tags: '', notes: '' });
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(search.toLowerCase()) ||
    c.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#f97316', '#06b6d4'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <WidgetWrapper widgetId="contacts" title="Kontakte" icon={<Users size={16} />}>
      <div className="vault-toolbar">
        <div className="search-box">
          <Search size={14} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen..." />
        </div>
        <button className="btn-icon" onClick={() => setShowForm(!showForm)}><Plus size={16} /></button>
      </div>

      {showForm && (
        <div className="vault-form">
          <input placeholder="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input placeholder="E-Mail" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Telefon" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="Firma" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
          <input placeholder="Tags (kommagetrennt)" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
          <div className="form-actions">
            <button className="btn-primary" onClick={handleAdd}>Speichern</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      <div className="contact-list">
        {filtered.map(contact => (
          <div key={contact.id} className="contact-card">
            <div className="contact-avatar" style={{ background: getAvatarColor(contact.name) }}>
              {getInitials(contact.name)}
            </div>
            <div className="contact-info">
              <strong>{contact.name}</strong>
              {contact.email && <span className="contact-detail"><Mail size={11} /> {contact.email}</span>}
              {contact.phone && <span className="contact-detail"><Phone size={11} /> {contact.phone}</span>}
              {contact.company && <span className="contact-detail"><Building size={11} /> {contact.company}</span>}
              {contact.tags.length > 0 && (
                <div className="contact-tags">
                  {contact.tags.map(tag => <span key={tag} className="tag"><Tag size={10} /> {tag}</span>)}
                </div>
              )}
            </div>
            <button className="btn-icon-sm delete-btn" onClick={() => handleDelete(contact.id)}><Trash2 size={12} /></button>
          </div>
        ))}
        {filtered.length === 0 && <p className="empty-text">{search ? 'Keine Treffer' : 'Noch keine Kontakte'}</p>}
      </div>
    </WidgetWrapper>
  );
}

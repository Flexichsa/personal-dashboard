import { useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import {
  ClipboardList, Plus, Trash2, Upload, Download, ChevronLeft,
  FileImage, FileText, File, FileVideo, FileAudio, Eye, Pencil,
} from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { useSupabase } from '../../hooks/useSupabase';
import { useAuth } from '../../contexts/AuthContext';
import { uploadFile, getSignedUrl, deleteFile } from '../../lib/storage-helpers';
import type { WorkInstruction, WorkAttachment } from '../../types';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <FileImage size={14} />;
  if (type.startsWith('video/')) return <FileVideo size={14} />;
  if (type.startsWith('audio/')) return <FileAudio size={14} />;
  if (type.includes('text') || type.includes('pdf') || type.includes('document')) return <FileText size={14} />;
  return <File size={14} />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

type View = 'list' | 'detail' | 'form';

export default function WorkInstructionsWidget() {
  const [instructions, setInstructions] = useSupabase<WorkInstruction>('work-instructions', []);
  const { user } = useAuth();
  const [view, setView] = useState<View>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formAttachments, setFormAttachments] = useState<WorkAttachment[]>([]);
  const [editId, setEditId] = useState<string | null>(null);

  const selected = instructions.find(i => i.id === selectedId) || null;

  const openNew = () => {
    setEditId(null);
    setFormTitle('');
    setFormDesc('');
    setFormAttachments([]);
    setView('form');
  };

  const openEdit = (instr: WorkInstruction) => {
    setEditId(instr.id);
    setFormTitle(instr.title);
    setFormDesc(instr.description);
    setFormAttachments([...instr.attachments]);
    setView('form');
  };

  const openDetail = (id: string) => {
    setSelectedId(id);
    setView('detail');
  };

  const saveInstruction = () => {
    if (!formTitle.trim()) return;
    const now = Date.now();
    if (editId) {
      setInstructions(prev => prev.map(i =>
        i.id === editId ? { ...i, title: formTitle.trim(), description: formDesc.trim(), attachments: formAttachments, updatedAt: now } : i
      ));
    } else {
      const newInstr: WorkInstruction = {
        id: uuid(),
        title: formTitle.trim(),
        description: formDesc.trim(),
        attachments: formAttachments,
        createdAt: now,
        updatedAt: now,
      };
      setInstructions(prev => [newInstr, ...prev]);
    }
    setView('list');
  };

  const deleteInstruction = async (id: string) => {
    const instr = instructions.find(i => i.id === id);
    setInstructions(prev => prev.filter(i => i.id !== id));
    if (instr) {
      for (const att of instr.attachments) {
        try { await deleteFile('work-instructions', att.storagePath); } catch { /* ignore */ }
      }
    }
    setView('list');
  };

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || !user) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name} ist zu gross (max 50MB)`);
        continue;
      }
      try {
        const id = uuid();
        const storagePath = await uploadFile('work-instructions', user.id, `${id}_${file.name}`, file);
        const att: WorkAttachment = { id, name: file.name, size: file.size, type: file.type, storagePath };
        setFormAttachments(prev => [...prev, att]);
      } catch (err) {
        console.error('Upload error:', err);
        alert(`Upload fehlgeschlagen: ${file.name}`);
      }
    }
    setUploading(false);
  }, [user]);

  const removeAttachment = async (att: WorkAttachment) => {
    setFormAttachments(prev => prev.filter(a => a.id !== att.id));
    try { await deleteFile('work-instructions', att.storagePath); } catch { /* ignore */ }
  };

  const handleDownload = async (att: WorkAttachment) => {
    try {
      const url = await getSignedUrl('work-instructions', att.storagePath);
      const link = document.createElement('a');
      link.href = url;
      link.download = att.name;
      link.click();
    } catch {
      alert('Download fehlgeschlagen');
    }
  };

  const handlePreview = async (att: WorkAttachment) => {
    try {
      const url = await getSignedUrl('work-instructions', att.storagePath);
      if (att.type.startsWith('image/')) {
        setLightboxUrl(url);
      } else {
        window.open(url, '_blank');
      }
    } catch {
      alert('Vorschau fehlgeschlagen');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('drag-over');
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    handleUpload(e.dataTransfer.files);
  };

  // Render attachment row
  const AttachmentRow = ({ att, editable }: { att: WorkAttachment; editable: boolean }) => (
    <div className="wi-att-card">
      <div className="wi-att-icon">{getFileIcon(att.type)}</div>
      <div className="wi-att-info">
        <span className="wi-att-name">{att.name}</span>
        <span className="wi-att-size">{formatSize(att.size)}</span>
      </div>
      <div className="wi-att-actions">
        <button className="btn-icon-sm" onClick={() => handlePreview(att)} title="Vorschau"><Eye size={12} /></button>
        <button className="btn-icon-sm" onClick={() => handleDownload(att)} title="Download"><Download size={12} /></button>
        {editable && (
          <button className="btn-icon-sm delete-btn" onClick={() => removeAttachment(att)} title="Entfernen"><Trash2 size={12} /></button>
        )}
      </div>
    </div>
  );

  return (
    <WidgetWrapper widgetId="work-instructions" title="Arbeitsanweisungen" icon={<ClipboardList size={16} />}>
      {/* Lightbox */}
      {lightboxUrl && (
        <div className="hw-lightbox" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="Vorschau" />
          <button className="hw-lightbox-close" onClick={() => setLightboxUrl(null)}>&times;</button>
        </div>
      )}

      {/* LIST VIEW */}
      {view === 'list' && (
        <>
          <button className="btn-primary wi-add-btn" onClick={openNew}>
            <Plus size={14} /> Neue Anweisung
          </button>
          <div className="wi-list">
            {instructions.map(instr => (
              <div key={instr.id} className="wi-card" onClick={() => openDetail(instr.id)}>
                <div className="wi-card-content">
                  <strong>{instr.title}</strong>
                  {instr.description && <span className="wi-card-desc">{instr.description}</span>}
                  <div className="wi-card-meta">
                    {instr.attachments.length > 0 && (
                      <span className="wi-card-files">
                        <File size={10} /> {instr.attachments.length} Datei{instr.attachments.length !== 1 ? 'en' : ''}
                      </span>
                    )}
                    <span className="wi-card-date">
                      {new Date(instr.updatedAt).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                </div>
                {instr.attachments.some(a => a.type.startsWith('image/')) && (
                  <div className="wi-card-thumb-indicator">
                    <FileImage size={16} />
                  </div>
                )}
              </div>
            ))}
            {instructions.length === 0 && <p className="empty-text">Keine Arbeitsanweisungen</p>}
          </div>
        </>
      )}

      {/* DETAIL VIEW */}
      {view === 'detail' && selected && (
        <div className="wi-detail">
          <div className="wi-detail-top">
            <button className="btn-back" onClick={() => setView('list')}>
              <ChevronLeft size={14} /> Zurück
            </button>
            <div className="wi-detail-actions">
              <button className="btn-icon-sm" onClick={() => openEdit(selected)} title="Bearbeiten"><Pencil size={12} /></button>
              <button className="btn-icon-sm delete-btn" onClick={() => deleteInstruction(selected.id)} title="Löschen"><Trash2 size={12} /></button>
            </div>
          </div>
          <h3 className="wi-detail-title">{selected.title}</h3>
          {selected.description && <p className="wi-detail-desc">{selected.description}</p>}

          {selected.attachments.length > 0 && (
            <div className="wi-attachments">
              <span className="wi-section-label">Anhänge</span>
              {selected.attachments.map(att => (
                <AttachmentRow key={att.id} att={att} editable={false} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* FORM VIEW */}
      {view === 'form' && (
        <div className="wi-form">
          <button className="btn-back" onClick={() => setView('list')}>
            <ChevronLeft size={14} /> Zurück
          </button>
          <input
            placeholder="Titel *"
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
          />
          <textarea
            placeholder="Beschreibung / Anweisungstext..."
            value={formDesc}
            onChange={e => setFormDesc(e.target.value)}
            rows={4}
          />

          <span className="wi-section-label">Dateien & Bilder</span>
          <div
            className="wi-dropzone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload size={18} />
            <p>{uploading ? 'Hochladen...' : 'Dateien hierher ziehen'}</p>
            <label className="btn-secondary upload-btn">
              Durchsuchen
              <input type="file" multiple onChange={e => handleUpload(e.target.files)} hidden disabled={uploading} />
            </label>
          </div>

          {formAttachments.length > 0 && (
            <div className="wi-attachments">
              {formAttachments.map(att => (
                <AttachmentRow key={att.id} att={att} editable />
              ))}
            </div>
          )}

          <button className="btn-primary" onClick={saveInstruction} disabled={!formTitle.trim()}>
            {editId ? 'Speichern' : 'Erstellen'}
          </button>
        </div>
      )}
    </WidgetWrapper>
  );
}

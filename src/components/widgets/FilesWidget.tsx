import { useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { FolderOpen, Trash2, Download, Upload, File, FileText, FileImage, FileVideo, FileAudio } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { useSupabase } from '../../hooks/useSupabase';
import { useAuth } from '../../contexts/AuthContext';
import { uploadFile, getSignedUrl, deleteFile } from '../../lib/storage-helpers';
import type { FileEntry } from '../../types';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB with Supabase Storage

export default function FilesWidget() {
  const [files, setFiles] = useSupabase<FileEntry>('files', []);
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const getIcon = (type: string) => {
    if (type.startsWith('image/')) return <FileImage size={18} />;
    if (type.startsWith('video/')) return <FileVideo size={18} />;
    if (type.startsWith('audio/')) return <FileAudio size={18} />;
    if (type.includes('text') || type.includes('pdf') || type.includes('document')) return <FileText size={18} />;
    return <File size={18} />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleUpload = useCallback(async (uploadedFiles: FileList | null) => {
    if (!uploadedFiles || !user) return;
    setUploading(true);

    for (const file of Array.from(uploadedFiles)) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name} ist zu groß (max 50MB)`);
        continue;
      }
      try {
        const id = uuid();
        const storagePath = await uploadFile('files', user.id, `${id}_${file.name}`, file);
        const entry: FileEntry = {
          id,
          name: file.name,
          size: file.size,
          type: file.type,
          storagePath,
          createdAt: Date.now(),
        };
        setFiles(prev => [entry, ...prev]);
      } catch (err) {
        console.error('Upload error:', err);
        alert(`Upload fehlgeschlagen: ${file.name}`);
      }
    }
    setUploading(false);
  }, [setFiles, user]);

  const handleDownload = async (file: FileEntry) => {
    try {
      const url = await getSignedUrl('files', file.storagePath);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
    } catch (err) {
      console.error('Download error:', err);
      alert('Download fehlgeschlagen');
    }
  };

  const handleDelete = async (file: FileEntry) => {
    setFiles(prev => prev.filter(f => f.id !== file.id));
    try {
      await deleteFile('files', file.storagePath);
    } catch {
      // DB row already removed via hook
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

  return (
    <WidgetWrapper widgetId="files" title="Dateien" icon={<FolderOpen size={16} />}>
      <div
        className="files-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload size={20} />
        <p>{uploading ? 'Hochladen...' : 'Dateien hierher ziehen'}</p>
        <label className="btn-secondary upload-btn">
          Oder durchsuchen
          <input type="file" multiple onChange={e => handleUpload(e.target.files)} hidden disabled={uploading} />
        </label>
      </div>

      <div className="file-list">
        {files.map(file => (
          <div key={file.id} className="file-card">
            <div className="file-icon">{getIcon(file.type)}</div>
            <div className="file-info">
              <span className="file-name">{file.name}</span>
              <span className="file-size">{formatSize(file.size)}</span>
            </div>
            <div className="file-actions">
              <button className="btn-icon-sm" onClick={() => handleDownload(file)} title="Download"><Download size={12} /></button>
              <button className="btn-icon-sm delete-btn" onClick={() => handleDelete(file)} title="Löschen"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
        {files.length === 0 && <p className="empty-text">Keine Dateien</p>}
      </div>
    </WidgetWrapper>
  );
}

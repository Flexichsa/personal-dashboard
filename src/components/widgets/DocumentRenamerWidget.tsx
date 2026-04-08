import { useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import {
  FileSignature, Upload, Download, RotateCcw, Loader, FileText,
  FileImage, Clock, Trash2, AlertCircle, Key
} from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { getAiApiKey, saveAiApiKey, generateDocumentName } from '../../lib/aiExtract';
import {
  fileToBase64, extractTextFromFile, renderPdfToImages,
  extractTextFromDocx, sanitizeFileName, getFileCategory,
  getFileExtension, formatFileSize,
} from '../../lib/documentExtract';
import type { RenameEntry } from '../../types';

type Status = 'idle' | 'extracting' | 'reviewing' | 'done' | 'error';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export default function DocumentRenamerWidget() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [extension, setExtension] = useState('');
  const [history, setHistory] = useLocalStorage<RenameEntry[]>('rename-history', []);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(() => !!getAiApiKey());

  const processFile = useCallback(async (droppedFile: File) => {
    setFile(droppedFile);
    setExtension(getFileExtension(droppedFile.name));
    setError('');

    const apiKey = getAiApiKey();
    if (!apiKey) {
      // Fallback: manueller Modus
      setDate(new Date().toISOString().slice(0, 10));
      setDescription(sanitizeFileName(droppedFile.name.replace(/\.[^.]+$/, '')));
      setStatus('reviewing');
      return;
    }

    setStatus('extracting');
    const category = getFileCategory(droppedFile);

    try {
      let aiContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;

      switch (category) {
        case 'image': {
          setProgress('Bild wird analysiert...');
          const { base64, mimeType } = await fileToBase64(droppedFile);
          aiContent = [{ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }];
          break;
        }
        case 'pdf': {
          setProgress('PDF wird gerendert...');
          const images = await renderPdfToImages(droppedFile, 2);
          aiContent = images.map(img => ({
            type: 'image_url' as const,
            image_url: { url: img },
          }));
          break;
        }
        case 'text': {
          setProgress('Text wird gelesen...');
          const text = await extractTextFromFile(droppedFile);
          aiContent = text || droppedFile.name;
          break;
        }
        case 'docx': {
          setProgress('Dokument wird analysiert...');
          const docText = await extractTextFromDocx(droppedFile);
          aiContent = docText || `Dateiname: ${droppedFile.name}`;
          break;
        }
        default: {
          // Unbekannter Typ: Dateinamen als Kontext verwenden
          aiContent = `Dateiname: ${droppedFile.name}, Typ: ${droppedFile.type}, Größe: ${formatFileSize(droppedFile.size)}`;
        }
      }

      setProgress('KI analysiert Inhalt...');
      const result = await generateDocumentName(aiContent, apiKey);
      setDate(result.date);
      setDescription(sanitizeFileName(result.description));
      setStatus('reviewing');
    } catch (err) {
      console.error('Extraction error:', err);
      setError(err instanceof Error ? err.message : 'Analyse fehlgeschlagen');
      // Fallback auf manuellen Modus
      setDate(new Date().toISOString().slice(0, 10));
      setDescription(sanitizeFileName(droppedFile.name.replace(/\.[^.]+$/, '')));
      setStatus('reviewing');
    }
  }, []);

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
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const f = files[0];
      if (f.size > MAX_FILE_SIZE) {
        setError('Datei zu groß (max 50MB)');
        return;
      }
      processFile(f);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      setError('Datei zu groß (max 50MB)');
      return;
    }
    processFile(f);
  };

  const getNewFileName = () => {
    const ext = extension ? `.${extension}` : '';
    return `${date}_${description}${ext}`;
  };

  const handleDownload = () => {
    if (!file) return;
    const newName = getNewFileName();
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = newName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 200);

    // In Verlauf speichern
    const entry: RenameEntry = {
      id: uuid(),
      originalName: file.name,
      newName,
      fileType: file.type,
      fileSize: file.size,
      createdAt: Date.now(),
    };
    setHistory(prev => [entry, ...prev.slice(0, 19)]);
    setStatus('done');
  };

  const handleReset = () => {
    setFile(null);
    setStatus('idle');
    setProgress('');
    setError('');
    setDate(new Date().toISOString().slice(0, 10));
    setDescription('');
    setExtension('');
  };

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      saveAiApiKey(apiKeyInput.trim());
      setApiKeyInput('');
      setShowApiKey(false);
      setHasApiKey(true);
    }
  };

  const getFileIcon = () => {
    if (!file) return <FileText size={24} />;
    if (file.type.startsWith('image/')) return <FileImage size={24} />;
    return <FileText size={24} />;
  };

  return (
    <WidgetWrapper widgetId="doc-renamer" title="Dok. Umbenennen" icon={<FileSignature size={16} />}>
      {/* API Key Setup */}
      {!hasApiKey && status === 'idle' && (
        <div className="docr-api-notice">
          <AlertCircle size={14} />
          <span>Ohne OpenAI-Key nur manuelle Benennung</span>
          <button className="btn-text" onClick={() => setShowApiKey(!showApiKey)}>
            <Key size={12} /> Key setzen
          </button>
        </div>
      )}
      {showApiKey && (
        <div className="docr-api-input">
          <input
            type="password"
            placeholder="OpenAI API Key"
            value={apiKeyInput}
            onChange={e => setApiKeyInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveApiKey()}
          />
          <button className="btn-primary btn-sm" onClick={handleSaveApiKey}>Speichern</button>
        </div>
      )}

      {/* Idle: Dropzone */}
      {status === 'idle' && (
        <div
          className="docr-dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload size={24} />
          <p>Dokument hierher ziehen</p>
          <label className="btn-secondary upload-btn">
            Oder durchsuchen
            <input type="file" onChange={handleFileInput} hidden />
          </label>
        </div>
      )}

      {/* Extracting: Ladeanzeige */}
      {status === 'extracting' && (
        <div className="docr-loading">
          <Loader size={24} className="spin" />
          <p>{progress}</p>
        </div>
      )}

      {/* Reviewing: Namensvorschlag */}
      {(status === 'reviewing' || status === 'done') && file && (
        <div className="docr-review">
          {error && (
            <div className="docr-error">
              <AlertCircle size={12} />
              <span>{error} — manuell benennen:</span>
            </div>
          )}

          <div className="docr-file-info">
            {getFileIcon()}
            <div>
              <span className="docr-original">{file.name}</span>
              <span className="docr-size">{formatFileSize(file.size)}</span>
            </div>
          </div>

          <div className="docr-arrow">↓</div>

          <div className="docr-name-form">
            <div className="docr-row">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="docr-date"
              />
              <span className="docr-sep">_</span>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(sanitizeFileName(e.target.value))}
                placeholder="beschreibung"
                className="docr-desc"
              />
              <span className="docr-ext">.{extension}</span>
            </div>
            <div className="docr-preview">
              {getNewFileName()}
            </div>
          </div>

          <div className="docr-actions">
            {status === 'reviewing' && (
              <button className="btn-primary" onClick={handleDownload} disabled={!description}>
                <Download size={14} /> Herunterladen
              </button>
            )}
            {status === 'done' && (
              <span className="docr-done">✓ Heruntergeladen</span>
            )}
            <button className="btn-secondary" onClick={handleReset}>
              <RotateCcw size={14} /> Neu
            </button>
          </div>
        </div>
      )}

      {/* Verlauf */}
      {history.length > 0 && (
        <div className="docr-history">
          <div className="docr-history-header">
            <Clock size={12} />
            <span>Verlauf</span>
            <button className="btn-text" onClick={() => setHistory([])}>
              <Trash2 size={10} />
            </button>
          </div>
          <div className="docr-history-list">
            {history.slice(0, 5).map(entry => (
              <div key={entry.id} className="docr-history-item">
                <span className="docr-history-new" title={entry.originalName}>{entry.newName}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </WidgetWrapper>
  );
}

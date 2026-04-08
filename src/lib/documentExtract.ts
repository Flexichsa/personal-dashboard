// Dokument-Inhaltsextraktion für verschiedene Dateitypen
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// PDF.js Worker lokal aus node_modules
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// --- File → Base64 ---
export function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// --- Textdatei lesen ---
export function extractTextFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).slice(0, 3000));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// --- PDF → Bilder (erste Seiten als Base64) ---
export async function renderPdfToImages(file: File, maxPages = 2): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = Math.min(pdf.numPages, maxPages);
  const images: string[] = [];

  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, viewport }).promise;
    images.push(canvas.toDataURL('image/jpeg', 0.8));
    canvas.remove();
  }

  return images;
}

// --- DOCX → Text (w:t Tags aus dem Binary extrahieren) ---
export async function extractTextFromDocx(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const text = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
    // DOCX enthält XML mit <w:t>Text</w:t> Tags — direkt extrahieren
    const matches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    if (!matches) return '';
    const extracted = matches
      .map(m => m.replace(/<[^>]+>/g, ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return extracted.slice(0, 3000);
  } catch {
    return '';
  }
}

// --- Dateiname säubern (Kebab-Case, Umlaute ersetzen) ---
export function sanitizeFileName(name: string): string {
  const result = name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .split('-')
    .slice(0, 5)
    .join('-');
  return result || 'dokument';
}

// --- Dateityp bestimmen ---
export function getFileCategory(file: File): 'image' | 'pdf' | 'text' | 'docx' | 'unknown' {
  const { type, name } = file;
  if (type.startsWith('image/')) return 'image';
  if (type === 'application/pdf') return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  if (
    type.startsWith('text/') ||
    name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv') ||
    name.endsWith('.json') || name.endsWith('.xml') || name.endsWith('.html')
  ) return 'text';
  return 'unknown';
}

// --- Dateiextension extrahieren ---
export function getFileExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop()! : '';
}

// --- Dateigrösse formatieren ---
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

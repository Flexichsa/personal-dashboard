import { useState, useRef, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import Tesseract from 'tesseract.js';
import {
  Cpu, Plus, Search, Trash2, ChevronLeft, Camera, X, Loader, Edit3,
  Smartphone, Laptop, Tablet, Monitor, Watch, Box
} from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import VoiceInputButton from '../VoiceInputButton';
import { useSupabase } from '../../hooks/useSupabase';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { uploadFile, getSignedUrl, deleteFile, dataUrlToBlob } from '../../lib/storage-helpers';
import type { HardwareDevice } from '../../types';

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  smartphone: <Smartphone size={18} />,
  laptop: <Laptop size={18} />,
  tablet: <Tablet size={18} />,
  desktop: <Monitor size={18} />,
  smartwatch: <Watch size={18} />,
  other: <Box size={18} />,
};

const DEVICE_LABELS: Record<string, string> = {
  smartphone: 'Smartphone',
  laptop: 'Laptop',
  tablet: 'Tablet',
  desktop: 'Desktop',
  smartwatch: 'Smartwatch',
  other: 'Sonstiges',
};

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

const MANUFACTURERS = [
  'Apple', 'Samsung', 'Google', 'Huawei', 'Xiaomi', 'OnePlus', 'Sony',
  'LG', 'Motorola', 'Nokia', 'Lenovo', 'Dell', 'HP', 'Asus', 'Acer',
  'Microsoft', 'Razer', 'MSI', 'Gigabyte', 'Intel', 'AMD', 'Nvidia',
  'Logitech', 'Corsair', 'Bose', 'JBL', 'Sennheiser', 'Dyson',
  'Bosch', 'Siemens', 'Philips', 'Panasonic', 'Toshiba', 'Canon',
  'Nikon', 'Fujifilm', 'GoPro', 'DJI', 'Garmin', 'Fitbit',
  'ThinkPad', 'MacBook', 'iPad', 'iPhone', 'Galaxy', 'Pixel',
  // Industrial / Enterprise
  'Emdoor', 'Getac', 'Zebra', 'Honeywell', 'Datalogic', 'Advantech',
  'Casio', 'Unitech', 'CipherLab', 'Bluebird', 'Point Mobile',
  'Newland', 'Urovo', 'iData', 'Chainway', 'SUNMI',
];

// ============================================================
// Bekannte-Geräte-Datenbank: Modellnummer → vollständige Spezifikationen
// Wird nach OCR automatisch abgeglichen um fehlende Felder zu füllen
// ============================================================
interface DeviceSpec {
  name: string;
  manufacturer: string;
  model: string;
  type: HardwareDevice['type'];
  cpu?: string;
  ram?: string;
  storage?: string;
  os?: string;
  screenSize?: string;
  specs?: string;
}

// Patterns that match OCR variations of known models
// Key: regex pattern to match against OCR text, Value: full device specs
const KNOWN_DEVICES: { pattern: RegExp; spec: DeviceSpec }[] = [
  {
    pattern: /EM[\-\s]?IS[\-\s]?19N/i,
    spec: {
      name: 'Emdoor EM-IS19N Rugged Tablet',
      manufacturer: 'Emdoor',
      model: 'EM-IS19N',
      type: 'tablet',
      cpu: 'Intel N150',
      ram: '8GB',
      storage: '128GB',
      os: 'Windows 11 IoT Enterprise',
      screenSize: '10.1" (1200x1920)',
      specs: 'IP67, 700nit, NFC, 2D Scanner, FHD, Hot-Swap Akku',
    },
  },
  {
    // GTS-T10N variants (OCR may read as GT8-T10N, GTS-TION, etc.)
    pattern: /G[T8][S5][\-\s]?T10N/i,
    spec: {
      name: 'Emdoor GTS-T10N Rugged Tablet',
      manufacturer: 'Emdoor',
      model: 'GTS-T10N',
      type: 'tablet',
      cpu: 'Intel N150',
      ram: '8GB',
      storage: '128GB',
      os: 'Windows 11 IoT Enterprise',
      screenSize: '10.1" (1200x1920)',
      specs: 'IP67, 700nit, NFC, 2D Scanner, FHD',
    },
  },
  {
    pattern: /EM[\-\s]?I18N/i,
    spec: {
      name: 'Emdoor EM-I18N Rugged Tablet',
      manufacturer: 'Emdoor',
      model: 'EM-I18N',
      type: 'tablet',
      cpu: 'Intel Celeron N5100',
      ram: '8GB',
      storage: '128GB',
      os: 'Windows 11',
      screenSize: '10.1"',
      specs: 'IP65, Rugged, FHD',
    },
  },
  {
    pattern: /EM[\-\s]?I10A/i,
    spec: {
      name: 'Emdoor EM-I10A Industrial Tablet',
      manufacturer: 'Emdoor',
      model: 'EM-I10A',
      type: 'tablet',
      cpu: 'Intel Core i5/i7',
      ram: '8GB',
      storage: '256GB SSD',
      os: 'Windows 11',
      screenSize: '10.1"',
      specs: 'IP65, Industrial Rugged',
    },
  },
  {
    pattern: /EM[\-\s]?T19/i,
    spec: {
      name: 'Emdoor EM-T19 Android Tablet',
      manufacturer: 'Emdoor',
      model: 'EM-T19',
      type: 'tablet',
      cpu: 'MediaTek Octa-Core',
      ram: '4GB',
      storage: '64GB',
      os: 'Android 14',
      screenSize: '10.1"',
      specs: 'Rugged, 5G, IP67',
    },
  },
];

// Try to match OCR text against known device database
function lookupKnownDevice(ocrText: string): DeviceSpec | null {
  for (const { pattern, spec } of KNOWN_DEVICES) {
    if (pattern.test(ocrText)) {
      return spec;
    }
  }
  return null;
}

// Enrich extraction result with known device specs (fill only missing fields)
function enrichWithKnownDevice(extracted: ExtractedData, knownSpec: DeviceSpec): ExtractedData {
  return {
    name: extracted.name || knownSpec.name,
    manufacturer: extracted.manufacturer || knownSpec.manufacturer,
    model: extracted.model || knownSpec.model,
    cpu: extracted.cpu || knownSpec.cpu,
    ram: extracted.ram || knownSpec.ram,
    storage: extracted.storage || knownSpec.storage,
    os: extracted.os || knownSpec.os,
    screenSize: extracted.screenSize || knownSpec.screenSize,
    specs: extracted.specs || knownSpec.specs,
    imei: extracted.imei,
    serialNumber: extracted.serialNumber,
  };
}

interface ExtractedData {
  imei?: string;
  serialNumber?: string;
  model?: string;
  manufacturer?: string;
  name?: string;
  cpu?: string;
  ram?: string;
  storage?: string;
  os?: string;
  screenSize?: string;
  specs?: string;
}

// Basic IMEI plausibility check (TAC prefix validation)
// First 2 digits = Reporting Body Identifier. "00" is not assigned to any manufacturer.
// Also reject all-zeros and obviously fake patterns.
function isPlausibleImei(digits: string): boolean {
  if (digits.length !== 15) return false;
  if (digits.startsWith('00')) return false;  // No valid TAC starts with 00
  if (/^(.)\1+$/.test(digits)) return false;  // All same digit (e.g., 111111111111111)
  if (digits === '123456789012345') return false; // Test pattern
  return true;
}

// Luhn checksum validation for IMEI (also checks plausibility)
function isValidImei(digits: string): boolean {
  if (!isPlausibleImei(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let d = parseInt(digits[i], 10);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(digits[14], 10);
}

// Clean OCR artifacts from a string (preserve newlines for multi-line parsing!)
function cleanOcrText(s: string): string {
  return s
    .replace(/[|{}[\]\\]/g, '')       // Remove OCR bracket/pipe artifacts
    .replace(/[^\S\n]+/g, ' ')        // Collapse spaces/tabs but KEEP newlines
    .replace(/\n{3,}/g, '\n\n')       // Limit consecutive newlines to 2
    .trim();
}

// Known product name patterns (iPhone 15 Pro, Galaxy S24 Ultra, etc.)
const PRODUCT_PATTERNS = [
  /\b(iPhone\s*\d+\s*(?:Pro\s*Max|Pro|Plus|Mini)?)\b/i,
  /\b(iPad\s*(?:Pro|Air|Mini)?\s*\d*)\b/i,
  /\b(MacBook\s*(?:Pro|Air)?\s*\d*[",]?\s*\d*)\b/i,
  /\b(Galaxy\s*[SZA]\d+\s*(?:Ultra|Plus|\+|FE)?)\b/i,
  /\b(Galaxy\s*(?:Tab|Fold|Flip|Note|Watch)\s*\w*\d*\s*\w*)\b/i,
  /\b(Pixel\s*\d+\s*(?:Pro|a)?)\b/i,
  /\b(Surface\s*(?:Pro|Laptop|Go|Book|Studio)\s*\d*)\b/i,
  /\b(ThinkPad\s*[TXLPEW]\d+\s*\w*)\b/i,
  /\b(XPS\s*\d+)\b/i,
  /\b(Watch\s*(?:Ultra|SE|Series)\s*\d*)\b/i,
  /\b(AirPods?\s*(?:Pro|Max)?(?:\s*\d)?)\b/i,
];

// Model number patterns (manufacturer-specific codes)
const MODEL_NUMBER_PATTERNS = [
  // Apple: A + 4 digits
  /\b(A\d{4})\b/,
  // Samsung: SM- prefix
  /\b(SM-[A-Z]\d{3,4}[A-Z]?)\b/i,
  // Huawei: various patterns
  /\b((?:ELS|VOG|ANA|NOH|ABR|CDY|DUB|MAR|STK|JNY|BMH|NTN|ALN|CET)-[A-Z0-9]{2,6})\b/i,
  // Google Pixel: G + alphanumeric
  /\b(G[A-Z0-9]{3,5})\b/,
  // Lenovo ThinkPad model IDs
  /\b(\d{4}-[A-Z0-9]{3,7})\b/,
  // Generic: Model + alphanumeric code
  /(?:Model|Modell|Model\s*(?:Number|No\.?|Nr\.?|#))\s*[:/.]?\s*([A-Za-z0-9][\w\-/.]{2,25})/i,
];

// Parse key:value pairs from OCR text
// Handles "Key: Value", "Key:Value", "Key; Value" and comma-separated fields on one line
function parseKeyValuePairs(text: string): Record<string, string> {
  const pairs: Record<string, string> = {};
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Strip leading non-alpha noise (OCR artifacts like ": " or "* " before keys)
    const cleanedLine = line.replace(/^[^A-Za-z]+/, '');

    // First try: comma-separated key:value pairs on one line
    // e.g. "CPU:N150, OS:WIN 11I, RAM/ROM:8GB/128GB"
    const segments = cleanedLine.split(/,\s*/);
    for (const seg of segments) {
      // Also strip leading noise from each segment
      const cleanSeg = seg.replace(/^[^A-Za-z]+/, '');
      const m = cleanSeg.match(/^([A-Za-z][A-Za-z0-9 /]{0,20}?)\s*[:;]\s*(.+)$/);
      if (m) {
        const key = m[1].trim().toUpperCase().replace(/\s+/g, ' ');
        // Clean value: remove trailing OCR garbage (non-alphanumeric trailing chars)
        const val = m[2].trim().replace(/[^A-Za-z0-9/\-. ]+$/, '').trim();
        if (val) pairs[key] = val;
      }
    }

    // Also try: key on this line, value on the next line
    // e.g. "SN;" followed by "19NWBB8D2NFA25K0433"
    const labelOnly = line.match(/^([A-Za-z][A-Za-z0-9 /]{0,15}?)\s*[:;]\s*$/);
    if (labelOnly && i + 1 < lines.length) {
      const key = labelOnly[1].trim().toUpperCase().replace(/\s+/g, ' ');
      const nextLine = lines[i + 1].trim();
      // Only use if next line looks like a value (not another key:value)
      if (nextLine && !nextLine.match(/^[A-Za-z]+\s*[:;]/)) {
        pairs[key] = nextLine;
      }
    }
  }
  return pairs;
}

function extractDataFromText(rawText: string): ExtractedData {
  const result: ExtractedData = {};
  const text = cleanOcrText(rawText);
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const fullText = lines.join('\n');

  // DEBUG: Log OCR output for troubleshooting
  console.log('[OCR] === RAW TEXT ===');
  console.log(rawText);
  console.log('[OCR] === CLEANED TEXT ===');
  console.log(text);
  console.log('[OCR] === LINES ===');
  lines.forEach((l, i) => console.log(`[OCR] Line ${i}: "${l}"`));

  // --- Parse key:value pairs from label format ---
  const kv = parseKeyValuePairs(text);
  console.log('[OCR] === KEY-VALUE PAIRS ===', JSON.stringify(kv, null, 2));

  // --- IMEI extraction ---
  // IMEI = genau 15 Ziffern, OCR kann diese über mehrere Zeilen verteilen

  // Helper: extract all digit groups from text, concatenate nearby ones
  const extractImeiCandidates = (block: string): string[] => {
    const candidates: string[] = [];
    // Direct 15-digit sequences (ideal case)
    const direct = block.match(/\d{15}/g) || [];
    candidates.push(...direct);
    // Digit sequences with spaces/dashes/dots between them
    const spaced = block.match(/\d[\d\s\-.\|]{12,25}\d/g) || [];
    for (const seq of spaced) {
      const digits = seq.replace(/[^\d]/g, '');
      if (digits.length >= 15) candidates.push(digits.slice(0, 15));
      if (digits.length === 15) candidates.push(digits);
    }
    // Concatenate ALL digits in the block
    const allDigits = block.replace(/[^\d]/g, '');
    if (allDigits.length >= 15) {
      for (let i = 0; i <= allDigits.length - 15; i++) {
        candidates.push(allDigits.slice(i, i + 15));
      }
    }
    return [...new Set(candidates)].filter(d => d.length === 15);
  };

  // Strategy 1: KV-based IMEI
  const kvImei = kv['IMEI'] || kv['IMEI1'] || kv['IMEI 1'];
  if (kvImei) {
    const digits = kvImei.replace(/[^\d]/g, '');
    console.log('[OCR] IMEI Strategy 1 (KV): found value =', kvImei, '→ digits =', digits);
    if (digits.length === 15 && isPlausibleImei(digits)) result.imei = digits;
    else if (digits.length > 15) {
      const d15 = digits.slice(0, 15);
      if (isValidImei(d15)) result.imei = d15;
      else if (isPlausibleImei(d15)) result.imei = d15; // Accept without Luhn but must be plausible
    }
    // Also accept shorter digit strings that might be split — search next KV entries
    if (!result.imei && digits.length >= 10) {
      // Try to find remaining digits in the next line after IMEI label
      for (let i = 0; i < lines.length; i++) {
        if (/IMEI/i.test(lines[i])) {
          const block = lines.slice(i, i + 3).join(' ');
          const allD = block.replace(/[^\d]/g, '');
          if (allD.length >= 15) {
            result.imei = allD.slice(0, 15);
            break;
          }
        }
      }
    }
  }

  // Strategy 2: Multi-line IMEI (find "IMEI" label, search nearby lines)
  if (!result.imei) {
    for (let i = 0; i < lines.length; i++) {
      if (/IMEI/i.test(lines[i])) {
        const searchBlock = lines.slice(i, i + 5).join(' ');
        console.log('[OCR] IMEI Strategy 2 (multi-line): label at line', i, 'block =', searchBlock);
        const candidates = extractImeiCandidates(searchBlock);
        console.log('[OCR] IMEI Strategy 2 candidates:', candidates);
        const valid = candidates.find(d => isValidImei(d));
        if (valid) { result.imei = valid; break; }
        // Accept near IMEI label without Luhn, but must be plausible
        const plausible = candidates.find(d => isPlausibleImei(d));
        if (plausible) { result.imei = plausible; break; }
      }
    }
  }

  // Strategy 3: Any line containing exactly 15 digits BUT only if there's an IMEI label in the text
  if (!result.imei && /IMEI/i.test(fullText)) {
    for (const line of lines) {
      const digitsOnly = line.replace(/[^\d]/g, '');
      if (digitsOnly.length === 15 && isPlausibleImei(digitsOnly)) {
        console.log('[OCR] IMEI Strategy 3 (line with 15 digits near IMEI label):', line, '→', digitsOnly);
        result.imei = digitsOnly;
        break;
      }
    }
  }

  // Strategy 4: Any 15-digit sequence in entire text, but ONLY with Luhn validation
  // (Without label context, we must be strict to avoid picking up model numbers)
  if (!result.imei) {
    const candidates = extractImeiCandidates(fullText);
    console.log('[OCR] IMEI Strategy 4 (full text, Luhn-only):', candidates.slice(0, 5));
    const valid = candidates.find(d => isValidImei(d));
    if (valid) result.imei = valid;
    // Do NOT accept without Luhn here — too risky for false positives
  }

  // Strategy 5: Concatenate digit groups — ONLY with Luhn validation
  if (!result.imei) {
    const digitGroups = fullText.match(/\d{2,}/g) || [];
    console.log('[OCR] IMEI Strategy 5 (digit groups):', digitGroups);
    const concat = digitGroups.join('');
    if (concat.length >= 15) {
      // Only accept Luhn-valid sequences (strict — avoids false positives from model numbers)
      for (let i = 0; i <= concat.length - 15; i++) {
        const sub = concat.slice(i, i + 15);
        if (isValidImei(sub)) { result.imei = sub; break; }
      }
    }
  }

  console.log('[OCR] === IMEI RESULT ===', result.imei || 'NOT FOUND');

  // --- Serial Number extraction ---
  // Helper: validate SN candidate (must be mixed alpha+digit, not a known keyword/model)
  const isValidSN = (s: string): boolean => {
    if (s.length < 6 || s.length > 30) return false;
    if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return false;
    if (s === result.imei) return false;
    if (s === result.model?.replace(/[^A-Za-z0-9]/g, '')) return false;
    if (/^(PUNO|NANI|SPEC|MODE|IMEI|CPU|RAM|ROM|OS|MODEL|GTS|Standard|FHD|NFC)/i.test(s)) return false;
    if (/^G[T8][S5]T/i.test(s)) return false;  // Model number pattern
    if (/^EM[A-Z]/i.test(s)) return false;      // Emdoor model pattern
    return true;
  };

  // Strategy 1 (HIGHEST PRIORITY): KV-based SN — most reliable for labeled data
  if (!result.serialNumber) {
    const kvSn = kv['SN'] || kv['S/N'] || kv['SERIAL'] || kv['SERIAL NUMBER'] || kv['SERIENNUMMER'] || kv['SERIEN NR'];
    if (kvSn) {
      const cleaned = kvSn.replace(/[^A-Za-z0-9\-]/g, '');
      console.log('[OCR] SN Strategy 1 (KV):', kvSn, '→', cleaned);
      if (isValidSN(cleaned)) {
        result.serialNumber = cleaned.toUpperCase();
      }
    }
  }

  // Strategy 2: Direct regex — find "SN:" or "S/N:" followed by value on same line
  if (!result.serialNumber) {
    for (const line of lines) {
      const m = line.match(/(?:S\/?N|Serial\s*(?:Number|No\.?|Nr\.?)?|Serien\s*(?:nummer|nr\.?)?)\s*[;:,.]\s*([A-Za-z0-9][A-Za-z0-9\-]{5,29})/i);
      if (m) {
        const candidate = m[1].replace(/[^A-Za-z0-9\-]/g, '');
        console.log('[OCR] SN Strategy 2 (same-line regex):', candidate);
        if (isValidSN(candidate)) {
          result.serialNumber = candidate.toUpperCase();
          break;
        }
      }
    }
  }

  // Strategy 3: SN label found, value on next line(s)
  if (!result.serialNumber) {
    for (let i = 0; i < lines.length; i++) {
      const isSNLine = /\bS\/?N\b/i.test(lines[i]) ||
          /\bSerial/i.test(lines[i]) ||
          /\bSerien/i.test(lines[i]);

      if (isSNLine) {
        console.log('[OCR] SN Strategy 3: label at line', i, ':', lines[i]);
        // Try everything after the label on same line
        const afterLabel = lines[i].replace(/.*(?:S\/?N|Serial\s*(?:Number|No\.?)?|Serien\s*(?:nummer|nr\.?)?)\s*[;:,.\s]*/i, '').trim();
        if (afterLabel) {
          const cleaned = afterLabel.replace(/[^A-Za-z0-9\-]/g, '');
          console.log('[OCR] SN Strategy 3 after-label:', cleaned);
          if (isValidSN(cleaned)) {
            result.serialNumber = cleaned.toUpperCase();
            break;
          }
        }
        // Search next 4 lines
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const candidate = lines[j].replace(/[^A-Za-z0-9\-]/g, '');
          console.log('[OCR] SN Strategy 3 next-line (line', j, '):', candidate);
          if (isValidSN(candidate)) {
            result.serialNumber = candidate.toUpperCase();
            break;
          }
        }
        if (result.serialNumber) break;
      }
    }
  }

  // Strategy 4: Scan lines near SN/Serial labels for SN-like tokens
  if (!result.serialNumber) {
    for (let i = 0; i < lines.length; i++) {
      if (/S\/?N|[Ss]erial|[Ss]erien/i.test(lines[i])) {
        for (let j = i; j < Math.min(i + 3, lines.length); j++) {
          const tokens = lines[j].match(/\b[A-Za-z0-9][A-Za-z0-9\-]{5,29}\b/g) || [];
          for (const token of tokens) {
            const clean = token.replace(/[^A-Za-z0-9]/g, '');
            if (isValidSN(clean)) {
              console.log('[OCR] SN Strategy 4: found token =', clean, 'on line', j);
              result.serialNumber = clean.toUpperCase();
              break;
            }
          }
          if (result.serialNumber) break;
        }
        if (result.serialNumber) break;
      }
    }
  }

  // Strategy 5: Find long alphanumeric token — ONLY if SN label exists in text
  // Without label context, this produces too many false positives (model numbers, product codes)
  if (!result.serialNumber && /(?:S\/?N|[Ss]erial|[Ss]erien)/i.test(fullText)) {
    const allTokens = fullText.match(/\b[A-Za-z0-9][A-Za-z0-9\-]{7,29}\b/g) || [];
    for (const token of allTokens) {
      const clean = token.replace(/[^A-Za-z0-9]/g, '');
      if (clean.length >= 8 && clean.length <= 30
          && /[A-Za-z]/.test(clean) && /\d/.test(clean)
          && clean !== result.imei
          && clean !== result.model
          && !/^(PUNO|NANI|SPEC|MODE|IMEI|CPU|RAM|ROM|OS|MODEL|SERIAL|NUMBER|GTS|Standard)/i.test(clean)
          && !/^[A-Z]{2,5}$/.test(clean)
          && !/^G[T8][S5]-?T/i.test(clean)  // Exclude model number patterns
          && !/^EM-?[A-Z]/i.test(clean)) {   // Exclude Emdoor model patterns
        console.log('[OCR] SN Strategy 5 (broad token scan):', clean);
        result.serialNumber = clean.toUpperCase();
        break;
      }
    }
  }

  console.log('[OCR] === SN RESULT ===', result.serialNumber || 'NOT FOUND');

  // --- Model extraction ---
  // From key-value pairs (highest priority for labeled data)
  const kvModel = kv['MODEL'] || kv['MODELL'] || kv['MODEL NO'] || kv['MODEL NR'] || kv['MODEL NUMBER'];
  if (kvModel) {
    // Extract just the model code (alphanumeric with hyphens), ignore trailing OCR noise
    const modelMatch = kvModel.match(/^([A-Za-z0-9][A-Za-z0-9\-]{2,25})/);
    result.model = modelMatch ? modelMatch[1] : kvModel;
  }

  // Fallback: pattern-based extraction
  if (!result.model) {
    for (const pattern of MODEL_NUMBER_PATTERNS) {
      const match = fullText.match(pattern);
      if (match) {
        result.model = match[1].trim();
        break;
      }
    }
  }

  // --- CPU extraction ---
  const kvCpu = kv['CPU'] || kv['PROCESSOR'] || kv['PROZESSOR'];
  if (kvCpu) {
    // Clean CPU value: take only the relevant part (e.g. "N150" from "N150 865 CRRA...")
    // If it starts with a known CPU prefix, extract just that
    const cpuClean = kvCpu.match(/^((?:Intel\s+)?[NJ]\d{3,4}|Intel\s+Core\s+i[3579][\w\-]*|AMD\s+\w+|Qualcomm\s+\w+|Apple\s+M\d)/i);
    result.cpu = cpuClean ? cpuClean[1].trim() : kvCpu.split(/\s+/).slice(0, 2).join(' '); // Max 2 words from KV
  }
  if (!result.cpu) {
    // Pattern matching for common CPU names
    const cpuPatterns = [
      /\b(Intel\s+(?:Core\s+)?(?:i[3579]|N\d{3,4}|Celeron|Pentium|Atom)[\w\s\-]*?)\b/i,
      /\b(AMD\s+(?:Ryzen|Athlon|A\d)[\w\s\-]*?)\b/i,
      /\b(Qualcomm\s+Snapdragon\s*\d+)\b/i,
      /\b(Apple\s+(?:M[1-4]|A\d+)[\w\s]*?)\b/i,
      /\b(MediaTek\s+(?:Dimensity|Helio)[\w\s\-]*?)\b/i,
      /\b(Exynos\s*\d+)\b/i,
      // Short labels like "N150" — only match near CPU context words
      /(?:CPU|Intel|Processor)[^A-Za-z]*\b([NJ]\d{3,4})\b/i,
    ];
    for (const p of cpuPatterns) {
      const m = fullText.match(p);
      if (m) {
        result.cpu = m[1].trim();
        break;
      }
    }
  }

  // --- RAM extraction ---
  const kvRam = kv['RAM'] || kv['RAM/ROM'] || kv['MEMORY'];
  if (kvRam) {
    // Might be "8GB/128GB" format — split into RAM and Storage
    const ramRomMatch = kvRam.match(/(\d+\s*(?:GB|MB|TB))\s*\/\s*(\d+\s*(?:GB|MB|TB))/i);
    if (ramRomMatch) {
      result.ram = ramRomMatch[1].replace(/\s+/g, '');
      result.storage = ramRomMatch[2].replace(/\s+/g, '');
    } else {
      result.ram = kvRam;
    }
  }
  if (!result.ram) {
    // Pattern: "8GB RAM" or "Intel N150 8GB" — also handle OCR errors like "8Gg"
    const ramPatterns = [
      /\b(\d+\s*(?:GB|Gg|MB|TB))\s*(?:RAM|DDR\d?|LPDDR\d?)\b/i,
      /(?:RAM|Arbeitsspeicher)\s*[:/]?\s*(\d+\s*(?:GB|Gg|MB|TB))/i,
      // Standalone number + GB near CPU mention
      /\b(\d+)\s*(?:GB|Gg)\b/i,
    ];
    for (const p of ramPatterns) {
      const m = fullText.match(p);
      if (m) {
        result.ram = m[1].replace(/\s+/g, '');
        break;
      }
    }
  }

  // --- Storage extraction (if not already from RAM/ROM) ---
  if (!result.storage) {
    const kvStorage = kv['ROM'] || kv['STORAGE'] || kv['SPEICHER'] || kv['SSD'] || kv['HDD'];
    if (kvStorage) {
      result.storage = kvStorage;
    } else {
      const storagePatterns = [
        /(?:ROM|Storage|Speicher|SSD|HDD|eMMC|NVMe)\s*[:/]?\s*(\d+\s*(?:GB|TB|MB))/i,
        /\b(\d+\s*(?:GB|TB))\s*(?:SSD|HDD|eMMC|NVMe|Storage|ROM)\b/i,
      ];
      for (const p of storagePatterns) {
        const m = fullText.match(p);
        if (m) {
          result.storage = m[1].replace(/\s+/g, '');
          break;
        }
      }
    }
  }

  // --- OS extraction ---
  const kvOs = kv['OS'] || kv['OPERATING SYSTEM'] || kv['BETRIEBSSYSTEM'];
  if (kvOs) {
    result.os = kvOs;
  }
  if (!result.os) {
    const osPatterns = [
      /\b(Windows\s*1[01]\s*(?:Pro|Home|Enterprise|IoT\s*Enterprise|IoT|LTSC|[A-Z])*)/i,
      /\b(WIN\s*1[01]\s*(?:IOT|PRO|HOME|ENT|[A-Z])*)/i,
      // OCR may read W11I or W11/ for "Windows 11 IoT"
      /\b(W1[01][\/I]\b)/i,
      /\b(Android\s*\d+[\d.]*)/i,
      /\b(iOS\s*\d+[\d.]*)/i,
      /\b(macOS\s*\d+[\d.]*(?:\s*\w+)?)/i,
      /\b(Chrome\s*OS)/i,
      /\b(Linux\s*\w*)/i,
      /\b(HarmonyOS\s*[\d.]*)/i,
    ];
    for (const p of osPatterns) {
      const m = fullText.match(p);
      if (m) {
        let osVal = m[1].trim();
        // Normalize short OS labels to readable format
        if (/^WIN\s*11\s*I/i.test(osVal) || /^W11[\/I]$/i.test(osVal)) {
          osVal = 'Windows 11 IoT';
        } else if (/^WIN\s*10\s*I/i.test(osVal) || /^W10[\/I]$/i.test(osVal)) {
          osVal = 'Windows 10 IoT';
        } else if (/^WIN\s*11/i.test(osVal)) {
          osVal = osVal.replace(/^WIN/i, 'Windows');
        } else if (/^WIN\s*10/i.test(osVal)) {
          osVal = osVal.replace(/^WIN/i, 'Windows');
        }
        result.os = osVal;
        break;
      }
    }
  }

  // --- Screen Size extraction ---
  const screenPatterns = [
    /\b(\d+[\.,]\d+)\s*["''″]\s*(?:Tab|Tablet|Display|Screen|FHD|HD|IPS|LCD|OLED|AMOLED)/i,
    /(?:Display|Screen|Bildschirm)\s*[:/]?\s*(\d+[\.,]\d+\s*["''″])/i,
    /\b(\d+[\.,]\d+)\s*["''″]\b/,
    // Resolution patterns like "1200*1920" or "1920x1080"
    /\b(\d{3,4}\s*[*xX×]\s*\d{3,4})\b/,
  ];
  for (const p of screenPatterns) {
    const m = fullText.match(p);
    if (m) {
      const val = m[1].replace(',', '.');
      // If it looks like a resolution, add it as screenSize
      if (/\d+[*xX×]\d+/.test(val)) {
        result.screenSize = (result.screenSize ? result.screenSize + ' ' : '') + val.replace(/\s+/g, '');
      } else {
        result.screenSize = val + '"';
      }
      break;
    }
  }

  // --- Specs / extra info extraction ---
  const kvSpec = kv['SPEC'] || kv['SPECS'] || kv['SPECIFICATION'];
  if (kvSpec) {
    result.specs = kvSpec;
  }

  // --- Product Code / Model extraction (broader patterns for industrial devices) ---
  // Look for product codes like "GTS-T10N-W11I-1288-2D", "EM-IS19N", "GT8-T10N-W11/-1288-2D"
  if (!result.model) {
    const productCodePatterns = [
      // Multi-segment: EM-IS19N, GTS-T10N-W11I-1288-2D, GT8-T10N...
      /\b([A-Z][A-Z0-9]{1,4}[\-][A-Z0-9]{2,6}(?:[\-][A-Z0-9/]{2,6})*)\b/i,
      // Short codes like EM-IS19N at line start
      /^([A-Z]{2,4}[\-][A-Z0-9]{3,8})/im,
    ];
    for (const p of productCodePatterns) {
      const m = fullText.match(p);
      if (m && m[1].length >= 5 && m[1].includes('-')) {
        // Clean OCR artifacts from model (remove trailing slashes, fix common OCR swaps)
        let model = m[1]
          .replace(/[/\\|]$/g, '')    // trailing slash/pipe
          .replace(/[/\\|]/g, 'I')    // mid-string slash → I (common OCR error for I)
          .replace(/\s+/g, '');       // no spaces in model codes
        result.model = model;
        break;
      }
    }
  }

  // --- Product Name (device name) extraction ---
  for (const pattern of PRODUCT_PATTERNS) {
    const match = fullText.match(pattern);
    if (match) {
      result.name = match[1].trim();
      break;
    }
  }

  // Fallback: Look for descriptive lines like "10.1" Tablet Windows 11 IoT 2D"
  if (!result.name) {
    const descPatterns = [
      /\b(\d+[\.,]\d+\s*["''″]?\s*(?:Tablet|Laptop|Notebook|Desktop|Phone|Smartphone)[\w\s]*)/i,
    ];
    for (const p of descPatterns) {
      const m = fullText.match(p);
      if (m) {
        result.name = m[1].trim();
        break;
      }
    }
  }

  // --- Manufacturer extraction ---
  // Priority 1: Infer from model prefix (most reliable for industrial devices)
  if (!result.manufacturer && result.model) {
    const m = result.model.toUpperCase();
    if (m.startsWith('A') && /^A\d{4}$/.test(m)) result.manufacturer = 'Apple';
    else if (m.startsWith('SM-')) result.manufacturer = 'Samsung';
    else if (/^EM[\-]/.test(m)) result.manufacturer = 'Emdoor';
    else if (/^G[T8][S5][\-]/.test(m)) result.manufacturer = 'Emdoor';
    else if (m.startsWith('GTS-') || m.startsWith('GT8-')) result.manufacturer = 'Emdoor';
  }

  // Priority 2: Infer from product name / model keywords
  if (!result.manufacturer) {
    const combinedText = [result.name, result.model, fullText].filter(Boolean).join(' ').toLowerCase();
    if (combinedText.includes('iphone') || combinedText.includes('ipad') || combinedText.includes('macbook') || combinedText.includes('airpod')) {
      result.manufacturer = 'Apple';
    } else if (combinedText.includes('galaxy') || /\bsm-/i.test(combinedText)) {
      result.manufacturer = 'Samsung';
    } else if (combinedText.includes('pixel')) {
      result.manufacturer = 'Google';
    } else if (combinedText.includes('surface')) {
      result.manufacturer = 'Microsoft';
    } else if (combinedText.includes('thinkpad')) {
      result.manufacturer = 'Lenovo';
    } else if (combinedText.includes('xps')) {
      result.manufacturer = 'Dell';
    } else if (combinedText.includes('emdoor') || /\bem[\-]?is?\d/i.test(combinedText) || /gts[\-]t/i.test(combinedText)) {
      result.manufacturer = 'Emdoor';
    }
  }

  // Priority 3: Direct text match against known brands
  // EXCLUDE pure component manufacturers (Intel, AMD, Nvidia) — these are CPU makers, not device manufacturers
  const CPU_ONLY_BRANDS = new Set(['INTEL', 'AMD', 'NVIDIA', 'QUALCOMM', 'MEDIATEK', 'EXYNOS']);
  if (!result.manufacturer) {
    const upperText = fullText.toUpperCase();
    const normalized = upperText
      .replace(/0/g, 'O')
      .replace(/1/g, 'I')
      .replace(/5/g, 'S');

    for (const mfr of MANUFACTURERS) {
      const upper = mfr.toUpperCase();
      if (CPU_ONLY_BRANDS.has(upper)) continue; // Skip CPU-only brands for device manufacturer
      if (upperText.includes(upper)) {
        result.manufacturer = mfr;
        break;
      }
      const normalizedMfr = upper.replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S');
      if (normalized.includes(normalizedMfr)) {
        result.manufacturer = mfr;
        break;
      }
    }
  }

  // --- Heuristic: Detect device type from context ---
  // (useful for auto-selecting type in form, but stored via name/specs for now)

  return result;
}

export default function HardwareWidget() {
  const [devices, setDevices] = useSupabase<HardwareDevice>('hardware-devices', []);
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cache for signed URLs
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // null = new device, string = editing existing device by ID
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    type: 'smartphone' as HardwareDevice['type'],
    assignedTo: '',
    manufacturer: '',
    model: '',
    imei: '',
    serialNumber: '',
    cpu: '',
    ram: '',
    storage: '',
    os: '',
    screenSize: '',
    specs: '',
    purchaseDate: '',
    warrantyUntil: '',
    notes: '',
    photoPaths: [] as string[],
    photoDataUrls: [] as string[],
  });

  const resetForm = () => {
    setForm({
      name: '', type: 'smartphone', assignedTo: '', manufacturer: '', model: '',
      imei: '', serialNumber: '', cpu: '', ram: '', storage: '', os: '',
      screenSize: '', specs: '', purchaseDate: '', warrantyUntil: '',
      notes: '', photoPaths: [], photoDataUrls: [],
    });
    setShowForm(false);
    setEditingDeviceId(null);
    setScanResult(null);
  };

  const startEditing = (device: HardwareDevice) => {
    setForm({
      name: device.name,
      type: device.type,
      assignedTo: device.assignedTo || '',
      manufacturer: device.manufacturer || '',
      model: device.model || '',
      imei: device.imei || '',
      serialNumber: device.serialNumber || '',
      cpu: device.cpu || '',
      ram: device.ram || '',
      storage: device.storage || '',
      os: device.os || '',
      screenSize: device.screenSize || '',
      specs: device.specs || '',
      purchaseDate: device.purchaseDate || '',
      warrantyUntil: device.warrantyUntil || '',
      notes: device.notes || '',
      photoPaths: device.photoPaths || [],
      photoDataUrls: [],
    });
    setEditingDeviceId(device.id);
    setSelectedDevice(null);
    setShowForm(true);
  };

  // Load signed URLs for detail view and edit form
  useEffect(() => {
    // Collect all photo paths that need signed URLs
    const pathsToLoad: string[] = [];

    // From detail view
    const detail = selectedDevice ? devices.find(d => d.id === selectedDevice) : null;
    if (detail) pathsToLoad.push(...detail.photoPaths);

    // From edit form (existing photos)
    if (editingDeviceId && form.photoPaths.length > 0) {
      pathsToLoad.push(...form.photoPaths);
    }

    const missing = pathsToLoad.filter(p => !signedUrls[p]);
    if (missing.length === 0) return;

    const loadUrls = async () => {
      const urls: Record<string, string> = {};
      for (const path of missing) {
        try {
          urls[path] = await getSignedUrl('hardware-photos', path);
        } catch {
          // Skip
        }
      }
      if (Object.keys(urls).length > 0) {
        setSignedUrls(prev => ({ ...prev, ...urls }));
      }
    };
    loadUrls();
  }, [selectedDevice, editingDeviceId, devices, signedUrls, form.photoPaths]);

  // Load thumbnail URLs for list view
  useEffect(() => {
    const loadThumbs = async () => {
      const urls: Record<string, string> = {};
      for (const device of devices) {
        if (device.photoPaths.length > 0) {
          const firstPath = device.photoPaths[0];
          if (!signedUrls[firstPath]) {
            try {
              urls[firstPath] = await getSignedUrl('hardware-photos', firstPath);
            } catch {
              // Skip
            }
          }
        }
      }
      if (Object.keys(urls).length > 0) {
        setSignedUrls(prev => ({ ...prev, ...urls }));
      }
    };
    loadThumbs();
  }, [devices]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preprocess image for OCR: resize to max 1500px, convert to high-contrast grayscale
  const preprocessImageForOCR = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1500;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        // Downscale large images — huge images make OCR extremely slow
        if (w > MAX_DIM || h > MAX_DIM) {
          const scale = MAX_DIM / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(dataUrl); return; }

        // Draw image
        ctx.drawImage(img, 0, 0, w, h);

        // Convert to high-contrast grayscale for better OCR
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          // Luminance grayscale
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          // Increase contrast (stretch midtones)
          const contrasted = Math.min(255, Math.max(0, (gray - 128) * 1.5 + 128));
          data[i] = data[i + 1] = data[i + 2] = contrasted;
        }
        ctx.putImageData(imageData, 0, 0);

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const runOCR = async (imageData: string) => {
    setScanning(true);
    setScanProgress(0);
    setScanResult(null);
    try {
      // Preprocess: resize + grayscale + contrast for speed and accuracy
      setScanResult('Bild wird vorbereitet...');
      const processed = await preprocessImageForOCR(imageData);

      const result = await Tesseract.recognize(processed, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setScanProgress(Math.round(m.progress * 100));
          }
        },
        tessedit_pageseg_mode: '6',
      } as Parameters<typeof Tesseract.recognize>[2]);

      const text = result.data.text;
      let extracted = extractDataFromText(text);

      // --- 1. Bekannte Geräte-Datenbank (lokal) abgleichen ---
      const knownDevice = lookupKnownDevice(text);
      if (knownDevice) {
        extracted = enrichWithKnownDevice(extracted, knownDevice);
      }

      // --- 2. Web-Lookup Fallback (Supabase Edge Function) ---
      // Wenn nach OCR + lokaler DB noch wesentliche Felder fehlen
      const hasMissingFields = !extracted.manufacturer || !extracted.name || !extracted.cpu || !extracted.os;
      if (hasMissingFields && (extracted.model || text.length > 10)) {
        try {
          const { data: fnData } = await supabase.functions.invoke('device-lookup', {
            body: { model: extracted.model || '', ocrText: text },
          });
          if (fnData?.data) {
            const remote = fnData.data as Record<string, string>;
            if (!extracted.name && remote.name) extracted.name = remote.name;
            if (!extracted.manufacturer && remote.manufacturer) extracted.manufacturer = remote.manufacturer;
            if (!extracted.model && remote.model) extracted.model = remote.model;
            if (!extracted.cpu && remote.cpu) extracted.cpu = remote.cpu;
            if (!extracted.ram && remote.ram) extracted.ram = remote.ram;
            if (!extracted.storage && remote.storage) extracted.storage = remote.storage;
            if (!extracted.os && remote.os) extracted.os = remote.os;
            if (!extracted.screenSize && remote.screenSize) extracted.screenSize = remote.screenSize;
            if (!extracted.specs && remote.specs) extracted.specs = remote.specs;
          }
        } catch {
          // Web lookup fehlgeschlagen – kein Problem, lokale Daten reichen
        }
      }

      // --- 3. Auto-Name generieren wenn kein Name gefunden ---
      if (!extracted.name && (extracted.manufacturer || extracted.model)) {
        const parts = [extracted.manufacturer, extracted.model].filter(Boolean);
        extracted.name = parts.join(' ');
      }

      // --- Gerätetyp aus OCR-Kontext erkennen ---
      const textLower = text.toLowerCase();
      const detectedType = textLower.includes('tablet') ? 'tablet'
        : textLower.includes('laptop') || textLower.includes('notebook') ? 'laptop'
        : textLower.includes('phone') || textLower.includes('smartphone') ? 'smartphone'
        : textLower.includes('desktop') || textLower.includes('workstation') ? 'desktop'
        : textLower.includes('watch') || textLower.includes('wearable') ? 'smartwatch'
        : null;

      const foundFields: string[] = [];

      // Helper: should we overwrite a field? Yes if:
      // - prev is empty, OR
      // - new value comes from a known device match (higher confidence), OR
      // - new value is from labeled data (IMEI/SN) which is more trustworthy
      const hasKnownDevice = !!knownDevice;

      setForm(prev => {
        const updated = { ...prev };
        // Auto-set device type if detected
        if (detectedType && (prev.type === 'smartphone' || hasKnownDevice)) {
          updated.type = detectedType as HardwareDevice['type'];
          foundFields.push(`Typ: ${DEVICE_LABELS[detectedType] || detectedType}`);
        }
        // Auto-set type from known device spec
        if (knownDevice) {
          updated.type = knownDevice.type;
          if (!detectedType) foundFields.push(`Typ: ${DEVICE_LABELS[knownDevice.type]}`);
        }
        // IMEI/SN: overwrite if new value is found (later scans may be better labels)
        if (extracted.imei) {
          updated.imei = extracted.imei;
          foundFields.push(`IMEI: ${extracted.imei}`);
        }
        if (extracted.serialNumber) {
          updated.serialNumber = extracted.serialNumber;
          foundFields.push(`SN: ${extracted.serialNumber}`);
        }
        // Model: overwrite if from known device or if prev is empty
        if (extracted.model && (!prev.model || hasKnownDevice)) {
          updated.model = extracted.model;
          foundFields.push(`Modell: ${extracted.model}`);
        }
        if (extracted.manufacturer && (!prev.manufacturer || hasKnownDevice)) {
          updated.manufacturer = extracted.manufacturer;
          foundFields.push(`Hersteller: ${extracted.manufacturer}`);
        }
        if (extracted.name && (!prev.name || hasKnownDevice)) {
          updated.name = extracted.name;
          foundFields.push(`Name: ${extracted.name}`);
        }
        if (extracted.cpu && (!prev.cpu || hasKnownDevice)) {
          updated.cpu = extracted.cpu;
          foundFields.push(`CPU: ${extracted.cpu}`);
        }
        if (extracted.ram && (!prev.ram || hasKnownDevice)) {
          updated.ram = extracted.ram;
          foundFields.push(`RAM: ${extracted.ram}`);
        }
        if (extracted.storage && (!prev.storage || hasKnownDevice)) {
          updated.storage = extracted.storage;
          foundFields.push(`Speicher: ${extracted.storage}`);
        }
        if (extracted.os && (!prev.os || hasKnownDevice)) {
          updated.os = extracted.os;
          foundFields.push(`OS: ${extracted.os}`);
        }
        if (extracted.screenSize && (!prev.screenSize || hasKnownDevice)) {
          updated.screenSize = extracted.screenSize;
          foundFields.push(`Display: ${extracted.screenSize}`);
        }
        if (extracted.specs && (!prev.specs || hasKnownDevice)) {
          updated.specs = extracted.specs;
          foundFields.push(`Specs: ${extracted.specs}`);
        }
        return updated;
      });

      if (foundFields.length > 0) {
        setScanResult(`Erkannt: ${foundFields.join(', ')}`);
      } else {
        setScanResult('Keine Gerätedaten im Bild erkannt. Tipp: Bild gerade und gut beleuchtet aufnehmen.');
      }
    } catch {
      setScanResult('OCR-Fehler beim Scannen');
    }
    setScanning(false);
  };

  const handlePhotoUpload = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.size > MAX_PHOTO_SIZE) {
        alert(`${file.name} ist zu groß (max 5MB)`);
        return;
      }
      // Accept image/* and HEIC/HEIF (some browsers don't set type for HEIC)
      const isImage = file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name);
      if (!isImage) return;

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        // Store original for display, OCR gets the preprocessed version
        setForm(prev => ({
          ...prev,
          photoDataUrls: [...prev.photoDataUrls, dataUrl],
        }));
        runOCR(dataUrl);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setForm(prev => ({
      ...prev,
      photoDataUrls: prev.photoDataUrls.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('Bitte Gerätename eingeben');
      return;
    }

    // Upload NEW photos to Supabase Storage (only if user is logged in)
    const newPhotoPaths: string[] = [];
    if (user) {
      for (const dataUrl of form.photoDataUrls) {
        try {
          const blob = dataUrlToBlob(dataUrl);
          const fileName = `${uuid()}.jpg`;
          const path = await uploadFile('hardware-photos', user.id, fileName, blob);
          newPhotoPaths.push(path);
        } catch (err) {
          console.error('[Hardware] Photo upload failed:', err);
        }
      }
    }

    // Combine existing photos (from editing) with newly uploaded ones
    const allPhotoPaths = [...form.photoPaths, ...newPhotoPaths];

    if (editingDeviceId) {
      // --- UPDATE existing device ---
      setDevices(prev => prev.map(d => {
        if (d.id !== editingDeviceId) return d;
        return {
          ...d,
          name: form.name.trim(),
          type: form.type,
          assignedTo: form.assignedTo.trim() || undefined,
          manufacturer: form.manufacturer.trim() || undefined,
          model: form.model.trim() || undefined,
          imei: form.imei.trim() || undefined,
          serialNumber: form.serialNumber.trim() || undefined,
          cpu: form.cpu.trim() || undefined,
          ram: form.ram.trim() || undefined,
          storage: form.storage.trim() || undefined,
          os: form.os.trim() || undefined,
          screenSize: form.screenSize.trim() || undefined,
          specs: form.specs.trim() || undefined,
          purchaseDate: form.purchaseDate || undefined,
          warrantyUntil: form.warrantyUntil || undefined,
          notes: form.notes.trim() || undefined,
          photoPaths: allPhotoPaths,
        };
      }));
      console.log('[Hardware] Updated device:', editingDeviceId);
    } else {
      // --- CREATE new device ---
      const device: HardwareDevice = {
        id: uuid(),
        name: form.name.trim(),
        type: form.type,
        assignedTo: form.assignedTo.trim() || undefined,
        manufacturer: form.manufacturer.trim() || undefined,
        model: form.model.trim() || undefined,
        imei: form.imei.trim() || undefined,
        serialNumber: form.serialNumber.trim() || undefined,
        cpu: form.cpu.trim() || undefined,
        ram: form.ram.trim() || undefined,
        storage: form.storage.trim() || undefined,
        os: form.os.trim() || undefined,
        screenSize: form.screenSize.trim() || undefined,
        specs: form.specs.trim() || undefined,
        purchaseDate: form.purchaseDate || undefined,
        warrantyUntil: form.warrantyUntil || undefined,
        notes: form.notes.trim() || undefined,
        photoPaths: allPhotoPaths,
        createdAt: Date.now(),
      };
      console.log('[Hardware] Saving device:', device.name, 'User:', user?.id || 'NOT LOGGED IN');
      setDevices(prev => [device, ...prev]);
    }
    resetForm();
  };

  const deleteDevice = async (id: string) => {
    const device = devices.find(d => d.id === id);
    if (device) {
      // Delete photos from storage
      for (const path of device.photoPaths) {
        try {
          await deleteFile('hardware-photos', path);
        } catch {
          // Skip
        }
      }
    }
    setDevices(prev => prev.filter(d => d.id !== id));
    if (selectedDevice === id) setSelectedDevice(null);
  };

  const filtered = devices.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.manufacturer?.toLowerCase().includes(search.toLowerCase()) ||
    d.model?.toLowerCase().includes(search.toLowerCase()) ||
    d.imei?.includes(search) ||
    d.serialNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const detail = selectedDevice ? devices.find(d => d.id === selectedDevice) : null;

  if (detail) {
    return (
      <WidgetWrapper widgetId="hardware" title="Hardware" icon={<Cpu size={16} />}>
        <div className="hw-detail-toolbar">
          <button className="btn-back" onClick={() => setSelectedDevice(null)}>
            <ChevronLeft size={14} /> Zurück
          </button>
          <button className="btn-secondary btn-edit" onClick={() => startEditing(detail)}>
            <Edit3 size={14} /> Bearbeiten
          </button>
        </div>
        <div className="hw-detail">
          <div className="hw-detail-header">
            <div className="hw-detail-icon">{DEVICE_ICONS[detail.type]}</div>
            <div>
              <strong>{detail.name}</strong>
              <span className="hw-detail-type">{DEVICE_LABELS[detail.type]}</span>
            </div>
          </div>

          {detail.photoPaths.length > 0 && (
            <div className="hw-photos">
              {detail.photoPaths.map((path, i) => (
                <img
                  key={i}
                  src={signedUrls[path] || ''}
                  alt={`${detail.name} Foto ${i + 1}`}
                  className="hw-photo"
                  onClick={() => setPhotoPreview(signedUrls[path] || null)}
                  style={{ display: signedUrls[path] ? 'block' : 'none' }}
                />
              ))}
            </div>
          )}

          <div className="hw-fields">
            {detail.assignedTo && (
              <div className="hw-field">
                <span className="hw-field-label">Zugeordnet an</span>
                <span>{detail.assignedTo}</span>
              </div>
            )}
            {detail.manufacturer && (
              <div className="hw-field">
                <span className="hw-field-label">Hersteller</span>
                <span>{detail.manufacturer}</span>
              </div>
            )}
            {detail.model && (
              <div className="hw-field">
                <span className="hw-field-label">Modell</span>
                <span>{detail.model}</span>
              </div>
            )}
            {detail.imei && (
              <div className="hw-field">
                <span className="hw-field-label">IMEI</span>
                <span className="hw-field-mono">{detail.imei}</span>
              </div>
            )}
            {detail.serialNumber && (
              <div className="hw-field">
                <span className="hw-field-label">Seriennummer</span>
                <span className="hw-field-mono">{detail.serialNumber}</span>
              </div>
            )}
            {detail.cpu && (
              <div className="hw-field">
                <span className="hw-field-label">CPU</span>
                <span>{detail.cpu}</span>
              </div>
            )}
            {detail.os && (
              <div className="hw-field">
                <span className="hw-field-label">Betriebssystem</span>
                <span>{detail.os}</span>
              </div>
            )}
            {detail.ram && (
              <div className="hw-field">
                <span className="hw-field-label">RAM</span>
                <span>{detail.ram}</span>
              </div>
            )}
            {detail.storage && (
              <div className="hw-field">
                <span className="hw-field-label">Speicher</span>
                <span>{detail.storage}</span>
              </div>
            )}
            {detail.screenSize && (
              <div className="hw-field">
                <span className="hw-field-label">Display</span>
                <span>{detail.screenSize}</span>
              </div>
            )}
            {detail.specs && (
              <div className="hw-field">
                <span className="hw-field-label">Specs</span>
                <span>{detail.specs}</span>
              </div>
            )}
            {detail.purchaseDate && (
              <div className="hw-field">
                <span className="hw-field-label">Kaufdatum</span>
                <span>{new Date(detail.purchaseDate).toLocaleDateString('de-DE')}</span>
              </div>
            )}
            {detail.warrantyUntil && (
              <div className="hw-field">
                <span className="hw-field-label">Garantie bis</span>
                <span>{new Date(detail.warrantyUntil).toLocaleDateString('de-DE')}</span>
              </div>
            )}
            {detail.notes && (
              <div className="hw-field">
                <span className="hw-field-label">Notizen</span>
                <span>{detail.notes}</span>
              </div>
            )}
          </div>
        </div>

        {photoPreview && (
          <div className="hw-lightbox" onClick={() => setPhotoPreview(null)}>
            <img src={photoPreview} alt="Vorschau" />
            <button className="hw-lightbox-close"><X size={20} /></button>
          </div>
        )}
      </WidgetWrapper>
    );
  }

  return (
    <WidgetWrapper widgetId="hardware" title="Hardware" icon={<Cpu size={16} />}>
      <div className="vault-toolbar">
        <div className="search-box">
          <Search size={13} />
          <input
            placeholder="Gerät suchen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className="btn-icon" onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}>
          {showForm ? <X size={14} /> : <Plus size={14} />}
        </button>
      </div>

      {showForm && (
        <div className="vault-form">
          <input
            placeholder="Gerätename *"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />
          <select
            value={form.type}
            onChange={e => setForm(p => ({ ...p, type: e.target.value as HardwareDevice['type'] }))}
          >
            {Object.entries(DEVICE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <input
            placeholder="Zugeordnet an (z.B. Felix, Büro, Mama)"
            value={form.assignedTo}
            onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))}
          />
          <div className="hw-form-row">
            <input
              placeholder="Hersteller"
              value={form.manufacturer}
              onChange={e => setForm(p => ({ ...p, manufacturer: e.target.value }))}
            />
            <input
              placeholder="Modell"
              value={form.model}
              onChange={e => setForm(p => ({ ...p, model: e.target.value }))}
            />
          </div>
          <input
            placeholder="IMEI"
            value={form.imei}
            onChange={e => setForm(p => ({ ...p, imei: e.target.value }))}
          />
          <input
            placeholder="Seriennummer"
            value={form.serialNumber}
            onChange={e => setForm(p => ({ ...p, serialNumber: e.target.value }))}
          />
          <div className="hw-form-row">
            <input
              placeholder="CPU / Prozessor"
              value={form.cpu}
              onChange={e => setForm(p => ({ ...p, cpu: e.target.value }))}
            />
            <input
              placeholder="Betriebssystem"
              value={form.os}
              onChange={e => setForm(p => ({ ...p, os: e.target.value }))}
            />
          </div>
          <div className="hw-form-row">
            <input
              placeholder="RAM"
              value={form.ram}
              onChange={e => setForm(p => ({ ...p, ram: e.target.value }))}
            />
            <input
              placeholder="Speicher (ROM/SSD)"
              value={form.storage}
              onChange={e => setForm(p => ({ ...p, storage: e.target.value }))}
            />
          </div>
          <div className="hw-form-row">
            <input
              placeholder="Bildschirmgröße"
              value={form.screenSize}
              onChange={e => setForm(p => ({ ...p, screenSize: e.target.value }))}
            />
            <input
              placeholder="Specs (z.B. NFC, FHD, 2D)"
              value={form.specs}
              onChange={e => setForm(p => ({ ...p, specs: e.target.value }))}
            />
          </div>
          <div className="hw-form-row">
            <div className="hw-date-field">
              <label>Kaufdatum</label>
              <input
                type="date"
                value={form.purchaseDate}
                onChange={e => setForm(p => ({ ...p, purchaseDate: e.target.value }))}
              />
            </div>
            <div className="hw-date-field">
              <label>Garantie bis</label>
              <input
                type="date"
                value={form.warrantyUntil}
                onChange={e => setForm(p => ({ ...p, warrantyUntil: e.target.value }))}
              />
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <textarea
              placeholder="Notizen..."
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2}
            />
            <div style={{ position: 'absolute', top: 6, right: 6 }}>
              <VoiceInputButton onTranscript={(text) => setForm(p => ({ ...p, notes: p.notes + (p.notes ? ' ' : '') + text }))} />
            </div>
          </div>

          <div className="hw-photo-upload">
            <button
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              type="button"
              disabled={scanning}
            >
              <Camera size={14} /> Foto hochladen (Auto-Scan)
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              onChange={e => handlePhotoUpload(e.target.files)}
              hidden
            />
          </div>

          {scanning && (
            <div className="hw-scan-status">
              <Loader size={14} className="spin" />
              <span>Scanne Bild... {scanProgress}%</span>
              <div className="hw-scan-bar">
                <div className="hw-scan-fill" style={{ width: `${scanProgress}%` }} />
              </div>
            </div>
          )}

          {scanResult && !scanning && (
            <div className={`hw-scan-result ${scanResult.startsWith('Erkannt') ? 'success' : 'info'}`}>
              {scanResult}
            </div>
          )}

          {/* Existing photos (when editing) */}
          {form.photoPaths.length > 0 && (
            <div className="hw-photo-previews">
              {form.photoPaths.map((path, i) => (
                <div key={`existing-${i}`} className="hw-photo-thumb">
                  <img src={signedUrls[path] || ''} alt={`Foto ${i + 1}`} style={{ display: signedUrls[path] ? 'block' : 'none' }} />
                  <button className="hw-photo-remove" onClick={() => {
                    setForm(prev => ({
                      ...prev,
                      photoPaths: prev.photoPaths.filter((_, idx) => idx !== i),
                    }));
                  }}>
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Newly uploaded photos */}
          {form.photoDataUrls.length > 0 && (
            <div className="hw-photo-previews">
              {form.photoDataUrls.map((photo, i) => (
                <div key={`new-${i}`} className="hw-photo-thumb">
                  <img src={photo} alt={`Neues Foto ${i + 1}`} />
                  <button className="hw-photo-remove" onClick={() => removePhoto(i)}>
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="form-actions">
            <button className="btn-secondary" onClick={resetForm}>Abbrechen</button>
            <button className="btn-primary" onClick={handleSave} disabled={scanning}>
              {editingDeviceId ? 'Aktualisieren' : 'Speichern'}
            </button>
          </div>
        </div>
      )}

      <div className="hw-list">
        {filtered.map(device => (
          <div key={device.id} className="hw-card" onClick={() => setSelectedDevice(device.id)}>
            <div className="hw-card-icon">{DEVICE_ICONS[device.type]}</div>
            <div className="hw-card-info">
              <strong>{device.name}</strong>
              {device.assignedTo && <span className="hw-card-assigned">{device.assignedTo}</span>}
              <span className="hw-card-meta">
                {DEVICE_LABELS[device.type]}
                {device.manufacturer && ` · ${device.manufacturer}`}
                {device.model && ` ${device.model}`}
              </span>
              {device.serialNumber && (
                <span className="hw-card-sn">SN: {device.serialNumber}</span>
              )}
            </div>
            {device.photoPaths.length > 0 && signedUrls[device.photoPaths[0]] && (
              <img src={signedUrls[device.photoPaths[0]]} alt="" className="hw-card-thumb" />
            )}
            <button
              className="btn-icon-sm delete-btn"
              onClick={e => { e.stopPropagation(); deleteDevice(device.id); }}
              title="Löschen"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {filtered.length === 0 && !showForm && (
          <p className="empty-text">
            {devices.length === 0 ? 'Keine Geräte registriert' : 'Keine Treffer'}
          </p>
        )}
      </div>
    </WidgetWrapper>
  );
}

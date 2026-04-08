// KI-Feldextraktion via OpenAI API (direkt vom Browser)
// API-Key wird im localStorage gespeichert, nie committet.

const LS_AI_KEY = 'dashboard_openai_api_key';

export function getAiApiKey(): string {
  return localStorage.getItem(LS_AI_KEY) ?? import.meta.env.VITE_OPENAI_API_KEY ?? '';
}

export function saveAiApiKey(key: string): void {
  localStorage.setItem(LS_AI_KEY, key.trim());
}

export interface ContactExtract {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
}

export interface CompanyExtract {
  name?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
}

type MessageContent = string | Array<{ type: string; text?: string; image_url?: { url: string } }>;

async function callOpenAI(apiKey: string, content: MessageContent): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: Array.isArray(content) ? 'gpt-4o-mini' : 'gpt-4o-mini',
      max_tokens: 512,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `API-Fehler ${res.status}`);
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

function parseJson<T>(text: string): T | null {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  const jsonStr = match ? match[1] : text;
  try {
    return JSON.parse(jsonStr.trim()) as T;
  } catch {
    return null;
  }
}

// --- Dokumentname generieren ---
export interface DocNameResult {
  date: string;
  description: string;
}

export async function generateDocumentName(
  content: MessageContent,
  apiKey: string,
): Promise<DocNameResult> {
  const today = new Date().toISOString().slice(0, 10);
  const prompt = typeof content === 'string'
    ? `Du bist ein Dokumenten-Klassifizierer. Analysiere den folgenden Dokumentinhalt und erstelle einen kurzen, präzisen deutschen Dateinamen.

Regeln:
- Kebab-Case (kleinbuchstaben, wörter mit bindestrich verbunden)
- Maximal 5 Wörter
- Keine Sonderzeichen, Umlaute ersetzen (ä→ae, ö→oe, ü→ue, ß→ss)
- Beschreibe den INHALT/TYP des Dokuments, nicht die Formatierung
- Wenn ein Datum im Dokument erkennbar ist (Rechnungsdatum, Vertragsdatum etc.), extrahiere es
- Beispiele: "mietvertrag-wohnung-zurich", "rechnung-swisscom-maerz", "lebenslauf-max-mustermann"

Dokumentinhalt:
${content.slice(0, 3000)}

Antworte NUR mit JSON: {"date": "YYYY-MM-DD", "description": "kebab-case-name"}
Falls kein Datum erkennbar: {"date": "${today}", "description": "..."}
Keine Erklärung.`
    : content;

  let finalContent: MessageContent = typeof content === 'string' ? prompt : content;

  if (typeof content !== 'string') {
    const textBlock = {
      type: 'text',
      text: `Analysiere dieses Dokument-Bild und erstelle einen kurzen, präzisen deutschen Dateinamen.

Regeln:
- Kebab-Case (kleinbuchstaben, wörter mit bindestrich verbunden)
- Maximal 5 Wörter
- Keine Sonderzeichen, Umlaute ersetzen (ä→ae, ö→oe, ü→ue, ß→ss)
- Beschreibe den INHALT/TYP des Dokuments, nicht die Formatierung
- Wenn ein Datum im Dokument erkennbar ist, extrahiere es

Antworte NUR mit JSON: {"date": "YYYY-MM-DD", "description": "kebab-case-name"}
Falls kein Datum erkennbar: {"date": "${today}", "description": "..."}
Keine Erklärung.`,
    };
    finalContent = [...(content as Array<{ type: string; text?: string; image_url?: { url: string } }>), textBlock];
  }

  const reply = await callOpenAI(apiKey, finalContent);
  const parsed = parseJson<DocNameResult>(reply);
  if (parsed?.description) return parsed;
  // Fallback: Antwort als reinen Beschreibungstext behandeln
  const cleaned = reply.replace(/[^a-z0-9\-]/gi, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '');
  return { date: today, description: cleaned || 'dokument' };
}

// --- Kontakt aus Text ---
export async function extractContactFromText(
  text: string,
  apiKey: string,
): Promise<ContactExtract> {
  const prompt = `Extrahiere Kontaktdaten aus diesem Text. Antworte NUR mit einem JSON-Objekt mit diesen optionalen Feldern: name, email, phone, company, position (Berufsbezeichnung/Rolle). Nur Felder die eindeutig vorhanden sind.

Text:
${text}

Nur JSON zurückgeben, keine Erklärung.`;

  const reply = await callOpenAI(apiKey, prompt);
  return parseJson<ContactExtract>(reply) ?? {};
}

// --- Kontakt aus Bild ---
export async function extractContactFromImage(
  base64: string,
  mimeType: string,
  apiKey: string,
): Promise<ContactExtract> {
  const content = [
    {
      type: 'image_url',
      image_url: { url: `data:${mimeType};base64,${base64}` },
    },
    {
      type: 'text',
      text: 'Extrahiere Kontaktdaten aus diesem Bild (Visitenkarte, E-Mail-Signatur, etc.). Antworte NUR mit einem JSON-Objekt mit diesen optionalen Feldern: name, email, phone, company, position (Berufsbezeichnung/Rolle). Nur Felder die eindeutig sichtbar sind. Nur JSON zurückgeben.',
    },
  ];

  const reply = await callOpenAI(apiKey, content);
  return parseJson<ContactExtract>(reply) ?? {};
}

// --- Firma aus Text ---
export async function extractCompanyFromText(
  text: string,
  apiKey: string,
): Promise<CompanyExtract> {
  const prompt = `Extrahiere Firmendaten aus diesem Text. Antworte NUR mit einem JSON-Objekt mit diesen optionalen Feldern: name, phone, email, website, address. Nur Felder die eindeutig vorhanden sind.

Text:
${text}

Nur JSON zurückgeben, keine Erklärung.`;

  const reply = await callOpenAI(apiKey, prompt);
  return parseJson<CompanyExtract>(reply) ?? {};
}

// --- Firma aus Bild ---
export async function extractCompanyFromImage(
  base64: string,
  mimeType: string,
  apiKey: string,
): Promise<CompanyExtract> {
  const content = [
    {
      type: 'image_url',
      image_url: { url: `data:${mimeType};base64,${base64}` },
    },
    {
      type: 'text',
      text: 'Extrahiere Firmendaten aus diesem Bild (Briefkopf, Visitenkarte, Website-Screenshot, etc.). Antworte NUR mit einem JSON-Objekt mit diesen optionalen Feldern: name, phone, email, website, address. Nur Felder die eindeutig sichtbar sind. Nur JSON zurückgeben.',
    },
  ];

  const reply = await callOpenAI(apiKey, content);
  return parseJson<CompanyExtract>(reply) ?? {};
}

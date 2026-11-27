import { GoogleGenAI } from '@google/genai';

/**
 * Couche d'accès aux modèles de langage.
 * - Groq (API compatible OpenAI) en premier quand GROQ_API_KEY est présente et que la requête est du texte seul.
 * - Gemini (@google/genai) en secours, et pour tout ce que Groq ne sait pas faire ici : images en entrée et lecture d'URL.
 * Les appelants gardent la forme `ai.models.generateContent({ model, contents, config })` et reçoivent `{ text }`.
 */

export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3-32b'];
export const GEMINI_FALLBACK_MODEL = 'gemini-3-flash-preview';

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };

export interface GenerateParams {
  model?: string;
  contents: string | { parts: Part[] };
  config?: {
    systemInstruction?: string;
    responseMimeType?: string;
    responseSchema?: unknown;
    tools?: unknown[];
    temperature?: number;
  };
}

export interface LLMClient {
  models: { generateContent(params: GenerateParams): Promise<{ text: string }> };
}

export class LLMError extends Error {
  status?: number;
  code?: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'LLMError';
    this.status = status;
    this.code = code;
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface LLMRuntimeOptions {
  /** Pause entre deux tentatives (remplaçable dans les tests) */
  sleepFn?: (ms: number) => Promise<void>;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

// --- Nettoyage de la sortie du modèle --------------------------------------------------------------

/** Retire les blocs de réflexion <think>…</think>, les clôtures markdown et le texte autour du JSON. */
export function cleanModelText(raw: string): string {
  let text = (raw ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '');
  text = text.replace(/<think>[\s\S]*$/i, ''); // réflexion non refermée : on l'ignore
  text = text.trim();
  const fenced = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();
  return text;
}

/** Extrait le premier objet ou tableau JSON complet d'un texte et le valide. Renvoie null si impossible. */
export function extractJson(raw: string): string | null {
  const text = cleanModelText(raw);
  if (!text) return null;
  const candidates: string[] = [text];
  const start = text.search(/[{[]/);
  if (start > 0) candidates.push(text.slice(start));

  for (const candidate of candidates) {
    const open = candidate[0];
    if (open !== '{' && open !== '[') continue;
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < candidate.length; i += 1) {
      const ch = candidate[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === open) depth += 1;
      else if (ch === close) {
        depth -= 1;
        if (depth === 0) {
          const slice = candidate.slice(0, i + 1);
          try {
            JSON.parse(slice);
            return slice;
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}

/** Convertit un schéma au format Gemini (Type.OBJECT…) en schéma JSON standard lisible par n'importe quel modèle. */
export function toJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toJsonSchema);
  if (schema && typeof schema === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
      if (key === 'type' && typeof value === 'string') out[key] = value.toLowerCase();
      else if (key === 'propertyOrdering' || key === 'nullable') continue;
      else out[key] = toJsonSchema(value);
    }
    return out;
  }
  return schema;
}

function partsToText(contents: GenerateParams['contents']): string {
  if (typeof contents === 'string') return contents;
  return contents.parts
    .map((p) => p.text ?? '')
    .filter(Boolean)
    .join('\n\n');
}

function needsGemini(params: GenerateParams): boolean {
  if (params.config?.tools && params.config.tools.length > 0) return true;
  if (typeof params.contents !== 'string' && params.contents.parts.some((p) => p.inlineData)) return true;
  return false;
}

// --- Groq -----------------------------------------------------------------------------------------

function groqErrorFromStatus(status: number, detail: string): LLMError {
  if (status === 401 || status === 403) {
    return new LLMError('Clé API Groq invalide ou refusée.', 403, 'API_KEY_INVALID');
  }
  if (status === 429) {
    return new LLMError('Le quota Groq est temporairement atteint.', 429, 'QUOTA_EXCEEDED');
  }
  return new LLMError(`Groq a répondu avec le statut ${status}. ${detail}`.trim(), status, 'GROQ_ERROR');
}

async function callGroqOnce(
  model: string,
  params: GenerateParams,
  apiKey: string,
  runtime: Required<LLMRuntimeOptions>,
  extraUserNote?: string,
): Promise<string> {
  const wantsJson = params.config?.responseMimeType === 'application/json';
  const schema = params.config?.responseSchema;
  let system = params.config?.systemInstruction ?? '';
  if (wantsJson) {
    system += `\n\nRéponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises de réflexion et sans bloc markdown.`;
    if (schema) {
      system += `\nLe JSON doit respecter ce schéma (toutes les clés « required » sont obligatoires) :\n${JSON.stringify(toJsonSchema(schema))}`;
    }
  }
  const user = `${partsToText(params.contents)}${extraUserNote ? `\n\n${extraUserNote}` : ''}`;

  const body: Record<string, unknown> = {
    model,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: user },
    ],
    temperature: params.config?.temperature ?? 0.7,
    max_completion_tokens: 8192,
  };
  if (wantsJson) body.response_format = { type: 'json_object' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), runtime.timeoutMs);
  try {
    const res = await runtime.fetchFn(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      const err = groqErrorFromStatus(res.status, detail);
      const retryAfter = Number(res.headers.get('retry-after'));
      (err as LLMError & { retryAfterMs?: number }).retryAfterMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined;
      throw err;
    }
    const data = (await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string } }> } | null;
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new LLMError('Groq a renvoyé une réponse vide.', 502, 'EMPTY_RESPONSE');
    }
    return content;
  } catch (err) {
    if (err instanceof LLMError) throw err;
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new LLMError('Groq a mis trop de temps à répondre.', 504, 'TIMEOUT');
    }
    throw new LLMError('Groq est injoignable pour le moment.', 503, 'NETWORK');
  } finally {
    clearTimeout(timer);
  }
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

async function callGroq(params: GenerateParams, apiKey: string, runtime: Required<LLMRuntimeOptions>): Promise<string> {
  const wantsJson = params.config?.responseMimeType === 'application/json';
  let lastError: LLMError | null = null;

  for (const model of GROQ_MODELS) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const raw = await callGroqOnce(model, params, apiKey, runtime);
        if (!wantsJson) return cleanModelText(raw);
        const json = extractJson(raw);
        if (json) return json;
        // Une seule relance « réparation » si le JSON est cassé ou tronqué
        const retryRaw = await callGroqOnce(
          model,
          params,
          apiKey,
          runtime,
          'Ta réponse précédente n’était pas un JSON complet et valide. Renvoie le JSON complet, rien d’autre.',
        );
        const retryJson = extractJson(retryRaw);
        if (retryJson) return retryJson;
        lastError = new LLMError('Le modèle a renvoyé un JSON invalide.', 502, 'INVALID_JSON');
        break; // on passe au modèle suivant
      } catch (err) {
        const e = err as LLMError & { retryAfterMs?: number };
        lastError = e instanceof LLMError ? e : new LLMError(String(err), 500);
        if (e.code === 'API_KEY_INVALID') throw e;
        if (e.status && RETRYABLE.has(e.status)) {
          if (attempt < 2) {
            const wait = Math.min(e.retryAfterMs ?? 800 * 2 ** attempt, 6000);
            await runtime.sleepFn(wait);
            continue;
          }
          break; // modèle suivant
        }
        if (e.code === 'EMPTY_RESPONSE' || e.code === 'TIMEOUT' || e.code === 'NETWORK') {
          if (attempt < 1) {
            await runtime.sleepFn(500);
            continue;
          }
          break;
        }
        throw e;
      }
    }
  }
  throw lastError ?? new LLMError('Groq n’a pas pu répondre.', 503, 'GROQ_ERROR');
}

// --- Gemini ---------------------------------------------------------------------------------------

function getGeminiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  return key && key !== 'MY_GEMINI_API_KEY' ? key : null;
}

async function callGemini(params: GenerateParams, runtime: Required<LLMRuntimeOptions>): Promise<string> {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    throw new LLMError(
      'Aucune clé API valide : renseignez GROQ_API_KEY (ou GEMINI_API_KEY pour les images et les URL) dans le fichier .env.',
      403,
      'API_KEY_MISSING',
    );
  }
  const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta', httpOptions: { headers: { 'User-Agent': 'siteforge' } } });
  const model = process.env.GEMINI_MODEL || GEMINI_FALLBACK_MODEL;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: params.contents as never,
        config: {
          ...(params.config as Record<string, unknown>),
          thinkingConfig: { thinkingBudget: 0 },
        } as never,
      });
      const text = res.text ?? '';
      if (params.config?.responseMimeType === 'application/json') {
        const json = extractJson(text);
        if (!json) throw new LLMError('Gemini a renvoyé un JSON invalide.', 502, 'INVALID_JSON');
        return json;
      }
      return text;
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      const raw = err instanceof Error ? err.message : String(err);
      const retryable = status === 429 || status === 503 || /RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded/i.test(raw);
      if (retryable && attempt < 2) {
        await runtime.sleepFn(900 * 2 ** attempt);
        continue;
      }
      break;
    }
  }
  if (lastError instanceof LLMError) throw lastError;
  const status = (lastError as { status?: number })?.status;
  const raw = lastError instanceof Error ? lastError.message : String(lastError);
  if (status === 429 || /RESOURCE_EXHAUSTED/.test(raw)) {
    throw new LLMError('Le quota Gemini est temporairement atteint.', 429, 'QUOTA_EXCEEDED');
  }
  if (status === 403 || /PERMISSION_DENIED|API_KEY_INVALID/.test(raw)) {
    throw new LLMError('Clé API Gemini invalide ou refusée.', 403, 'API_KEY_INVALID');
  }
  const err = new LLMError(raw || 'Erreur Gemini.', status, 'GEMINI_ERROR');
  (err as LLMError & { cause?: unknown }).cause = lastError;
  throw err;
}

// --- Point d'entrée -------------------------------------------------------------------------------

export function createLLM(options: LLMRuntimeOptions = {}): LLMClient {
  const runtime: Required<LLMRuntimeOptions> = {
    sleepFn: options.sleepFn ?? sleep,
    fetchFn: options.fetchFn ?? fetch,
    timeoutMs: options.timeoutMs ?? 45_000,
  };

  return {
    models: {
      async generateContent(params: GenerateParams): Promise<{ text: string }> {
        const groqKey = process.env.GROQ_API_KEY;
        const hasGroq = Boolean(groqKey && groqKey.trim());
        const geminiOnly = needsGemini(params);

        if (hasGroq && !geminiOnly) {
          try {
            return { text: await callGroq(params, groqKey as string, runtime) };
          } catch (err) {
            const e = err as LLMError;
            // Clé Groq refusée ou Groq saturé : on bascule sur Gemini s'il est configuré
            if (getGeminiKey()) {
              return { text: await callGemini(params, runtime) };
            }
            throw e;
          }
        }
        return { text: await callGemini(params, runtime) };
      },
    },
  };
}

export function describeProviders(): { groq: boolean; gemini: boolean } {
  return { groq: Boolean(process.env.GROQ_API_KEY?.trim()), gemini: Boolean(getGeminiKey()) };
}

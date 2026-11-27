import type {
  FontPairSuggestion,
  OriginalityReport,
  PaletteSuggestion,
  ProjectInput,
  SiteBlock,
  SiteProject,
  StructureAnalysis,
} from '../types/site';
import type { StockImageResult } from '../utils/credits';

export class ApiClientError extends Error {
  code?: string;
  canFallbackToCapture?: boolean;
  constructor(message: string, code?: string, canFallbackToCapture?: boolean) {
    super(message);
    this.code = code;
    this.canFallbackToCapture = canFallbackToCapture;
  }
}

/**
 * Lit la réponse du serveur sans jamais planter sur un corps vide ou tronqué
 * (« Unexpected end of JSON input ») : on lit le texte, puis on tente de l'analyser.
 */
async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text().catch(() => '');
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : { value: parsed };
  } catch {
    return { error: 'Le serveur a renvoyé une réponse illisible. Réessayez dans un instant.', code: 'BAD_RESPONSE' };
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiClientError('Connexion au serveur impossible. Vérifiez votre réseau et réessayez.');
  }

  const data = await readJson(response);
  if (!response.ok || data.code === 'BAD_RESPONSE') {
    throw new ApiClientError(
      (data.error as string) || 'Une erreur inattendue est survenue.',
      data.code as string | undefined,
      Boolean(data.canFallbackToCapture),
    );
  }
  return data as T;
}

function postJson<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function apiAnalyzeTemplate(input: {
  mode: 'image' | 'url' | 'description';
  imageDataUrl?: string;
  url?: string;
  description?: string;
}): Promise<StructureAnalysis> {
  const res = await postJson<{ analysis: StructureAnalysis }>('/api/gemini/analyze-template', input);
  return res.analysis;
}

export async function apiGenerateSite(
  projectInput: ProjectInput,
  structureAnalysis?: StructureAnalysis,
): Promise<{ project: SiteProject; originalityReport: OriginalityReport }> {
  return postJson('/api/gemini/generate-site', { projectInput, structureAnalysis });
}

export async function apiRegenerateBlock(input: {
  block: SiteBlock;
  instruction: string;
  siteName: string;
  activity?: string;
}): Promise<SiteBlock> {
  const res = await postJson<{ block: SiteBlock }>('/api/gemini/regenerate-block', input);
  return res.block;
}

export async function apiRewriteText(input: {
  text: string;
  instruction: string;
  siteName?: string;
}): Promise<string> {
  const res = await postJson<{ rewrittenText: string }>('/api/gemini/rewrite-text', input);
  return res.rewrittenText;
}

export async function apiSuggestStyles(input: {
  activity: string;
  mood: string;
  siteName: string;
}): Promise<{ palettes: PaletteSuggestion[]; fontPairs: FontPairSuggestion[] }> {
  return postJson('/api/gemini/suggest-styles', input);
}

export async function apiGenerateSeo(project: SiteProject): Promise<{
  seoTitle: string;
  seoDescription: string;
  imageAlts: Array<{ blockId: string; itemId?: string; alt: string }>;
}> {
  return postJson('/api/gemini/generate-seo', { project });
}

/** Recherche d'images libres de droits (Openverse et Wikimedia Commons), avec auteur et licence. */
export async function apiSearchImages(query: string, limit = 12): Promise<StockImageResult[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const res = await request<{ value?: StockImageResult[] } | StockImageResult[]>(`/api/images/search?${params}`);
  return Array.isArray(res) ? res : (res.value ?? []);
}

export interface SiteProposal {
  id: string;
  name: string;
  concept: string;
  project: SiteProject;
}

export interface AiBrief {
  description: string;
  vision: string;
  mustHave: string;
  siteName?: string;
}

/** Génère 3 propositions différentes (mise en page, palette, effets, photos libres de droits). */
export async function apiGenerateProposals(brief: AiBrief): Promise<SiteProposal[]> {
  const res = await postJson<{ proposals: SiteProposal[] }>('/api/gemini/generate-proposals', brief);
  return res.proposals;
}

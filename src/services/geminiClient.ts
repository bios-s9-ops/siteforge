import type {
  FontPairSuggestion,
  OriginalityReport,
  PaletteSuggestion,
  ProjectInput,
  SiteBlock,
  SiteProject,
  StructureAnalysis,
} from '../types/site';
import { buildSafeSvgDataUrl, type SvgCompositionSpec } from '../utils/svgIllustration';

export class ApiClientError extends Error {
  code?: string;
  canFallbackToCapture?: boolean;
  constructor(message: string, code?: string, canFallbackToCapture?: boolean) {
    super(message);
    this.code = code;
    this.canFallbackToCapture = canFallbackToCapture;
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError('Connexion au serveur impossible. Vérifiez votre réseau et réessayez.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiClientError(
      data.error || 'Une erreur inattendue est survenue.',
      data.code,
      Boolean(data.canFallbackToCapture),
    );
  }
  return data as T;
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

export async function apiGenerateIllustration(input: {
  prompt: string;
  primaryColor: string;
  secondaryColor: string;
}): Promise<{ dataUrl: string; title: string }> {
  const res = await postJson<{ spec: SvgCompositionSpec }>('/api/gemini/generate-illustration', input);
  return {
    dataUrl: buildSafeSvgDataUrl(res.spec),
    title: res.spec.title || input.prompt,
  };
}

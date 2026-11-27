import type { BlockContent, BlockItem, FormProvider, NavbarConfig, ProjectInput, SiteBlock, SitePage, SiteProject, StructureAnalysis } from '../types/site';
import { BLOCK_CATALOG } from './blockCatalog';
import { applyArtDirectionToTheme, pickArtDirectionFromMood } from './artDirections';
import { normalizeHex } from './colorHarmony';
import {
  clampDuration,
  hasAnyImageEffect,
  sanitizeHeaderStyle,
  sanitizeImageEffect,
  sanitizeLayoutMode,
  sanitizeSectionAnimation,
} from './effectsCatalog';
import { sanitizeUrl } from './validation';
import { DEFAULT_NAVBAR_CONFIG } from './siteSettings';

const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

/** Canevas vierge : aucune section, aucune image, aucun texte imposé. */
export function createBlankProject(name = 'Nouveau site'): SiteProject {
  const now = new Date().toISOString();
  const projectInput: ProjectInput = {
    mode: 'scratch',
    siteName: name,
    activity: '',
    mood: '',
    targetAudience: '',
    goal: '',
  };
  return {
    id: newId('prj'),
    name,
    seoTitle: name,
    seoDescription: '',
    isDemo: false,
    theme: applyArtDirectionToTheme(pickArtDirectionFromMood('')),
    blocks: [],
    projectInput,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeProjectPages(project: SiteProject): SiteProject {
  const pages = project.pages?.length
    ? project.pages
    : [{ id: `${project.id}-home`, title: 'Accueil', slug: 'accueil', blocks: project.blocks }];
  const hasActivePage = pages.some((page) => page.id === project.activePageId);
  const activePageId = hasActivePage ? project.activePageId! : pages[0].id;
  const activePage = pages.find((page) => page.id === activePageId)!;
  const blocks = hasActivePage ? project.blocks : activePage.blocks;
  return {
    ...project,
    pages: pages.map((page) => page.id === activePageId ? { ...page, blocks } : page),
    activePageId,
    blocks,
  };
}

export function switchProjectPage(project: SiteProject, pageId: string): SiteProject {
  const currentId = project.activePageId;
  const pages = (project.pages ?? []).map((page) => page.id === currentId ? { ...page, blocks: project.blocks } : page);
  const target = pages.find((page) => page.id === pageId);
  if (!target) return project;
  return { ...project, pages, activePageId: pageId, blocks: target.blocks };
}

/** Vide tous les emplacements d'image (blocs et éléments) en gardant les effets déjà réglés. */
export function clearAllImages(project: SiteProject): SiteProject {
  return {
    ...project,
    blocks: project.blocks.map((b) => ({
      ...b,
      content: {
        ...b.content,
        ...(b.content.image !== undefined ? { image: '', imageCredit: '' } : {}),
        ...(b.content.secondaryImage !== undefined ? { secondaryImage: '', secondaryImageCredit: '' } : {}),
        items: b.content.items?.map((it) => ({ ...it, ...(it.image !== undefined ? { image: '', imageCredit: '' } : {}) })),
      },
    })),
  };
}

/**
 * Mode inspiration : reporte sur le projet la mise en page, la navigation, les animations et les effets d'image
 * repérés dans la référence. Les blocs sont rapprochés des sections de l'analyse par type, dans l'ordre.
 */
export function applyInspirationEffects(project: SiteProject, analysis?: StructureAnalysis): SiteProject {
  if (!analysis) return project;
  const queues = new Map<string, NonNullable<StructureAnalysis['sections']>>();
  for (const section of analysis.sections ?? []) {
    const list = queues.get(section.blockType) ?? [];
    list.push(section);
    queues.set(section.blockType, list);
  }
  const blocks = project.blocks.map((b) => {
    const section = queues.get(b.type)?.shift();
    if (!section) return b;
    const effect = sanitizeImageEffect({ scroll: section.imageScroll, effect3d: section.image3d === 'before-after-slider' ? 'none' : section.image3d });
    const withEffect = hasAnyImageEffect(effect);
    return {
      ...b,
      animation: b.type === 'navbar' ? 'none' : sanitizeSectionAnimation(section.animation),
      content: {
        ...b.content,
        ...(withEffect && b.content.image !== undefined ? { imageEffect: effect } : {}),
        items: withEffect ? b.content.items?.map((it) => (it.image !== undefined ? { ...it, imageEffect: effect } : it)) : b.content.items,
      },
    };
  });
  return {
    ...project,
    blocks,
    theme: {
      ...project.theme,
      layoutMode: sanitizeLayoutMode(analysis.layoutMode),
      headerStyle: sanitizeHeaderStyle(analysis.headerStyle),
    },
  };
}

// --- Fichiers .forge.json -------------------------------------------------------------------------

export const FORGE_FORMAT = 'siteforge-project';
export const FORGE_VERSION = 1;
const MAX_FORGE_BYTES = 25 * 1024 * 1024;

export function serializeProject(project: SiteProject): string {
  return JSON.stringify({ format: FORGE_FORMAT, version: FORGE_VERSION, exportedAt: new Date().toISOString(), project }, null, 2);
}

export class ForgeFileError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = 4000): string | undefined => (typeof v === 'string' ? v.slice(0, max) : undefined);
const clampRange = (value: unknown, min: number, max: number, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : fallback;
};

function cleanImage(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  if (v === '') return '';
  return sanitizeUrl(v, '') || '';
}

function cleanItem(raw: unknown): BlockItem | null {
  if (!isObj(raw)) return null;
  const item: BlockItem = { ...(raw as unknown as BlockItem), id: str(raw.id, 80) || newId('itm'), title: str(raw.title, 400) ?? '' };
  if (raw.image !== undefined) item.image = cleanImage(raw.image);
  if (raw.imageEffect !== undefined) item.imageEffect = sanitizeImageEffect(raw.imageEffect);
  if (raw.linkHref !== undefined) item.linkHref = sanitizeUrl(String(raw.linkHref), '#contact');
  return item;
}

function cleanBlock(raw: unknown): SiteBlock | null {
  if (!isObj(raw) || typeof raw.type !== 'string') return null;
  const def = BLOCK_CATALOG.find((b) => b.type === raw.type);
  if (!def || !isObj(raw.content)) return null;
  const c = raw.content as Record<string, unknown>;
  const content = { ...(c as unknown as BlockContent) };
  for (const key of ['image', 'secondaryImage'] as const) if (c[key] !== undefined) content[key] = cleanImage(c[key]);
  for (const key of ['ctaHref', 'secondaryCtaHref'] as const) if (c[key] !== undefined) content[key] = sanitizeUrl(String(c[key]), '#contact');
  if (c.imageEffect !== undefined) content.imageEffect = sanitizeImageEffect(c.imageEffect);
  if (Array.isArray(c.items)) content.items = c.items.map(cleanItem).filter((i): i is BlockItem => i !== null).slice(0, 60);
  return {
    ...(raw as unknown as SiteBlock),
    id: str(raw.id, 80) || newId(def.type),
    type: def.type,
    variant: def.variants.some((v) => v.id === raw.variant) ? (raw.variant as string) : def.variants[0].id,
    visible: raw.visible !== false,
    animation: sanitizeSectionAnimation(raw.animation),
    animationDurationMs: clampDuration(raw.animationDurationMs),
    content,
  };
}

/**
 * Lit un fichier .forge.json : vérifie le format, nettoie les liens, les couleurs et les effets,
 * et donne au projet un nouvel identifiant pour ne jamais écraser un projet existant.
 */
export function parseForgeFile(text: string): SiteProject {
  if (text.length > MAX_FORGE_BYTES) throw new ForgeFileError('Fichier trop volumineux (25 Mo maximum).');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ForgeFileError('Ce fichier n’est pas un projet SiteForge valide (JSON illisible).');
  }
  if (!isObj(data) || data.format !== FORGE_FORMAT || !isObj(data.project)) {
    throw new ForgeFileError('Ce fichier n’est pas un projet SiteForge (.forge.json).');
  }
  if (typeof data.version === 'number' && data.version > FORGE_VERSION) {
    throw new ForgeFileError('Ce projet vient d’une version plus récente de SiteForge.');
  }
  const p = data.project as Record<string, unknown>;
  if (!Array.isArray(p.blocks) || !isObj(p.theme)) throw new ForgeFileError('Le projet est incomplet (sections ou thème manquants).');

  const base = createBlankProject(str(p.name, 120) || 'Projet importé');
  const t = p.theme as Record<string, unknown>;
  const pal = isObj(t.palette) ? t.palette : {};
  const palette = { ...base.theme.palette };
  for (const key of ['primary', 'secondary', 'background', 'surface', 'text', 'mutedText'] as const) {
    palette[key] = normalizeHex(String(pal[key] ?? '')) ?? palette[key];
  }
  const fonts = isObj(t.fonts) ? t.fonts : {};
  const now = new Date().toISOString();
  const importedBlocks = (p.blocks as unknown[]).map(cleanBlock).filter((b): b is SiteBlock => b !== null).slice(0, 80);
  const importedPages: SitePage[] = Array.isArray(p.pages)
    ? p.pages.flatMap((raw, index) => {
        if (!isObj(raw)) return [];
        const title = str(raw.title, 120) || `Page ${index + 1}`;
        const slug = (str(raw.slug, 80) || title).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || `page-${index + 1}`;
        const blocks = Array.isArray(raw.blocks)
          ? raw.blocks.map(cleanBlock).filter((b): b is SiteBlock => b !== null).slice(0, 80)
          : [];
        return [{ id: str(raw.id, 80) || newId('page'), title, slug, blocks }];
      })
    : [];
  const pages = importedPages.length ? importedPages : [{ id: newId('page'), title: 'Accueil', slug: 'accueil', blocks: importedBlocks }];
  const activePageId = pages.some((page) => page.id === p.activePageId) ? String(p.activePageId) : pages[0].id;
  const activePage = pages.find((page) => page.id === activePageId)!;
  const rawSettings = isObj(p.settings) ? p.settings : {};
  const rawNavbar = isObj(rawSettings.navbar) ? rawSettings.navbar : {};
  const navbar: NavbarConfig = {
    ...DEFAULT_NAVBAR_CONFIG,
    variant: ['sticky-full', 'floating-pill', 'floating-wide', 'sidebar-drawer'].includes(String(rawNavbar.variant))
      ? rawNavbar.variant as NavbarConfig['variant']
      : DEFAULT_NAVBAR_CONFIG.variant,
    opacity: clampRange(rawNavbar.opacity, 0, 100, DEFAULT_NAVBAR_CONFIG.opacity),
    blurPx: clampRange(rawNavbar.blurPx, 0, 32, DEFAULT_NAVBAR_CONFIG.blurPx),
    borderRadiusPx: clampRange(rawNavbar.borderRadiusPx, 0, 999, DEFAULT_NAVBAR_CONFIG.borderRadiusPx),
    borderOpacity: clampRange(rawNavbar.borderOpacity, 0, 100, DEFAULT_NAVBAR_CONFIG.borderOpacity),
    shrinkOnScroll: rawNavbar.shrinkOnScroll === true,
    autoHideOnScrollDown: rawNavbar.autoHideOnScrollDown === true,
    activeIndicator: ['pill', 'underline', 'glow', 'none'].includes(String(rawNavbar.activeIndicator))
      ? rawNavbar.activeIndicator as NavbarConfig['activeIndicator']
      : DEFAULT_NAVBAR_CONFIG.activeIndicator,
  };
  const formProviders: FormProvider[] = ['none', 'formsubmit', 'web3forms', 'formspree', 'netlify', 'mailto', 'whatsapp'];
  return {
    ...(p as unknown as SiteProject),
    id: newId('prj'),
    name: base.name,
    seoTitle: str(p.seoTitle, 200) ?? base.name,
    seoDescription: str(p.seoDescription, 400) ?? '',
    isDemo: false,
    theme: {
      ...base.theme,
      ...(t as object),
      mode: t.mode === 'dark' ? 'dark' : 'light',
      palette,
      fonts: {
        ...base.theme.fonts,
        heading: str(fonts.heading, 80) || base.theme.fonts.heading,
        body: str(fonts.body, 80) || base.theme.fonts.body,
      },
      layoutMode: sanitizeLayoutMode(t.layoutMode),
      headerStyle: sanitizeHeaderStyle(t.headerStyle),
      visitorThemeToggle: t.visitorThemeToggle === true,
    },
    blocks: activePage.blocks,
    pages,
    activePageId,
    settings: {
      formProvider: formProviders.includes(rawSettings.formProvider as FormProvider) ? rawSettings.formProvider as FormProvider : 'none',
      formEmail: str(rawSettings.formEmail, 160),
      formKey: str(rawSettings.formKey, 200),
      whatsappNumber: str(rawSettings.whatsappNumber, 30),
      siteUrl: str(rawSettings.siteUrl, 300),
      successMessage: str(rawSettings.successMessage, 300),
      navbar,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function downloadForgeFile(project: SiteProject): void {
  const blob = new Blob([serializeProject(project)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'projet'}.forge.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

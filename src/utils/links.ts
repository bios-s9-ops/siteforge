import type { BlockType, SiteBlock, SiteProject } from '../types/site';
import { sanitizeUrl } from './validation';

/** Ancre canonique de chaque type de section (la barre de navigation et le pied de page n'en ont pas). */
export const TYPE_ANCHOR: Partial<Record<BlockType, string>> = {
  hero: 'accueil',
  about: 'apropos',
  services: 'services',
  gallery: 'galerie',
  products: 'produits',
  pricing: 'tarifs',
  testimonials: 'temoignages',
  faq: 'faq',
  stats: 'chiffres',
  team: 'equipe',
  logos: 'partenaires',
  cta: 'action',
  contact: 'contact',
};

/** Noms de sections que Gemini ou l'utilisateur écrivent souvent, ramenés au type de bloc. */
const ALIASES: Record<string, BlockType> = {
  accueil: 'hero',
  home: 'hero',
  haut: 'hero',
  hero: 'hero',
  apropos: 'about',
  about: 'about',
  histoire: 'about',
  notrehistoire: 'about',
  quisommesnous: 'about',
  atelier: 'about',
  services: 'services',
  service: 'services',
  prestations: 'services',
  offres: 'services',
  expertise: 'services',
  savoirfaire: 'services',
  fonctionnalites: 'services',
  galerie: 'gallery',
  gallery: 'gallery',
  realisations: 'gallery',
  projets: 'gallery',
  portfolio: 'gallery',
  creations: 'gallery',
  photos: 'gallery',
  produits: 'products',
  produit: 'products',
  catalogue: 'products',
  boutique: 'products',
  shop: 'products',
  carte: 'products',
  menu: 'products',
  tarifs: 'pricing',
  tarif: 'pricing',
  prix: 'pricing',
  pricing: 'pricing',
  formules: 'pricing',
  temoignages: 'testimonials',
  avis: 'testimonials',
  testimonials: 'testimonials',
  faq: 'faq',
  questions: 'faq',
  chiffres: 'stats',
  stats: 'stats',
  statistiques: 'stats',
  equipe: 'team',
  team: 'team',
  partenaires: 'logos',
  logos: 'logos',
  action: 'cta',
  cta: 'cta',
  contact: 'contact',
  contactez: 'contact',
  contactezmoi: 'contact',
  contacteznous: 'contact',
  nouscontacter: 'contact',
  devis: 'contact',
  rdv: 'contact',
  rendezvous: 'contact',
  reservation: 'contact',
  reserver: 'contact',
  commander: 'contact',
  commande: 'contact',
  ecrire: 'contact',
};

export interface AnchorMap {
  /** block.id → id d'ancre unique dans la page exportée */
  byBlockId: Map<string, string>;
  /** type de bloc → ancre de la première section de ce type */
  firstByType: Map<BlockType, string>;
  /** toutes les ancres existantes dans la page */
  ids: Set<string>;
}

function normalizeKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Construit les ancres des sections réellement affichées (les blocs masqués n'existent pas dans l'export).
 * Deux blocs du même type reçoivent des ancres distinctes (« services », « services-2 »…) : jamais d'id en double.
 */
export function buildAnchorMap(blocks: SiteBlock[]): AnchorMap {
  const byBlockId = new Map<string, string>();
  const firstByType = new Map<BlockType, string>();
  const ids = new Set<string>(['top']);
  const counters = new Map<string, number>();

  for (const block of blocks) {
    if (!block.visible) continue;
    const base = TYPE_ANCHOR[block.type];
    if (!base) continue;
    const n = (counters.get(base) ?? 0) + 1;
    counters.set(base, n);
    const id = n === 1 ? base : `${base}-${n}`;
    byBlockId.set(block.id, id);
    ids.add(id);
    if (!firstByType.has(block.type)) firstByType.set(block.type, id);
  }
  return { byBlockId, firstByType, ids };
}

export interface ResolvedLink {
  href: string;
  /** true pour http(s) : ouvert dans un nouvel onglet avec rel="noopener noreferrer" */
  external: boolean;
}

export interface ResolveOptions {
  /** Si le lien est vide ou cassé, pointer vers la section contact quand elle existe. */
  fallbackToContact?: boolean;
}

function contactFallback(anchors: AnchorMap, opts?: ResolveOptions): ResolvedLink | null {
  if (!opts?.fallbackToContact) return null;
  const target = anchors.firstByType.get('contact');
  return target ? { href: `#${target}`, external: false } : null;
}

/**
 * Transforme un lien saisi ou généré en lien qui fonctionne vraiment dans le site exporté.
 * Renvoie null quand rien ne peut fonctionner : l'appelant retire alors le lien (jamais de lien mort).
 */
export function resolveHref(raw: string | undefined, anchors: AnchorMap, opts?: ResolveOptions): ResolvedLink | null {
  const value = (raw ?? '').trim();
  if (!value || value === '#' || value === '#!') return contactFallback(anchors, opts);

  if (value.startsWith('#')) {
    const key = value.slice(1);
    if (anchors.ids.has(key)) return { href: `#${key}`, external: false };

    const type = ALIASES[normalizeKey(key)];
    if (type) {
      const target = anchors.firstByType.get(type);
      if (target) return { href: `#${target}`, external: false };
      if (type === 'hero') return { href: '#top', external: false };
    }
    return contactFallback(anchors, opts);
  }

  const safe = sanitizeUrl(value, '');
  if (!safe) return contactFallback(anchors, opts);
  if (/^https?:\/\//i.test(safe)) return { href: safe, external: true };
  if (/^(mailto:|tel:|sms:)/i.test(safe)) return { href: safe, external: false };
  if (safe.startsWith('assets/')) return { href: safe, external: false };

  // Chemin relatif (« contact.html », « /tarifs ») : le site exporté tient sur une seule page.
  return contactFallback(anchors, opts);
}

/** Attributs HTML d'un lien résolu (déjà échappés par l'appelant via escapeHtml sur href). */
export function externalAttrs(link: ResolvedLink): string {
  return link.external ? ' target="_blank" rel="noopener noreferrer"' : '';
}

export interface LinkIssue {
  blockId: string;
  blockType: BlockType;
  label: string;
  href: string;
  reason: string;
}

/**
 * Liste les liens qui seraient retirés de l'export parce qu'aucune section ne correspond.
 * Les boutons d'action qui peuvent retomber sur la section contact ne sont pas des problèmes.
 */
export function collectLinkIssues(project: Pick<SiteProject, 'blocks'>): LinkIssue[] {
  const anchors = buildAnchorMap(project.blocks);
  const issues: LinkIssue[] = [];

  const check = (block: SiteBlock, label: string, href: string | undefined, fallback: boolean) => {
    if (!label?.trim()) return;
    if (resolveHref(href, anchors, { fallbackToContact: fallback })) return;
    issues.push({
      blockId: block.id,
      blockType: block.type,
      label,
      href: href ?? '',
      reason: href?.startsWith('#')
        ? `Aucune section « ${href} » dans la page : le lien est retiré de l'export.`
        : 'Lien vide ou non valide : il est retiré de l\'export.',
    });
  };

  for (const block of project.blocks) {
    if (!block.visible) continue;
    const c = block.content;
    const isNav = block.type === 'navbar' || block.type === 'footer';
    for (const item of c.items ?? []) {
      if (isNav) check(block, item.title, item.linkHref, false);
      else if (item.linkLabel) check(block, item.linkLabel, item.linkHref, true);
    }
    if (c.ctaLabel && block.type !== 'contact') check(block, c.ctaLabel, c.ctaHref, true);
    if (c.secondaryCtaLabel) check(block, c.secondaryCtaLabel, c.secondaryCtaHref, true);
  }
  return issues;
}

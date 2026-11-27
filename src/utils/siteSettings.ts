import type { CSSProperties } from 'react';
import type { NavbarConfig, SiteBlock, SiteProject, SiteSettings } from '../types/site';
import { isEmptyOrTodo } from './honesty';
import { sanitizeUrl } from './validation';

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  formProvider: 'none',
};

export const DEFAULT_NAVBAR_CONFIG: NavbarConfig = {
  variant: 'sticky-full',
  opacity: 96,
  blurPx: 16,
  borderRadiusPx: 24,
  borderOpacity: 20,
  shrinkOnScroll: true,
  autoHideOnScrollDown: false,
  activeIndicator: 'underline',
};

export function getSiteSettings(project: Pick<SiteProject, 'settings'>): SiteSettings {
  return {
    ...DEFAULT_SITE_SETTINGS,
    ...(project.settings ?? {}),
    navbar: { ...DEFAULT_NAVBAR_CONFIG, ...(project.settings?.navbar ?? {}) },
  };
}

const CUSTOM_STYLE_PROPERTIES: Record<string, string> = {
  color: 'color',
  'background-color': 'backgroundColor',
  'border-color': 'borderColor',
  'border-width': 'borderWidth',
  'border-style': 'borderStyle',
  'font-size': 'fontSize',
  'font-weight': 'fontWeight',
  'letter-spacing': 'letterSpacing',
  'line-height': 'lineHeight',
  'text-align': 'textAlign',
  'text-transform': 'textTransform',
  'box-shadow': 'boxShadow',
  'border-radius': 'borderRadius',
  opacity: 'opacity',
};

/** CSS limité à des déclarations visuelles sans URL, règles imbriquées ni contenu exécutable. */
export function parseSafeBlockCss(css?: string): CSSProperties {
  const styles: Record<string, string> = {};
  for (const declaration of (css ?? '').slice(0, 2000).split(';')) {
    const separator = declaration.indexOf(':');
    if (separator < 1) continue;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim();
    const reactProperty = CUSTOM_STYLE_PROPERTIES[property];
    if (!reactProperty || !value || /url\s*\(|expression\s*\(|[{}<>\\@]/i.test(value)) continue;
    styles[reactProperty] = value.slice(0, 120);
  }
  return styles as CSSProperties;
}

export function serializeSafeBlockCss(css?: string): string {
  return Object.entries(parseSafeBlockCss(css))
    .map(([property, value]) => `${property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${String(value).replace(/[;"<>]/g, '')}`)
    .join(';');
}

export function isValidEmail(value?: string): boolean {
  if (!value) return false;
  return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(value.trim());
}

/** Renvoie l'e-mail nettoyé, ou une chaîne vide s'il est absent, « À compléter » ou invalide. */
export function cleanEmail(value?: string): string {
  if (isEmptyOrTodo(value)) return '';
  const v = (value ?? '').trim();
  return isValidEmail(v) ? v : '';
}

/** Ne garde que les chiffres (et un + initial) pour un lien tel:. */
export function toTelHref(value?: string): string {
  if (isEmptyOrTodo(value)) return '';
  const raw = (value ?? '').trim();
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length < 6) return '';
  return `tel:${raw.startsWith('+') ? '+' : ''}${digits}`;
}

/** Numéro WhatsApp en chiffres uniquement (format international, sans + ni 00). */
export function normalizeWhatsappNumber(value?: string): string {
  if (!value) return '';
  let digits = value.replace(/[^\d]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}

export function buildWhatsappUrl(number: string, text?: string): string {
  const n = normalizeWhatsappNumber(number);
  if (!n) return '';
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** Adresse publique du site : http(s) obligatoire, sans barre finale. */
export function normalizeSiteUrl(value?: string): string {
  if (!value) return '';
  const v = value.trim();
  if (!/^https?:\/\/[^\s/$.?#][^\s]*$/i.test(v)) return '';
  try {
    const u = new URL(v);
    return `${u.origin}${u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '')}`;
  } catch {
    return '';
  }
}

export function findContactBlock(project: Pick<SiteProject, 'blocks'>): SiteBlock | undefined {
  return project.blocks.find((b) => b.type === 'contact' && b.visible);
}

export function findContactEmail(project: Pick<SiteProject, 'blocks'>): string {
  for (const b of project.blocks) {
    if (b.type !== 'contact' || !b.visible) continue;
    const mail = cleanEmail(b.content.email);
    if (mail) return mail;
  }
  return '';
}

/** Adresse qui reçoit réellement les messages : réglage dédié, sinon e-mail du bloc contact. */
export function resolveFormEmail(project: Pick<SiteProject, 'settings' | 'blocks'>): string {
  return cleanEmail(project.settings?.formEmail) || findContactEmail(project);
}

const SOCIAL_LABELS: Array<[RegExp, string]> = [
  [/(^|\.)instagram\.com$/i, 'Instagram'],
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$/i, 'Facebook'],
  [/(^|\.)tiktok\.com$/i, 'TikTok'],
  [/(^|\.)(x|twitter)\.com$/i, 'X'],
  [/(^|\.)linkedin\.com$/i, 'LinkedIn'],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/i, 'YouTube'],
  [/(^|\.)pinterest\.[a-z.]+$/i, 'Pinterest'],
  [/(^|\.)wa\.me$|(^|\.)whatsapp\.com$/i, 'WhatsApp'],
  [/(^|\.)snapchat\.com$/i, 'Snapchat'],
  [/(^|\.)threads\.net$/i, 'Threads'],
];

export interface SocialLink {
  label: string;
  href: string;
}

/** Extrait les liens https:// du texte libre « réseaux sociaux » saisi par l'utilisateur. Rien n'est inventé. */
export function parseSocialLinks(text?: string): SocialLink[] {
  if (!text) return [];
  const found = text.match(/https?:\/\/[^\s,;<>"']+/gi) ?? [];
  const seen = new Set<string>();
  const links: SocialLink[] = [];
  for (const raw of found) {
    const href = sanitizeUrl(raw.replace(/[.)]+$/, ''), '');
    if (!href || !/^https?:\/\//i.test(href) || seen.has(href)) continue;
    seen.add(href);
    let host = '';
    try {
      host = new URL(href).hostname.replace(/^www\./, '');
    } catch {
      continue;
    }
    const label = SOCIAL_LABELS.find(([re]) => re.test(host))?.[1] ?? host;
    links.push({ label, href });
  }
  return links.slice(0, 8);
}

/**
 * Options du champ « Service concerné » d'un formulaire de devis :
 * titres des éléments du bloc s'il en a, sinon titres réels des blocs Services / Produits / Tarifs.
 * Les valeurs « À compléter » sont ignorées : rien n'est inventé.
 */
export function deriveQuoteOptions(project: Pick<SiteProject, 'blocks'>, block: SiteBlock): string[] {
  const own = (block.content.items ?? []).map((i) => i.title).filter((t) => !isEmptyOrTodo(t));
  if (own.length > 0) return Array.from(new Set(own)).slice(0, 12);

  for (const type of ['services', 'products', 'pricing'] as const) {
    const source = project.blocks.find((b) => b.type === type && b.visible);
    const titles = (source?.content.items ?? []).map((i) => i.title).filter((t) => !isEmptyOrTodo(t));
    if (titles.length > 0) return Array.from(new Set(titles)).slice(0, 12);
  }
  return [];
}

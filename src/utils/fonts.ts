import { sanitizeFontName } from './validation';

export type FontCategory = 'serif' | 'sans' | 'display' | 'mono';

export interface FontEntry {
  name: string;
  category: FontCategory;
  /** Graisses disponibles sur Google Fonts, ex. « 400;500;600;700 » ou « 400 » pour une police à graisse unique */
  weights: string;
}

const W4 = '400;500;600;700';

/** Polices de caractère proposées dans le sélecteur. Toute autre police Google Fonts peut être saisie à la main. */
export const FONT_CATALOG: FontEntry[] = [
  { name: 'Fraunces', category: 'serif', weights: W4 },
  { name: 'Cormorant Garamond', category: 'serif', weights: W4 },
  { name: 'Lora', category: 'serif', weights: W4 },
  { name: 'Playfair Display', category: 'serif', weights: W4 },
  { name: 'Bodoni Moda', category: 'serif', weights: W4 },
  { name: 'Newsreader', category: 'serif', weights: W4 },
  { name: 'Source Serif 4', category: 'serif', weights: W4 },
  { name: 'Spectral', category: 'serif', weights: W4 },
  { name: 'EB Garamond', category: 'serif', weights: W4 },
  { name: 'Crimson Pro', category: 'serif', weights: W4 },
  { name: 'Libre Baskerville', category: 'serif', weights: '400;700' },
  { name: 'Instrument Serif', category: 'serif', weights: '400' },
  { name: 'DM Serif Display', category: 'serif', weights: '400' },
  { name: 'Hanken Grotesk', category: 'sans', weights: W4 },
  { name: 'Schibsted Grotesk', category: 'sans', weights: W4 },
  { name: 'Libre Franklin', category: 'sans', weights: W4 },
  { name: 'IBM Plex Sans', category: 'sans', weights: W4 },
  { name: 'Public Sans', category: 'sans', weights: W4 },
  { name: 'Bricolage Grotesque', category: 'sans', weights: W4 },
  { name: 'Work Sans', category: 'sans', weights: W4 },
  { name: 'Figtree', category: 'sans', weights: W4 },
  { name: 'Karla', category: 'sans', weights: W4 },
  { name: 'Rubik', category: 'sans', weights: W4 },
  { name: 'Archivo', category: 'sans', weights: W4 },
  { name: 'Sora', category: 'sans', weights: W4 },
  { name: 'Lexend', category: 'sans', weights: W4 },
  { name: 'Albert Sans', category: 'sans', weights: W4 },
  { name: 'Epilogue', category: 'sans', weights: W4 },
  { name: 'Be Vietnam Pro', category: 'sans', weights: W4 },
  { name: 'Syne', category: 'display', weights: W4 },
  { name: 'Unbounded', category: 'display', weights: W4 },
  { name: 'Abril Fatface', category: 'display', weights: '400' },
  { name: 'Archivo Black', category: 'display', weights: '400' },
  { name: 'Anton', category: 'display', weights: '400' },
  { name: 'Bebas Neue', category: 'display', weights: '400' },
  { name: 'Caveat', category: 'display', weights: '400;700' },
  { name: 'JetBrains Mono', category: 'mono', weights: W4 },
  { name: 'IBM Plex Mono', category: 'mono', weights: W4 },
  { name: 'Space Mono', category: 'mono', weights: '400;700' },
];

export const FONT_CATEGORY_LABELS: Record<FontCategory, string> = {
  serif: 'Serif',
  sans: 'Sans serif',
  display: 'Titrage',
  mono: 'Monospace',
};

export function findFont(name: string): FontEntry | undefined {
  const n = name.trim().toLowerCase();
  return FONT_CATALOG.find((f) => f.name.toLowerCase() === n);
}

/**
 * Paramètre « family= » de l'API Google Fonts.
 * Une police inconnue du catalogue est demandée sans graisses : les graisses inexistantes feraient échouer toute la requête.
 */
export function fontFamilyParam(name: string): string {
  const clean = sanitizeFontName(name, 'Hanken Grotesk');
  const entry = findFont(clean);
  const encoded = clean.replace(/\s+/g, '+');
  return entry ? `family=${encoded}:wght@${entry.weights}` : `family=${encoded}`;
}

export function googleFontsHref(names: string[]): string {
  const unique = Array.from(new Set(names.filter(Boolean)));
  return `https://fonts.googleapis.com/css2?${unique.map(fontFamilyParam).join('&')}&display=swap`;
}

export function genericFallback(name: string): string {
  const entry = findFont(name);
  if (!entry) return 'system-ui, sans-serif';
  if (entry.category === 'serif') return 'Georgia, serif';
  if (entry.category === 'mono') return 'ui-monospace, monospace';
  if (entry.category === 'display') return 'system-ui, sans-serif';
  return 'system-ui, sans-serif';
}

const loadedFonts = new Set<string>();

/**
 * Charge une police Google Fonts dans la page d'édition pour la voir telle quelle (sélecteur de polices, aperçu).
 * Sans effet hors navigateur.
 */
export function ensureGoogleFontLoaded(name: string): void {
  if (typeof document === 'undefined') return;
  const clean = sanitizeFontName(name, '');
  if (!clean || loadedFonts.has(clean)) return;
  loadedFonts.add(clean);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = googleFontsHref([clean]);
  link.setAttribute('data-sf-font', clean);
  document.head.appendChild(link);
}

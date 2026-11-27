import type { SitePalette } from '../types/site';

export type HarmonyKind = 'analogous' | 'complementary' | 'triadic' | 'split' | 'monochrome';

export const HARMONY_LABELS: Record<HarmonyKind, string> = {
  analogous: 'Voisines',
  complementary: 'Complémentaire',
  triadic: 'Triade',
  split: 'Complémentaire éclatée',
  monochrome: 'Monochrome',
};

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Normalise une saisie « f60 », « #FF6600 »… en « #FF6600 ». Renvoie null si ce n'est pas une couleur. */
export function normalizeHex(input: string): string | null {
  const m = HEX_RE.exec(input.trim());
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  return `#${hex.toUpperCase()}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex) ?? '#000000';
  return { r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let rgb: [number, number, number];
  if (hh < 60) rgb = [c, x, 0];
  else if (hh < 120) rgb = [x, c, 0];
  else if (hh < 180) rgb = [0, c, x];
  else if (hh < 240) rgb = [0, x, c];
  else if (hh < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return rgbToHex((rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255);
}

/** Luminance relative (WCAG) */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const f = (v: number) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Pousse la luminosité d'un texte jusqu'à atteindre le contraste demandé sur un fond. */
export function ensureContrast(foreground: string, background: string, minRatio: number): string {
  if (contrastRatio(foreground, background) >= minRatio) return foreground;
  const { h, s } = hexToHsl(foreground);
  const darkBg = luminance(background) < 0.4;
  for (let l = hexToHsl(foreground).l; darkBg ? l <= 98 : l >= 2; l += darkBg ? 2 : -2) {
    const candidate = hslToHex(h, s, l);
    if (contrastRatio(candidate, background) >= minRatio) return candidate;
  }
  return darkBg ? '#FFFFFF' : '#000000';
}

/**
 * Construit une palette complète (6 rôles) à partir d'une seule couleur principale.
 * Le texte garde un contraste d'au moins 4,5:1 sur le fond, le texte atténué 3:1 minimum.
 */
export function generateHarmony(primaryInput: string, kind: HarmonyKind, dark = false): SitePalette {
  const primary = normalizeHex(primaryInput) ?? '#7C2D12';
  const { h, s, l } = hexToHsl(primary);
  const sat = Math.max(25, Math.min(85, s));

  let secondaryHue = h;
  if (kind === 'analogous') secondaryHue = h + 30;
  else if (kind === 'complementary') secondaryHue = h + 180;
  else if (kind === 'triadic') secondaryHue = h + 120;
  else if (kind === 'split') secondaryHue = h + 150;

  const secondary =
    kind === 'monochrome' ? hslToHex(h, Math.max(15, sat - 25), Math.min(78, l + 28)) : hslToHex(secondaryHue, sat, Math.max(35, Math.min(60, l)));

  const background = dark ? hslToHex(h, Math.min(sat, 25), 8) : hslToHex(h, Math.min(sat, 30), 97);
  const surface = dark ? hslToHex(h, Math.min(sat, 25), 13) : hslToHex(h, Math.min(sat, 28), 93);
  const text = ensureContrast(dark ? hslToHex(h, 12, 94) : hslToHex(h, 25, 10), background, 7);
  const mutedText = ensureContrast(dark ? hslToHex(h, 10, 68) : hslToHex(h, 12, 38), background, 4.5);

  return { primary, secondary, background, surface, text, mutedText };
}

export function generateAllHarmonies(primary: string, dark = false): Array<{ kind: HarmonyKind; label: string; palette: SitePalette }> {
  return (Object.keys(HARMONY_LABELS) as HarmonyKind[]).map((kind) => ({
    kind,
    label: HARMONY_LABELS[kind],
    palette: generateHarmony(primary, kind, dark),
  }));
}

/**
 * Version claire ou sombre d'une palette existante (bouton clair / sombre du visiteur).
 * Les couleurs de marque gardent leur teinte mais sont éclaircies ou assombries pour rester lisibles (3:1 minimum).
 */
export function deriveAlternatePalette(palette: SitePalette, toDark: boolean): SitePalette {
  const base = generateHarmony(palette.primary, 'monochrome', toDark);
  return {
    ...base,
    primary: ensureContrast(palette.primary, base.background, 3),
    secondary: ensureContrast(palette.secondary, base.background, 3),
  };
}

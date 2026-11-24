export interface GeneratedHarmony {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  darkBackground: string;
  darkSurface: string;
  darkText: string;
  darkMuted: string;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace('#', '').padEnd(6, '0');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function generateHarmonyFromPrimary(primaryHex: string): GeneratedHarmony {
  const { h, s } = hexToHsl(primaryHex);
  const accentHue = (h + 28) % 360;
  return {
    primary: primaryHex,
    secondary: hslToHex(accentHue, Math.min(85, Math.max(45, s)), 48),
    background: hslToHex(h, 14, 98),
    surface: hslToHex(h, 12, 94),
    text: hslToHex(h, 20, 10),
    muted: hslToHex(h, 12, 38),
    darkBackground: hslToHex(h, 18, 7),
    darkSurface: hslToHex(h, 16, 12),
    darkText: hslToHex(h, 10, 96),
    darkMuted: hslToHex(h, 10, 68),
  };
}

const loadedFonts = new Set<string>();

export function ensureGoogleFontLoaded(fontName: string) {
  if (typeof document === 'undefined' || !fontName) return;
  const clean = fontName.trim();
  if (!clean || loadedFonts.has(clean)) return;
  loadedFonts.add(clean);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(clean)}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

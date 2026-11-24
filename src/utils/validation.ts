const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Échappe les caractères spéciaux HTML pour éviter toute injection XSS lors de l'export.
 */
export function escapeHtml(input: unknown): string {
  const str = typeof input === 'string' ? input : String(input ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Valide et assainit une URL pour les attributs href/src (bloque javascript:, vbscript:, data:text/html).
 */
export function sanitizeUrl(rawUrl: string | undefined, fallback = '#'): string {
  if (!rawUrl) return fallback;
  const trimmed = rawUrl.trim();
  if (!trimmed) return fallback;

  if (trimmed.startsWith('#') || trimmed.startsWith('/src/assets/') || trimmed.startsWith('assets/')) {
    return trimmed;
  }

  if (trimmed.startsWith('data:image/')) {
    // Autorise uniquement les images raster ou SVG encodés proprement (pas de data:text/html)
    if (
      /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(trimmed) ||
      /^data:image\/svg\+xml;utf8,/i.test(trimmed)
    ) {
      return trimmed;
    }
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, 'https://example.org');
    if (SAFE_PROTOCOLS.has(parsed.protocol)) {
      return trimmed;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Valide une couleur hexadécimale CSS pour éviter toute injection de style.
 */
export function sanitizeColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  const trimmed = color.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return trimmed;
  }
  return fallback;
}

/**
 * Vérifie qu'une chaîne correspond à un nom de police Google Fonts sûr.
 */
export function sanitizeFontName(font: string | undefined, fallback: string): string {
  if (!font) return fallback;
  const clean = font.trim();
  if (/^[A-Za-z0-9\s\-]+$/.test(clean) && clean.length <= 60) {
    return clean;
  }
  return fallback;
}

/**
 * Calcule le contraste relatif approximatif pour choisir du texte clair ou foncé sur un bouton accent.
 */
export function getContrastTextColor(hexColor: string): '#FFFFFF' | '#0F172A' {
  const clean = hexColor.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return '#FFFFFF';
  }
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.58 ? '#0F172A' : '#FFFFFF';
}

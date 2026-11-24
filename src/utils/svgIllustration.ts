import { sanitizeColor } from './validation';

export interface SvgCompositionSpec {
  title: string;
  backgroundStart: string;
  backgroundEnd: string;
  accentColor: string;
  secondaryAccent: string;
  motif: 'architecture' | 'organic' | 'geometric' | 'minimal';
}

/**
 * Génère une illustration vectorielle propre encodée en Data URL SVG à partir de paramètres structurés validés.
 */
export function buildSafeSvgDataUrl(spec: SvgCompositionSpec): string {
  const bg1 = sanitizeColor(spec.backgroundStart, '#F1F5F9');
  const bg2 = sanitizeColor(spec.backgroundEnd, '#E2E8F0');
  const accent = sanitizeColor(spec.accentColor, '#1E40AF');
  const secondary = sanitizeColor(spec.secondaryAccent, '#0F766E');

  let motifShapes = '';
  if (spec.motif === 'organic') {
    motifShapes = `
      <circle cx="580" cy="180" r="150" fill="${accent}" fill-opacity="0.16" />
      <path d="M120 440 C220 260, 420 280, 560 440 Z" fill="${secondary}" fill-opacity="0.28" />
      <circle cx="290" cy="240" r="88" fill="${accent}" fill-opacity="0.82" />
      <path d="M360 150 Q520 220 490 420" stroke="${bg2}" stroke-width="6" fill="none" stroke-linecap="round" />
    `;
  } else if (spec.motif === 'architecture') {
    motifShapes = `
      <rect x="140" y="130" width="230" height="310" rx="8" fill="${accent}" fill-opacity="0.88" />
      <rect x="330" y="190" width="290" height="250" rx="8" fill="${secondary}" fill-opacity="0.35" />
      <rect x="390" y="95" width="160" height="210" rx="6" fill="none" stroke="${accent}" stroke-width="4" />
      <line x1="80" y1="440" x2="720" y2="440" stroke="${accent}" stroke-width="3" stroke-opacity="0.5" />
    `;
  } else if (spec.motif === 'minimal') {
    motifShapes = `
      <circle cx="400" cy="260" r="145" fill="${accent}" fill-opacity="0.14" />
      <circle cx="400" cy="260" r="85" fill="${accent}" fill-opacity="0.85" />
      <rect x="210" y="370" width="380" height="16" rx="8" fill="${secondary}" fill-opacity="0.5" />
    `;
  } else {
    motifShapes = `
      <polygon points="180,410 340,120 500,410" fill="${accent}" fill-opacity="0.85" />
      <circle cx="520" cy="220" r="95" fill="${secondary}" fill-opacity="0.65" />
      <rect x="140" y="140" width="120" height="120" rx="16" fill="none" stroke="${accent}" stroke-width="4" />
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" role="img" aria-label="${spec.title.replace(/"/g, '')}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg1}" />
      <stop offset="100%" stop-color="${bg2}" />
    </linearGradient>
  </defs>
  <rect width="800" height="520" fill="url(#g)" />
  ${motifShapes}
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

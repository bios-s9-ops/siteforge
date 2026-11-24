import type {
  ArtDirectionId,
  SiteColorMode,
  SitePalette,
  SiteRadius,
  SiteSpacing,
  SiteTheme,
  ThemeBorderStyle,
  ThemeButtonStyle,
} from '../types/site';

/**
 * Identité visuelle propre de l'interface SiteForge (distincte des 8 directions des sites générés).
 */
export const SITEFORGE_UI_IDENTITY = {
  name: 'Atelier Papier Chaud',
  background: '#FBF8F3',
  surface: '#FFFFFF',
  surfaceAlt: '#F4EFE6',
  border: '#E5DEC9',
  ink: '#1C1917',
  mutedInk: '#57534E',
  accent: '#9A3412',
  accentHover: '#7C2D12',
  honestyAccent: '#B45309',
  headingFont: 'Newsreader',
  bodyFont: 'IBM Plex Sans',
  monoFont: 'JetBrains Mono',
} as const;

/**
 * Polices interdites dans SiteForge et dans toutes les directions artistiques générées.
 */
export const BANNED_FONTS = [
  'Inter',
  'Roboto',
  'Poppins',
  'Space Grotesk',
  'Montserrat',
  'Plus Jakarta Sans',
  'Outfit',
  'DM Sans',
  'Manrope',
] as const;

export const ALLOWED_SITE_FONTS = [
  'Cormorant Garamond',
  'Lora',
  'Fraunces',
  'Libre Franklin',
  'Bodoni Moda',
  'Hanken Grotesk',
  'Bricolage Grotesque',
  'Schibsted Grotesk',
  'Instrument Serif',
  'Playfair Display',
  'IBM Plex Sans',
] as const;

export interface ArtDirectionPreset {
  id: ArtDirectionId;
  label: string;
  tagline: string;
  mode: SiteColorMode;
  palette: SitePalette;
  fonts: {
    name: string;
    heading: string;
    body: string;
  };
  borderRadius: SiteRadius;
  spacing: SiteSpacing;
  buttonStyle: ThemeButtonStyle;
  borderStyle: ThemeBorderStyle;
}

export const ART_DIRECTIONS: ArtDirectionPreset[] = [
  {
    id: 'editorial',
    label: 'Éditorial',
    tagline: 'Grands titres serif, filets fins et respiration littéraire',
    mode: 'light',
    palette: {
      name: 'Papier & Bordeaux',
      primary: '#7F1D1D',
      secondary: '#44403C',
      background: '#FAF8F4',
      surface: '#F3EFE7',
      text: '#171717',
      mutedText: '#57534E',
    },
    fonts: {
      name: 'Cormorant Garamond & Lora',
      heading: 'Cormorant Garamond',
      body: 'Lora',
    },
    borderRadius: 'none',
    spacing: 'airy',
    buttonStyle: 'sharp',
    borderStyle: 'hairline',
  },
  {
    id: 'artisanal',
    label: 'Artisanal chaleureux',
    tagline: 'Lin naturel, encre noyer et accent ocre miel',
    mode: 'light',
    palette: {
      name: 'Lin & Ocre Miel',
      primary: '#B45309',
      secondary: '#57534E',
      background: '#F9F5EE',
      surface: '#EFE7D8',
      text: '#292524',
      mutedText: '#57534E',
    },
    fonts: {
      name: 'Fraunces & Libre Franklin',
      heading: 'Fraunces',
      body: 'Libre Franklin',
    },
    borderRadius: 'md',
    spacing: 'normal',
    buttonStyle: 'soft',
    borderStyle: 'subtle',
  },
  {
    id: 'minimal_luxe',
    label: 'Minimal luxe',
    tagline: 'Noir et blanc cassé structuré par un accent vert bouteille',
    mode: 'light',
    palette: {
      name: 'Blanc Cassé & Vert Bouteille',
      primary: '#1B4332',
      secondary: '#262626',
      background: '#F7F6F2',
      surface: '#ECEBE4',
      text: '#111111',
      mutedText: '#525252',
    },
    fonts: {
      name: 'Bodoni Moda & Hanken Grotesk',
      heading: 'Bodoni Moda',
      body: 'Hanken Grotesk',
    },
    borderRadius: 'none',
    spacing: 'airy',
    buttonStyle: 'editorial',
    borderStyle: 'hairline',
  },
  {
    id: 'brutaliste_doux',
    label: 'Brutaliste doux',
    tagline: 'Craie matte, traits francs et accent bleu cobalt',
    mode: 'light',
    palette: {
      name: 'Craie & Bleu Cobalt',
      primary: '#1D4ED8',
      secondary: '#111111',
      background: '#F4F4F0',
      surface: '#E8E8E1',
      text: '#111111',
      mutedText: '#404040',
    },
    fonts: {
      name: 'Bricolage Grotesque & Schibsted Grotesk',
      heading: 'Bricolage Grotesque',
      body: 'Schibsted Grotesk',
    },
    borderRadius: 'none',
    spacing: 'normal',
    buttonStyle: 'offset-brutal',
    borderStyle: 'strong',
  },
  {
    id: 'vibrant',
    label: 'Vibrant coloré',
    tagline: 'Crème solaire, accent corail franc et contraste net',
    mode: 'light',
    palette: {
      name: 'Crème & Corail',
      primary: '#E11D48',
      secondary: '#78350F',
      background: '#FFFDF7',
      surface: '#FEF3C7',
      text: '#18181B',
      mutedText: '#52525B',
    },
    fonts: {
      name: 'Bricolage Grotesque & Hanken Grotesk',
      heading: 'Bricolage Grotesque',
      body: 'Hanken Grotesk',
    },
    borderRadius: 'lg',
    spacing: 'normal',
    buttonStyle: 'pill-clean',
    borderStyle: 'subtle',
  },
  {
    id: 'nature',
    label: 'Nature / organique',
    tagline: 'Brume végétale, vert forêt et accent mousse olive',
    mode: 'light',
    palette: {
      name: 'Sauge & Mousse Olive',
      primary: '#3F6212',
      secondary: '#1B2E22',
      background: '#F4F7F2',
      surface: '#E6ECE2',
      text: '#1B2E22',
      mutedText: '#475E4E',
    },
    fonts: {
      name: 'Instrument Serif & Libre Franklin',
      heading: 'Instrument Serif',
      body: 'Libre Franklin',
    },
    borderRadius: 'lg',
    spacing: 'airy',
    buttonStyle: 'soft',
    borderStyle: 'subtle',
  },
  {
    id: 'retro_imprime',
    label: 'Rétro-imprimé',
    tagline: 'Papier journal teinté, filets doubles et bleu nuit',
    mode: 'light',
    palette: {
      name: 'Papier Journal & Bleu Nuit',
      primary: '#1E3A8A',
      secondary: '#5C5346',
      background: '#F3EDE2',
      surface: '#E8DFCF',
      text: '#1F1B18',
      mutedText: '#5C5346',
    },
    fonts: {
      name: 'Playfair Display & Lora',
      heading: 'Playfair Display',
      body: 'Lora',
    },
    borderRadius: 'none',
    spacing: 'normal',
    buttonStyle: 'sharp',
    borderStyle: 'double-rule',
  },
  {
    id: 'technique_sobre',
    label: 'Technique sobre',
    tagline: 'Ardoise nocturne, grille précise et bleu acier',
    mode: 'dark',
    palette: {
      name: 'Ardoise & Bleu Acier',
      primary: '#0284C7',
      secondary: '#38BDF8',
      background: '#0F1419',
      surface: '#161E27',
      text: '#F1F5F9',
      mutedText: '#94A3B8',
    },
    fonts: {
      name: 'Schibsted Grotesk & IBM Plex Sans',
      heading: 'Schibsted Grotesk',
      body: 'IBM Plex Sans',
    },
    borderRadius: 'sm',
    spacing: 'normal',
    buttonStyle: 'sharp',
    borderStyle: 'hairline',
  },
];

export const CURATED_FONT_PAIRINGS = ART_DIRECTIONS.map((dir) => ({
  id: dir.id,
  name: dir.fonts.name,
  heading: dir.fonts.heading,
  body: dir.fonts.body,
  description: dir.label,
}));

export function getArtDirectionPreset(id?: ArtDirectionId): ArtDirectionPreset {
  return ART_DIRECTIONS.find((d) => d.id === id) ?? ART_DIRECTIONS[0];
}

export function applyArtDirectionToTheme(directionId: ArtDirectionId): SiteTheme {
  const preset = getArtDirectionPreset(directionId);
  return {
    artDirection: preset.id,
    mode: preset.mode,
    palette: { ...preset.palette },
    fonts: { ...preset.fonts },
    borderRadius: preset.borderRadius,
    spacing: preset.spacing,
    buttonStyle: preset.buttonStyle,
    borderStyle: preset.borderStyle,
  };
}

export function pickArtDirectionFromMood(mood: string): ArtDirectionId {
  const m = mood.toLowerCase();
  if (m.includes('sombre') || m.includes('techno')) return 'technique_sobre';
  if (m.includes('éditorial') || m.includes('editorial') || m.includes('raffin')) return 'editorial';
  if (m.includes('minimal') || m.includes('luxe')) return 'minimal_luxe';
  if (m.includes('brutal')) return 'brutaliste_doux';
  if (m.includes('vibrant') || m.includes('dynamique') || m.includes('color')) return 'vibrant';
  if (m.includes('nature') || m.includes('organique')) return 'nature';
  if (m.includes('rétro') || m.includes('retro') || m.includes('imprim')) return 'retro_imprime';
  if (m.includes('artisan') || m.includes('chaleureux')) return 'artisanal';
  return 'editorial';
}

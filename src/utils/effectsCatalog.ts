import type {
  HeaderNavStyle,
  Image3DEffect,
  ImageEffectConfig,
  ImageScrollEffect,
  SectionAnimationType,
  SiteLayoutMode,
} from '../types/site';

export interface CatalogOption<T extends string> {
  id: T;
  label: string;
  description: string;
}

export const LAYOUT_MODES: CatalogOption<SiteLayoutMode>[] = [
  { id: 'vertical', label: 'Vertical éditorial', description: 'Lecture classique de haut en bas, section après section.' },
  { id: 'horizontal-slides', label: 'Diapositives horizontales', description: 'Chaque section occupe l’écran ; la molette fait défiler de gauche à droite.' },
  { id: 'bento-grid', label: 'Grille bento', description: 'Sections en cartes modulaires de tailles variées.' },
  { id: 'split-screen', label: 'Écran partagé', description: 'Un visuel reste fixe d’un côté pendant que le contenu défile de l’autre.' },
  { id: 'scroll-story', label: 'Récit au défilement', description: 'Les sections se superposent et se révèlent au fil du défilement.' },
];

export const HEADER_STYLES: CatalogOption<HeaderNavStyle>[] = [
  { id: 'classic-bar', label: 'Barre classique', description: 'Barre pleine largeur en haut de page.' },
  { id: 'floating-glass', label: 'Flottante translucide', description: 'Pastille flottante au-dessus du contenu, fond flouté.' },
  { id: 'vertical-sidebar', label: 'Barre latérale', description: 'Navigation fixée sur le côté gauche.' },
  { id: 'minimal-centered', label: 'Minimale centrée', description: 'Nom au centre, liens discrets en dessous.' },
  { id: 'hidden', label: 'Masquée', description: 'Aucune navigation visible.' },
];

export const IMAGE_SCROLL_EFFECTS: CatalogOption<ImageScrollEffect>[] = [
  { id: 'none', label: 'Aucun', description: 'L’image reste immobile.' },
  { id: 'parallax-slow', label: 'Parallaxe lente', description: 'L’image se déplace plus doucement que la page.' },
  { id: 'parallax-fast', label: 'Parallaxe rapide', description: 'L’image se déplace plus vite que la page.' },
  { id: 'scroll-zoom-in', label: 'Zoom avant', description: 'L’image grossit en entrant dans l’écran.' },
  { id: 'scroll-zoom-out', label: 'Zoom arrière', description: 'L’image rétrécit pendant le défilement.' },
  { id: 'scroll-reveal-curtain', label: 'Rideau', description: 'L’image se dévoile comme un rideau qui s’ouvre.' },
  { id: 'sticky-showcase', label: 'Vitrine fixe', description: 'L’image reste collée pendant que le texte défile.' },
  { id: 'horizontal-drift', label: 'Dérive horizontale', description: 'L’image glisse latéralement pendant le défilement.' },
  { id: 'scroll-rotate-subtle', label: 'Rotation légère', description: 'L’image pivote très légèrement au défilement.' },
];

export const IMAGE_3D_EFFECTS: CatalogOption<Image3DEffect>[] = [
  { id: 'none', label: 'Aucun', description: 'Image à plat.' },
  { id: 'tilt-3d-hover', label: 'Inclinaison 3D', description: 'L’image s’incline en suivant le pointeur.' },
  { id: 'float-3d-shadow', label: 'Flottement 3D', description: 'Image surélevée avec ombre dynamique.' },
  { id: 'isometric-card', label: 'Carte isométrique', description: 'Image présentée en perspective isométrique.' },
  { id: 'device-frame-3d', label: 'Cadre d’appareil 3D', description: 'Image dans un cadre d’écran en perspective.' },
  { id: 'glass-refraction', label: 'Verre réfractant', description: 'Reflet de verre qui suit le pointeur.' },
  { id: 'spotlight-glow', label: 'Projecteur', description: 'Halo lumineux qui suit le pointeur.' },
  { id: 'before-after-slider', label: 'Avant / après', description: 'Curseur à glisser pour comparer deux images.' },
  { id: 'magnifier-loupe', label: 'Loupe', description: 'Zoom en lentille au survol.' },
  { id: 'ken-burns-loop', label: 'Ken Burns', description: 'Lent zoom et panoramique en boucle.' },
];

export const SECTION_ANIMATIONS: CatalogOption<SectionAnimationType>[] = [
  { id: 'none', label: 'Aucune', description: 'La section est visible tout de suite.' },
  { id: 'fade-in', label: 'Fondu', description: 'Apparition progressive.' },
  { id: 'fade-up', label: 'Fondu vers le haut', description: 'Apparaît en montant légèrement.' },
  { id: 'fade-down', label: 'Fondu vers le bas', description: 'Apparaît en descendant légèrement.' },
  { id: 'slide-left', label: 'Glissement depuis la gauche', description: 'Entre par la gauche.' },
  { id: 'slide-right', label: 'Glissement depuis la droite', description: 'Entre par la droite.' },
  { id: 'zoom-in', label: 'Zoom avant', description: 'Apparaît en grossissant.' },
  { id: 'zoom-out', label: 'Zoom arrière', description: 'Apparaît en se resserrant.' },
  { id: 'flip-up', label: 'Bascule', description: 'Se redresse comme une carte qu’on retourne.' },
  { id: 'stagger-children', label: 'Cascade', description: 'Les éléments de la section apparaissent l’un après l’autre.' },
];

const ids = <T extends string>(list: CatalogOption<T>[]): T[] => list.map((o) => o.id);

export const LAYOUT_MODE_IDS = ids(LAYOUT_MODES);
export const HEADER_STYLE_IDS = ids(HEADER_STYLES);
export const IMAGE_SCROLL_EFFECT_IDS = ids(IMAGE_SCROLL_EFFECTS);
export const IMAGE_3D_EFFECT_IDS = ids(IMAGE_3D_EFFECTS);
export const SECTION_ANIMATION_IDS = ids(SECTION_ANIMATIONS);

export const DEFAULT_IMAGE_EFFECT: ImageEffectConfig = {
  scroll: 'none',
  scrollIntensity: 50,
  effect3d: 'none',
  effect3dIntensity: 50,
};

export const DEFAULT_ANIMATION_MS = 700;
export const MIN_ANIMATION_MS = 150;
export const MAX_ANIMATION_MS = 3000;

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export const clampIntensity = (value: unknown, fallback = 50): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback;
};

export const clampDuration = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.max(MIN_ANIMATION_MS, Math.min(MAX_ANIMATION_MS, Math.round(n))) : DEFAULT_ANIMATION_MS;
};

export const sanitizeLayoutMode = (v: unknown): SiteLayoutMode => pick(v, LAYOUT_MODE_IDS, 'vertical');
export const sanitizeHeaderStyle = (v: unknown): HeaderNavStyle => pick(v, HEADER_STYLE_IDS, 'classic-bar');
export const sanitizeSectionAnimation = (v: unknown): SectionAnimationType => pick(v, SECTION_ANIMATION_IDS, 'none');

/** Rend une configuration d'effet valide, même si elle vient de l'IA, d'un import ou d'un ancien projet. */
export function sanitizeImageEffect(raw: unknown): ImageEffectConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    scroll: pick(r.scroll, IMAGE_SCROLL_EFFECT_IDS, 'none'),
    scrollIntensity: clampIntensity(r.scrollIntensity),
    effect3d: pick(r.effect3d, IMAGE_3D_EFFECT_IDS, 'none'),
    effect3dIntensity: clampIntensity(r.effect3dIntensity),
  };
}

export const hasAnyImageEffect = (e?: ImageEffectConfig): boolean =>
  Boolean(e && (e.scroll !== 'none' || e.effect3d !== 'none'));

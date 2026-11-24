export type SiteLayoutMode =
  | 'vertical'
  | 'horizontal-slides'
  | 'bento-grid'
  | 'split-screen'
  | 'scroll-story';

export type HeaderNavStyle =
  | 'classic-bar'
  | 'floating-glass'
  | 'vertical-sidebar'
  | 'minimal-centered'
  | 'hidden';

export type ImageScrollEffect =
  | 'none'
  | 'parallax-slow'
  | 'parallax-fast'
  | 'scroll-zoom-in'
  | 'scroll-zoom-out'
  | 'scroll-reveal-curtain'
  | 'sticky-showcase'
  | 'horizontal-drift'
  | 'scroll-rotate-subtle';

export type Image3DEffect =
  | 'none'
  | 'tilt-3d-hover'
  | 'float-3d-shadow'
  | 'isometric-card'
  | 'device-frame-3d'
  | 'glass-refraction'
  | 'spotlight-glow'
  | 'before-after-slider'
  | 'magnifier-loupe'
  | 'ken-burns-loop';

export type SectionAnimationType =
  | 'none'
  | 'fade-in'
  | 'fade-up'
  | 'fade-down'
  | 'slide-left'
  | 'slide-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'flip-up'
  | 'stagger-children';

export interface ImageEffectConfig {
  scrollEffect: ImageScrollEffect;
  effect3D: Image3DEffect;
  intensity: number; // 1 à 100
  secondaryImage?: string; // Utilisé pour before-after-slider
  borderGlowColor?: string;
}

export const SITE_LAYOUT_OPTIONS: Array<{ id: SiteLayoutMode; label: string; description: string }> = [
  { id: 'vertical', label: 'Vertical fluide', description: 'Sections empilées classiques avec rythme éditorial.' },
  { id: 'horizontal-slides', label: 'Horizontal plein écran', description: 'Navigation latérale par écrans successifs (molette & flèches).' },
  { id: 'bento-grid', label: 'Grille Bento modulaire', description: 'Cartes asymétriques modernes façon vitrine tech.' },
  { id: 'split-screen', label: 'Écran scindé (Split)', description: 'Colonne visuelle fixe à gauche et contenu défilant à droite.' },
  { id: 'scroll-story', label: 'Vitrine narrative (Scroll)', description: 'Enchaînement visuel immersif synchronisé au défilement.' },
];

export const HEADER_STYLE_OPTIONS: Array<{ id: HeaderNavStyle; label: string }> = [
  { id: 'classic-bar', label: 'Barre supérieure classique' },
  { id: 'floating-glass', label: 'Pilule flottante translucide (Glass)' },
  { id: 'vertical-sidebar', label: 'Menu latéral vertical fixe' },
  { id: 'minimal-centered', label: 'En-tête minimaliste centré' },
  { id: 'hidden', label: 'Sans barre de navigation' },
];

export const IMAGE_SCROLL_OPTIONS: Array<{ id: ImageScrollEffect; label: string }> = [
  { id: 'none', label: 'Aucun effet de défilement' },
  { id: 'parallax-slow', label: 'Parallaxe douce' },
  { id: 'parallax-fast', label: 'Parallaxe prononcée' },
  { id: 'scroll-zoom-in', label: 'Zoom progressif au scroll (façon smartphone)' },
  { id: 'scroll-zoom-out', label: 'Dézoom grand angle au scroll' },
  { id: 'scroll-reveal-curtain', label: 'Révélation rideau au défilement' },
  { id: 'sticky-showcase', label: 'Vitrine épinglée (Sticky Showcase)' },
  { id: 'horizontal-drift', label: 'Glissement latéral au scroll' },
  { id: 'scroll-rotate-subtle', label: 'Rotation légère au défilement' },
];

export const IMAGE_3D_OPTIONS: Array<{ id: Image3DEffect; label: string }> = [
  { id: 'none', label: 'Aucun effet 3D' },
  { id: 'tilt-3d-hover', label: 'Inclinaison 3D interactive (souris)' },
  { id: 'float-3d-shadow', label: 'Lévitation 3D + ombre portée dynamique' },
  { id: 'isometric-card', label: 'Perspective vitrine isométrique' },
  { id: 'device-frame-3d', label: 'Cadre produit / smartphone 3D' },
  { id: 'glass-refraction', label: 'Reflet verre & lumière dynamique' },
  { id: 'spotlight-glow', label: 'Halo lumineux interactif' },
  { id: 'before-after-slider', label: 'Comparateur glissant Avant / Après' },
  { id: 'magnifier-loupe', label: 'Loupe haute précision au survol' },
  { id: 'ken-burns-loop', label: 'Mouvement cinéma continu (Ken Burns)' },
];

export const SECTION_ANIMATION_OPTIONS: Array<{ id: SectionAnimationType; label: string }> = [
  { id: 'none', label: 'Aucune animation' },
  { id: 'fade-in', label: 'Fondu simple (Fade In)' },
  { id: 'fade-up', label: 'Apparition vers le haut (Fade Up)' },
  { id: 'fade-down', label: 'Apparition vers le bas (Fade Down)' },
  { id: 'slide-left', label: 'Glissement depuis la gauche' },
  { id: 'slide-right', label: 'Glissement depuis la droite' },
  { id: 'zoom-in', label: 'Zoom entrant fluide' },
  { id: 'zoom-out', label: 'Zoom sortant subtil' },
  { id: 'flip-up', label: 'Basculer en 3D (Flip Up)' },
  { id: 'stagger-children', label: 'Cascade progressive sur les cartes' },
];

export const DEFAULT_IMAGE_EFFECT: ImageEffectConfig = {
  scrollEffect: 'none',
  effect3D: 'none',
  intensity: 50,
};

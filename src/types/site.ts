export type BlockType =
  | 'navbar'
  | 'hero'
  | 'about'
  | 'services'
  | 'gallery'
  | 'products'
  | 'pricing'
  | 'testimonials'
  | 'faq'
  | 'stats'
  | 'team'
  | 'logos'
  | 'cta'
  | 'contact'
  | 'footer';

export type ViewportMode = 'desktop' | 'tablet' | 'mobile';
export type SiteRadius = 'none' | 'sm' | 'md' | 'lg' | 'full';
export type SiteSpacing = 'compact' | 'normal' | 'airy';
export type SiteColorMode = 'light' | 'dark';

export type ArtDirectionId =
  | 'editorial'
  | 'artisanal'
  | 'minimal_luxe'
  | 'brutaliste_doux'
  | 'vibrant'
  | 'nature'
  | 'retro_imprime'
  | 'technique_sobre';

export type ThemeButtonStyle = 'sharp' | 'editorial' | 'soft' | 'offset-brutal' | 'pill-clean';
export type ThemeBorderStyle = 'hairline' | 'subtle' | 'strong' | 'double-rule';

/** Architecture de la page : sens de lecture et organisation des sections. */
export type SiteLayoutMode = 'vertical' | 'horizontal-slides' | 'bento-grid' | 'split-screen' | 'scroll-story';

/** Style de la navigation en tête de page (ou latérale). */
export type HeaderNavStyle = 'classic-bar' | 'floating-glass' | 'vertical-sidebar' | 'minimal-centered' | 'hidden';
export type NavbarVariant = 'sticky-full' | 'floating-pill' | 'floating-wide' | 'sidebar-drawer';
export type NavbarActiveIndicator = 'pill' | 'underline' | 'glow' | 'none';

export interface NavbarConfig {
  variant: NavbarVariant;
  opacity: number;
  blurPx: number;
  borderRadiusPx: number;
  borderOpacity: number;
  shrinkOnScroll: boolean;
  autoHideOnScrollDown: boolean;
  activeIndicator: NavbarActiveIndicator;
}

/** Effet d'une image lié au défilement de la page. */
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

/** Effet 3D ou interactif d'une image. */
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

/** Animation d'entrée d'une section quand elle apparaît à l'écran. */
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
  scroll: ImageScrollEffect;
  /** 0 à 100 */
  scrollIntensity: number;
  effect3d: Image3DEffect;
  /** 0 à 100 */
  effect3dIntensity: number;
}

export interface SitePalette {
  name?: string;
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  mutedText: string;
}

export interface SiteFonts {
  name?: string;
  heading: string;
  body: string;
}

export interface SiteTheme {
  artDirection?: ArtDirectionId;
  mode: SiteColorMode;
  palette: SitePalette;
  fonts: SiteFonts;
  borderRadius: SiteRadius;
  spacing: SiteSpacing;
  buttonStyle?: ThemeButtonStyle;
  borderStyle?: ThemeBorderStyle;
  layoutMode?: SiteLayoutMode;
  headerStyle?: HeaderNavStyle;
  /** Affiche un bouton clair / sombre pour le visiteur, dans l'aperçu et dans le site exporté */
  visitorThemeToggle?: boolean;
  liquidGlass?: boolean;
  customCss?: string;
}

export interface BlockStyleOverride {
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  glassMode?: boolean;
  opacity?: number;
  blurPx?: number;
  backgroundGradient?: string;
  paddingY?: number;
  borderRadius?: number;
  shadowDepth?: number;
  customCss?: string;
}

export interface BlockItem {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  price?: string;
  badge?: string;
  image?: string;
  imageAlt?: string;
  /** Crédit de la photo libre de droits (auteur, licence, source) */
  imageCredit?: string;
  imageEffect?: ImageEffectConfig;
  linkLabel?: string;
  linkHref?: string;
  meta?: string;
  features?: string[];
  highlighted?: boolean;
}

export interface BlockContent {
  brandName?: string;
  kicker?: string;
  heading?: string;
  subheading?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  image?: string;
  imageAlt?: string;
  imageCredit?: string;
  imageEffect?: ImageEffectConfig;
  /** Seconde image (comparateur avant / après) */
  secondaryImage?: string;
  secondaryImageAlt?: string;
  secondaryImageCredit?: string;
  email?: string;
  phone?: string;
  address?: string;
  copyright?: string;
  items?: BlockItem[];
}

export interface SiteBlock {
  id: string;
  type: BlockType;
  variant: string;
  visible: boolean;
  styleOverride?: BlockStyleOverride;
  animation?: SectionAnimationType;
  animationDurationMs?: number;
  content: BlockContent;
}

export interface OriginalityReport {
  checked: boolean;
  status: 'original' | 'corrected' | 'not_applicable';
  summary: string;
  adjustments: string[];
  checkedAt: string;
}

export interface StructureSectionBlueprint {
  blockType: BlockType;
  variantHint: string;
  layoutStyle: string;
  purpose: string;
  columnCount: number;
  spacingNote: string;
  /** Effets repérés dans la référence : animation d'entrée, effet d'image au défilement, effet 3D */
  animation?: SectionAnimationType;
  imageScroll?: ImageScrollEffect;
  image3d?: Image3DEffect;
}

export interface StructureAnalysis {
  pageGoal: string;
  layoutRhythm: string;
  visualHierarchy: string;
  /** Architecture et navigation repérées dans la référence */
  layoutMode?: SiteLayoutMode;
  headerStyle?: HeaderNavStyle;
  sections: StructureSectionBlueprint[];
}

export interface UploadedFactPhoto {
  id: string;
  name: string;
  dataUrl: string;
  isPersonPhoto: boolean;
}

export interface RealFactsInput {
  productsOrServices?: string;
  prices?: string;
  address?: string;
  phone?: string;
  email?: string;
  socialLinks?: string;
  testimonials?: string;
  teamMembers?: string;
  stats?: string;
  partnerLogos?: string;
  uploadedPhotos?: UploadedFactPhoto[];
  personMediaConsent?: boolean;
}

export interface ProjectInput {
  mode: 'inspiration' | 'scratch' | 'ai';
  /** Mode « Générer avec l'IA » : de quoi parle le site */
  description?: string;
  /** Mode « Générer avec l'IA » : ambiance, couleurs, sensation de mise en page, effets souhaités */
  vision?: string;
  /** Mode « Générer avec l'IA » : sections et contenus indispensables */
  mustHave?: string;
  activity: string;
  siteName: string;
  mood: string;
  artDirection?: ArtDirectionId;
  targetAudience: string;
  goal: string;
  referenceMode?: 'image' | 'url' | 'description';
  referenceUrl?: string;
  referenceDescription?: string;
  realFacts?: RealFactsInput;
}

/**
 * Comment les messages du formulaire arrivent au propriétaire du site.
 * - none : rien n'est configuré (repli sur l'e-mail du bloc contact si présent, sinon message d'erreur honnête)
 * - formsubmit : service tiers FormSubmit (adresse e-mail suffit, activation par e-mail au 1er envoi)
 * - web3forms : service tiers Web3Forms (clé d'accès publique)
 * - formspree : service tiers Formspree (identifiant de formulaire)
 * - netlify : Netlify Forms (uniquement si le site est hébergé chez Netlify)
 * - mailto : ouvre la messagerie du visiteur avec le message prérempli
 * - whatsapp : ouvre WhatsApp avec le message prérempli
 */
export type FormProvider = 'none' | 'formsubmit' | 'web3forms' | 'formspree' | 'netlify' | 'mailto' | 'whatsapp';

export interface SiteSettings {
  formProvider: FormProvider;
  navbar?: NavbarConfig;
  /** Adresse qui reçoit les messages (FormSubmit, mailto). Par défaut : e-mail du bloc contact. */
  formEmail?: string;
  /** Clé d'accès Web3Forms ou identifiant Formspree (partie après /f/). */
  formKey?: string;
  /** Numéro WhatsApp au format international (chiffres, avec ou sans +). */
  whatsappNumber?: string;
  /** Adresse publique du site (https://...), utilisée pour canonical, sitemap et partage. */
  siteUrl?: string;
  /** Message affiché après un envoi réussi. */
  successMessage?: string;
}

export interface SiteProject {
  id: string;
  name: string;
  seoTitle: string;
  seoDescription: string;
  isDemo?: boolean;
  settings?: SiteSettings;
  theme: SiteTheme;
  blocks: SiteBlock[];
  /** Pages du site; `blocks` reste la page active pour compatibilité historique. */
  pages?: SitePage[];
  activePageId?: string;
  originalityReport?: OriginalityReport;
  structureAnalysis?: StructureAnalysis;
  projectInput?: ProjectInput;
  createdAt: string;
  updatedAt: string;
}

export interface SitePage {
  id: string;
  title: string;
  slug: string;
  blocks: SiteBlock[];
}

export type SiteMutation =
  | { type: 'UPDATE_NAVBAR'; patch: Partial<NavbarConfig> }
  | { type: 'SET_GLOBAL_STYLE'; patch: Record<string, unknown> }
  | { type: 'ADD_PAGE'; page: SitePage }
  | { type: 'ADD_BLOCK'; pageId: string; index?: number; block: SiteBlock }
  | { type: 'UPDATE_BLOCK'; pageId: string; blockId: string; patch: Partial<SiteBlock> }
  | { type: 'DELETE_BLOCK'; pageId: string; blockId: string }
  | { type: 'APPLY_CUSTOM_CSS'; target: 'global' | string; css: string };

export interface AIMutateResponse {
  assistantMessage: string;
  mutations: SiteMutation[];
}

export interface BlockVariantOption {
  id: string;
  label: string;
  description: string;
}

export interface BlockDefinition {
  type: BlockType;
  label: string;
  category: 'Navigation' | 'Contenu' | 'Preuve sociale' | 'Conversion';
  description: string;
  variants: BlockVariantOption[];
  createDefaultContent: (siteName?: string) => BlockContent;
}

export interface PaletteSuggestion {
  name: string;
  rationale: string;
  mode: SiteColorMode;
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  mutedText: string;
}

export interface FontPairSuggestion {
  name: string;
  rationale: string;
  heading: string;
  body: string;
}

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
}

export interface BlockStyleOverride {
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
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
}

export interface StructureAnalysis {
  pageGoal: string;
  layoutRhythm: string;
  visualHierarchy: string;
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
  mode: 'inspiration' | 'scratch';
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
  originalityReport?: OriginalityReport;
  structureAnalysis?: StructureAnalysis;
  projectInput?: ProjectInput;
  createdAt: string;
  updatedAt: string;
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

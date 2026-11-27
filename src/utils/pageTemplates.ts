import type { BlockType, SiteBlock } from '../types/site';
import { createBlockInstance } from './blockCatalog';

export const TEMPLATE_CATEGORIES = ['Accueil', 'Services', 'Produits', 'Tarifs', 'À propos', 'Galerie', 'Contact'] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export interface PageTemplate {
  id: string;
  label: string;
  category: TemplateCategory;
  description: string;
  blocks: Array<{ type: BlockType; variant?: string }>;
}

/**
 * Modèles de page : seulement une suite de sections. Aucun texte, chiffre, avis ni image n'est inventé :
 * les contenus factuels (tarifs, équipe, coordonnées) arrivent en champs « À compléter ».
 */
export const PAGE_TEMPLATES: PageTemplate[] = [
  { id: 'home-classic', label: 'Accueil classique', category: 'Accueil', description: 'Présentation, services, histoire, appel à l’action, contact.', blocks: [{ type: 'navbar' }, { type: 'hero' }, { type: 'services' }, { type: 'about' }, { type: 'cta' }, { type: 'contact' }, { type: 'footer' }] },
  { id: 'home-landing', label: 'Page d’atterrissage', category: 'Accueil', description: 'Une promesse, trois arguments, une question fréquente, un bouton.', blocks: [{ type: 'navbar' }, { type: 'hero' }, { type: 'services' }, { type: 'faq' }, { type: 'cta' }, { type: 'footer' }] },
  { id: 'services-quote', label: 'Services avec devis', category: 'Services', description: 'Vos prestations, vos questions fréquentes et un formulaire de devis.', blocks: [{ type: 'navbar' }, { type: 'hero' }, { type: 'services' }, { type: 'faq' }, { type: 'contact', variant: 'devis' }, { type: 'footer' }] },
  { id: 'services-process', label: 'Services détaillés', category: 'Services', description: 'Services, histoire de l’atelier et contact.', blocks: [{ type: 'navbar' }, { type: 'services' }, { type: 'about' }, { type: 'contact' }, { type: 'footer' }] },
  { id: 'products-catalog', label: 'Catalogue', category: 'Produits', description: 'Vos produits, une galerie et un contact.', blocks: [{ type: 'navbar' }, { type: 'hero' }, { type: 'products' }, { type: 'gallery' }, { type: 'contact' }, { type: 'footer' }] },
  { id: 'pricing-simple', label: 'Tarifs et questions', category: 'Tarifs', description: 'Vos formules, les questions fréquentes, le contact.', blocks: [{ type: 'navbar' }, { type: 'hero' }, { type: 'pricing' }, { type: 'faq' }, { type: 'contact' }, { type: 'footer' }] },
  { id: 'about-story', label: 'Notre histoire', category: 'À propos', description: 'Votre histoire et vos services.', blocks: [{ type: 'navbar' }, { type: 'hero' }, { type: 'about' }, { type: 'services' }, { type: 'footer' }] },
  { id: 'about-team', label: 'Histoire et équipe', category: 'À propos', description: 'Histoire et équipe (noms et photos à renseigner par vous).', blocks: [{ type: 'navbar' }, { type: 'about' }, { type: 'team' }, { type: 'contact' }, { type: 'footer' }] },
  { id: 'gallery-portfolio', label: 'Portfolio', category: 'Galerie', description: 'Une galerie en vedette et un mot sur vous.', blocks: [{ type: 'navbar' }, { type: 'hero' }, { type: 'gallery' }, { type: 'about' }, { type: 'contact' }, { type: 'footer' }] },
  { id: 'contact-only', label: 'Contact et devis', category: 'Contact', description: 'Formulaire de devis seul.', blocks: [{ type: 'navbar' }, { type: 'contact', variant: 'devis' }, { type: 'footer' }] },
];

export function buildTemplateBlocks(template: PageTemplate, siteName?: string): SiteBlock[] {
  return template.blocks.map((b) => {
    const block = createBlockInstance(b.type, siteName);
    return b.variant ? { ...block, variant: b.variant } : block;
  });
}

/**
 * Applique un modèle à la page : « replace » remplace tout ; « append » ajoute les sections avant le pied de page,
 * sans dupliquer la navigation ni le pied de page.
 */
export function applyTemplate(existing: SiteBlock[], template: PageTemplate, mode: 'replace' | 'append', siteName?: string): SiteBlock[] {
  const built = buildTemplateBlocks(template, siteName);
  if (mode === 'replace' || existing.length === 0) return built;
  const hasNavbar = existing.some((b) => b.type === 'navbar');
  const hasFooter = existing.some((b) => b.type === 'footer');
  const incoming = built.filter((b) => !(b.type === 'navbar' && hasNavbar) && !(b.type === 'footer' && hasFooter));
  const footerIndex = existing.findIndex((b) => b.type === 'footer');
  const at = footerIndex === -1 ? existing.length : footerIndex;
  return [...existing.slice(0, at), ...incoming.filter((b) => b.type !== 'footer'), ...existing.slice(at), ...incoming.filter((b) => b.type === 'footer')];
}

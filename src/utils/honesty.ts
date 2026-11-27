import type { BlockType, RealFactsInput, SiteBlock, SiteProject, SiteTheme } from '../types/site';
import { BANNED_FONTS } from './artDirections';

export const TODO_MARKER = 'À compléter';

export const DEMO_FICTION_BANNER_TEXT =
  'Exemple fictif — Ce projet est une démonstration. Remplacez tous les contenus par vos informations réelles avant mise en ligne.';

export const FACTUAL_EXCLUDABLE_BLOCKS: BlockType[] = ['testimonials', 'stats', 'team', 'logos'];

export const BANNED_BUZZWORDS = [
  'révolutionnez',
  'revolutionnez',
  'libérez le potentiel',
  'liberez le potentiel',
  'solution tout-en-un',
  'solution tout en un',
  'découvrez',
  'decouvrez',
  'propulsez',
  'boostez',
  'débloquez',
  'debloquez',
  'synergie',
  'game-changer',
  'next-gen',
];

export interface IncompleteField {
  id: string;
  blockId: string;
  blockType: BlockType;
  blockLabel: string;
  itemId?: string;
  fieldKey: string;
  fieldLabel: string;
  currentValue: string;
}

const BLOCK_LABELS: Record<BlockType, string> = {
  navbar: 'Barre de navigation',
  hero: 'Hero',
  about: 'À propos',
  services: 'Services',
  gallery: 'Galerie',
  products: 'Produits / Catalogue',
  pricing: 'Tarifs',
  testimonials: 'Témoignages',
  faq: 'FAQ',
  stats: 'Statistiques',
  team: 'Équipe',
  logos: 'Logos partenaires',
  cta: 'Appel à l’action',
  contact: 'Formulaire de contact',
  footer: 'Pied de page',
};

export function isTodoValue(value?: string): boolean {
  if (value === undefined || value === null) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'à compléter' || normalized === 'a completer' || normalized.includes('[à compléter]');
}

export function isEmptyOrTodo(value?: string): boolean {
  return !value || !value.trim() || isTodoValue(value);
}

/**
 * Recense tous les champs factuels marqués "À compléter" ou laissés vides sur les blocs factuels.
 */
export function collectIncompleteFields(project: SiteProject): IncompleteField[] {
  const results: IncompleteField[] = [];

  for (const block of project.blocks) {
    if (!block.visible) continue;
    const label = BLOCK_LABELS[block.type] ?? block.type;
    const c = block.content;

    if (block.type === 'contact') {
      if (isEmptyOrTodo(c.email)) {
        results.push({
          id: `${block.id}:email`,
          blockId: block.id,
          blockType: block.type,
          blockLabel: label,
          fieldKey: 'email',
          fieldLabel: 'Adresse e-mail',
          currentValue: c.email || '',
        });
      }
      if (isEmptyOrTodo(c.phone)) {
        results.push({
          id: `${block.id}:phone`,
          blockId: block.id,
          blockType: block.type,
          blockLabel: label,
          fieldKey: 'phone',
          fieldLabel: 'Numéro de téléphone',
          currentValue: c.phone || '',
        });
      }
      if (isEmptyOrTodo(c.address)) {
        results.push({
          id: `${block.id}:address`,
          blockId: block.id,
          blockType: block.type,
          blockLabel: label,
          fieldKey: 'address',
          fieldLabel: 'Adresse postale',
          currentValue: c.address || '',
        });
      }
    }

    const checkFieldText = (val: string | undefined, fieldKey: string, fieldLabel: string, itemId?: string) => {
      if (isTodoValue(val)) {
        results.push({
          id: `${block.id}:${itemId ?? 'root'}:${fieldKey}`,
          blockId: block.id,
          blockType: block.type,
          blockLabel: label,
          itemId,
          fieldKey,
          fieldLabel,
          currentValue: val || '',
        });
      }
    };

    checkFieldText(c.heading, 'heading', 'Titre');
    checkFieldText(c.subheading, 'subheading', 'Sous-titre');
    checkFieldText(c.body, 'body', 'Texte');

    for (const item of c.items ?? []) {
      checkFieldText(item.title, 'title', `Élément (${item.title || 'sans titre'})`, item.id);
      checkFieldText(item.subtitle, 'subtitle', 'Sous-titre / rôle', item.id);
      checkFieldText(item.description, 'description', 'Description / citation', item.id);

      if ((block.type === 'products' || block.type === 'pricing') && isEmptyOrTodo(item.price)) {
        results.push({
          id: `${block.id}:${item.id}:price`,
          blockId: block.id,
          blockType: block.type,
          blockLabel: label,
          itemId: item.id,
          fieldKey: 'price',
          fieldLabel: `Tarif — ${item.title || 'Offre'}`,
          currentValue: item.price || '',
        });
      } else {
        checkFieldText(item.price, 'price', 'Tarif', item.id);
      }

      if (block.type === 'testimonials' && isEmptyOrTodo(item.description)) {
        results.push({
          id: `${block.id}:${item.id}:description`,
          blockId: block.id,
          blockType: block.type,
          blockLabel: label,
          itemId: item.id,
          fieldKey: 'description',
          fieldLabel: 'Témoignage client',
          currentValue: item.description || '',
        });
      }
    }
  }

  return results;
}

/**
 * Vérifie si l'utilisateur a réellement fourni des données pour un bloc factuel donné.
 */
export function hasProvidedFactualData(realFacts: RealFactsInput | undefined, blockType: BlockType): boolean {
  if (!realFacts) return false;
  switch (blockType) {
    case 'testimonials':
      return Boolean(realFacts.testimonials?.trim());
    case 'stats':
      return Boolean(realFacts.stats?.trim());
    case 'team':
      return Boolean(realFacts.teamMembers?.trim());
    case 'logos':
      return Boolean(realFacts.partnerLogos?.trim());
    default:
      return true;
  }
}

/**
 * Nettoie les formules creuses et emojis utilisés en guise d'icônes.
 */
export function sanitizeForbiddenCopy(text: string): string {
  if (!text) return text;
  // Supprime les emojis courants en début/fin ou isolés
  let cleaned = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s{2,}/g, ' ').trim();
  const replacements: Array<[RegExp, string]> = [
    [/\brévolutionnez\b/gi, 'transformez'],
    [/\brevolutionnez\b/gi, 'transformez'],
    [/\blibérez le potentiel\b/gi, 'valorisez'],
    [/\bliberez le potentiel\b/gi, 'valorisez'],
    [/\bsolution tout[- ]en[- ]un\b/gi, 'accompagnement complet'],
    [/\bdécouvrez\b/gi, 'explorez'],
    [/\bdecouvrez\b/gi, 'explorez'],
  ];
  for (const [pattern, target] of replacements) {
    cleaned = cleaned.replace(pattern, (match) =>
      match[0] === match[0].toUpperCase() ? target[0].toUpperCase() + target.slice(1) : target,
    );
  }
  return cleaned;
}

/**
 * Calcule les couleurs alternées d'un bloc afin que deux sections consécutives n'aient jamais le même fond.
 */
export function computeBlockSurfaceColors(
  block: SiteBlock,
  index: number,
  theme: SiteTheme,
): { bg: string; cardBg: string; text: string; muted: string } {
  const p = theme.palette;
  if (block.styleOverride?.backgroundColor || block.styleOverride?.textColor) {
    return {
      bg: block.styleOverride.backgroundColor || p.background,
      cardBg: p.surface,
      text: block.styleOverride.textColor || p.text,
      muted: p.mutedText,
    };
  }

  if (block.type === 'navbar' || block.type === 'footer') {
    return { bg: p.surface, cardBg: p.background, text: p.text, muted: p.mutedText };
  }

  if (block.type === 'cta') {
    return { bg: p.text, cardBg: p.text, text: p.background, muted: p.surface };
  }

  // Alterne strictement fond principal et surface teintée pour qu'aucune paire consécutive n'ait le même fond
  if (index % 2 === 1) {
    return { bg: p.background, cardBg: p.surface, text: p.text, muted: p.mutedText };
  }
  return { bg: p.surface, cardBg: p.background, text: p.text, muted: p.mutedText };
}

/**
 * Vérifie qu'une sortie CSS ou HTML ne contient aucun motif banni
 * (polices interdites, texte en dégradé, glassmorphism, lueurs néon, formules creuses).
 */
export function findForbiddenDesignPatterns(cssOrHtml: string): string[] {
  const violations: string[] = [];
  for (const font of BANNED_FONTS) {
    const regex = new RegExp(`['",\\s=]${font.replace(/\s+/g, '\\s*')}(?=['",;:\\s&]|$)`, 'i');
    if (regex.test(cssOrHtml)) {
      violations.push(`Police bannie détectée : ${font}`);
    }
  }
  if (/bg-clip-text|-webkit-background-clip:\s*text/i.test(cssOrHtml)) {
    violations.push('Texte en dégradé détecté');
  }
  // Le verre dépoli n'est plus interdit : il est proposé volontairement (navigation flottante, verre réfractant).
  if (/box-shadow\s*:[^;]*(0\s+0\s+\d{2,}px\s+(rgba|#|hsl))/i.test(cssOrHtml)) {
    violations.push('Lueur néon détectée');
  }
  return violations;
}

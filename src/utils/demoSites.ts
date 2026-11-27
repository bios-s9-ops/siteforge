import type { BlockType, SiteBlock, SiteProject } from '../types/site';
import { applyArtDirectionToTheme } from './artDirections';
import { createBlockId, createBlockInstance } from './blockCatalog';

const STORAGE_KEY = 'siteforge_projects_v1';

export function createStarterProject(preset: 'kora' | 'seve' = 'kora'): SiteProject {
  const now = new Date().toISOString();

  if (preset === 'seve') {
    const blocks: SiteBlock[] = [
      createBlockInstance('navbar', 'Maison Sève', 'inline'),
      {
        ...createBlockInstance('hero', 'Maison Sève', 'editorial'),
        content: {
          kicker: 'Céramique utilitaire · Exemple fictif',
          heading: 'Des pièces en grès tournées pour la table quotidienne',
          subheading:
            'Chaque série est façonnée en petite quantité à partir d’argiles brutes, cuite à haute température pour l’usage de tous les jours.',
          ctaLabel: 'Voir le catalogue',
          ctaHref: '#produits',
          secondaryCtaLabel: 'Prendre contact',
          secondaryCtaHref: '#contact',
          image: '',
          imageAlt: '',
        },
      },
      {
        ...createBlockInstance('products', 'Maison Sève', 'featured-list'),
        content: {
          kicker: 'Catalogue',
          heading: 'Séries utilitaires tournées à la main',
          subheading: 'Renseignez vos propres références et vos tarifs exacts avant publication.',
          items: [
            {
              id: createBlockId('prd'),
              title: 'Vase Soliflore en Grès',
              price: 'À compléter',
              description: 'Tourné à la main et émaillé dans des tons minéraux naturels.',
              image: '',
              imageAlt: '',
              linkLabel: 'Demander la disponibilité',
              linkHref: '#contact',
            },
            {
              id: createBlockId('prd'),
              title: 'Tasse Atelier Brut',
              price: 'À compléter',
              description: 'Terre chamottée avec prise en main équilibrée pour le service quotidien.',
              image: '',
              imageAlt: '',
              linkLabel: 'Demander la disponibilité',
              linkHref: '#contact',
            },
          ],
        },
      },
      createBlockInstance('about', 'Maison Sève', 'media-left'),
      createBlockInstance('faq', 'Maison Sève', 'compact-list'),
      createBlockInstance('contact', 'Maison Sève', 'split-info'),
      createBlockInstance('footer', 'Maison Sève', 'multi-column'),
    ];

    return {
      id: `prj_${Math.random().toString(36).slice(2, 9)}`,
      name: 'Maison Sève — Céramique',
      seoTitle: 'Maison Sève | Céramique utilitaire en grès (Exemple fictif)',
      seoDescription:
        'Exemple de site artisanal pour un atelier de céramique utilitaire en grès. Modifiez les contenus et tarifs avant export.',
      isDemo: true,
      theme: applyArtDirectionToTheme('artisanal'),
      blocks,
      originalityReport: {
        checked: true,
        status: 'original',
        summary: 'Projet de démonstration fictif conforme aux règles d’honnêteté factuelle.',
        adjustments: [],
        checkedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  // Atelier Kora : direction Minimal luxe (noir & blanc cassé + vert bouteille), sans faux témoignages ni fausses statistiques
  const blocks: SiteBlock[] = [
    createBlockInstance('navbar', 'Atelier Kora', 'inline'),
    {
      ...createBlockInstance('hero', 'Atelier Kora', 'split'),
      content: {
        kicker: 'Architecture intérieure · Exemple fictif',
        heading: 'Atelier Kora dessine des lieux sobres, lumineux et pérennes',
        subheading:
          'Conception d’espaces résidentiels et commerciaux avec une attention particulière portée aux matériaux durables et au réemploi.',
        ctaLabel: 'Voir les missions',
        ctaHref: '#services',
        secondaryCtaLabel: 'Prendre rendez-vous',
        secondaryCtaHref: '#contact',
        image: '',
        imageAlt: '',
      },
    },
    createBlockInstance('services', 'Atelier Kora', 'numbered-list'),
    createBlockInstance('about', 'Atelier Kora', 'media-right'),
    createBlockInstance('gallery', 'Atelier Kora', 'masonry-grid'),
    createBlockInstance('pricing', 'Atelier Kora', 'two-columns'),
    createBlockInstance('faq', 'Atelier Kora', 'accordion'),
    createBlockInstance('contact', 'Atelier Kora', 'split-info'),
    createBlockInstance('footer', 'Atelier Kora', 'multi-column'),
  ];

  return {
    id: `prj_${Math.random().toString(36).slice(2, 9)}`,
    name: 'Atelier Kora — Architecture',
    seoTitle: 'Atelier Kora | Architecture intérieure sobre (Exemple fictif)',
    seoDescription:
      'Exemple fictif pour un studio d’architecture intérieure : missions, réalisations et contact à compléter.',
    isDemo: true,
    theme: applyArtDirectionToTheme('minimal_luxe'),
    blocks,
    originalityReport: {
      checked: true,
      status: 'original',
      summary: 'Projet de démonstration fictif sans données inventées, prêt à être adapté.',
      adjustments: [],
      checkedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function loadSavedProjects(): SiteProject[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAllProjects(projects: SiteProject[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // Ignore quota errors gracefully
  }
}

export function upsertProjectInList(projects: SiteProject[], project: SiteProject): SiteProject[] {
  const updated = { ...project, updatedAt: new Date().toISOString() };
  const idx = projects.findIndex((p) => p.id === project.id);
  if (idx === -1) {
    return [updated, ...projects];
  }
  const next = [...projects];
  next[idx] = updated;
  return next;
}

export function moveBlockInList(blocks: SiteBlock[], blockId: string, direction: 'up' | 'down'): SiteBlock[] {
  const index = blocks.findIndex((b) => b.id === blockId);
  if (index === -1) return blocks;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= blocks.length) return blocks;
  const copy = [...blocks];
  const [moved] = copy.splice(index, 1);
  copy.splice(targetIndex, 0, moved);
  return copy;
}

export function reorderBlocksByIds(blocks: SiteBlock[], sourceId: string, targetId: string): SiteBlock[] {
  if (sourceId === targetId) return blocks;
  const fromIdx = blocks.findIndex((b) => b.id === sourceId);
  const toIdx = blocks.findIndex((b) => b.id === targetId);
  if (fromIdx === -1 || toIdx === -1) return blocks;
  const copy = [...blocks];
  const [moved] = copy.splice(fromIdx, 1);
  copy.splice(toIdx, 0, moved);
  return copy;
}

export function duplicateBlockInList(blocks: SiteBlock[], blockId: string): { blocks: SiteBlock[]; newBlockId: string } {
  const index = blocks.findIndex((b) => b.id === blockId);
  if (index === -1) return { blocks, newBlockId: '' };
  const original = blocks[index];
  const newBlockId = createBlockId(original.type);
  const cloned: SiteBlock = {
    ...JSON.parse(JSON.stringify(original)),
    id: newBlockId,
  };
  const copy = [...blocks];
  copy.splice(index + 1, 0, cloned);
  return { blocks: copy, newBlockId };
}

export function insertBlockInList(
  blocks: SiteBlock[],
  type: BlockType,
  afterBlockId?: string | null,
  siteName?: string,
): { blocks: SiteBlock[]; newBlock: SiteBlock } {
  const newBlock = createBlockInstance(type, siteName);
  if (!afterBlockId) {
    const footerIdx = blocks.findIndex((b) => b.type === 'footer');
    if (footerIdx !== -1 && type !== 'footer') {
      const copy = [...blocks];
      copy.splice(footerIdx, 0, newBlock);
      return { blocks: copy, newBlock };
    }
    return { blocks: [...blocks, newBlock], newBlock };
  }
  const idx = blocks.findIndex((b) => b.id === afterBlockId);
  if (idx === -1) {
    return { blocks: [...blocks, newBlock], newBlock };
  }
  const copy = [...blocks];
  copy.splice(idx + 1, 0, newBlock);
  return { blocks: copy, newBlock };
}

import type { SiteProject } from '../types/site';

export interface StockImageResult {
  id: string;
  url: string;
  thumbUrl: string;
  title: string;
  author: string;
  /** Ex. « CC BY 4.0 », « CC0 », « Domaine public » */
  license: string;
  source: 'openverse' | 'wikimedia';
  /** Page d'origine de l'image */
  pageUrl?: string;
}

/** Texte de crédit à publier avec la photo (obligatoire pour la plupart des licences CC BY). */
export function formatImageCredit(image: Pick<StockImageResult, 'title' | 'author' | 'license' | 'source'>): string {
  const sourceName = image.source === 'openverse' ? 'Openverse' : 'Wikimedia Commons';
  return `« ${image.title} » par ${image.author} (${image.license}) via ${sourceName}`;
}

/** Crédits des photos réellement utilisées dans les blocs affichés, sans doublon. */
export function collectImageCredits(project: Pick<SiteProject, 'blocks'>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (image?: string, credit?: string) => {
    const c = (credit ?? '').trim();
    if (!image || !c || seen.has(c)) return;
    seen.add(c);
    out.push(c);
  };
  for (const block of project.blocks) {
    if (!block.visible) continue;
    add(block.content.image, block.content.imageCredit);
    add(block.content.secondaryImage, block.content.secondaryImageCredit);
    for (const item of block.content.items ?? []) add(item.image, item.imageCredit);
  }
  return out;
}

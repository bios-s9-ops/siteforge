import type { BlockType, SiteBlock } from '../types/site';
import { BLOCK_CATALOG, createBlockInstance } from './blockCatalog';

/** Type MIME utilisé dans dataTransfer pour reconnaître un glissement venant de SiteForge. */
export const DND_MIME = 'application/x-siteforge-block';

/** Ce que l'on fait glisser : un nouveau bloc de la palette, ou un bloc déjà présent dans la page. */
export type DragPayload = { kind: 'new'; type: BlockType } | { kind: 'move'; id: string };

export function encodePayload(payload: DragPayload): string {
  return JSON.stringify(payload);
}

/** Relit un glissement en refusant tout ce qui n'a pas la forme attendue (fichier, texte d'une autre page…). */
export function decodePayload(raw: string | null | undefined): DragPayload | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (data.kind === 'new' && typeof data.type === 'string' && BLOCK_CATALOG.some((b) => b.type === data.type)) {
      return { kind: 'new', type: data.type as BlockType };
    }
    if (data.kind === 'move' && typeof data.id === 'string' && data.id.length > 0 && data.id.length < 200) {
      return { kind: 'move', id: data.id };
    }
  } catch {
    // ignoré : contenu qui ne vient pas de SiteForge
  }
  return null;
}

/**
 * Ramène un emplacement de dépôt dans les limites logiques d'une page :
 * la barre de navigation reste en haut, le pied de page reste en bas, et aucun autre bloc
 * ne passe au-dessus de l'une ou en dessous de l'autre.
 * `rest` est la liste sans le bloc déplacé ; `slot` est un index d'insertion dans `rest` (0 à rest.length).
 */
export function clampSlot(rest: SiteBlock[], type: BlockType, slot: number): number {
  if (type === 'navbar') return 0;
  if (type === 'footer') return rest.length;
  const lo = rest[0]?.type === 'navbar' ? 1 : 0;
  const hi = rest[rest.length - 1]?.type === 'footer' ? rest.length - 1 : rest.length;
  return Math.max(lo, Math.min(hi, slot));
}

function boundSlot(slot: number, length: number): number {
  return Math.max(0, Math.min(length, Math.floor(slot)));
}

/**
 * Déplace un bloc vers un emplacement de dépôt.
 * `slot` est l'emplacement affiché dans l'interface, compté dans la liste d'origine (0 = avant le premier bloc,
 * n = après le dernier).
 */
export function moveBlockToSlot(blocks: SiteBlock[], blockId: string, slot: number): SiteBlock[] {
  const from = blocks.findIndex((b) => b.id === blockId);
  if (from === -1) return blocks;
  const moving = blocks[from];
  const rest = blocks.filter((_, i) => i !== from);
  const requested = boundSlot(slot, blocks.length);
  const inRest = requested > from ? requested - 1 : requested;
  const to = clampSlot(rest, moving.type, inRest);
  if (to === from) return blocks;
  const next = [...rest];
  next.splice(to, 0, moving);
  return next;
}

/** Vrai si déposer le bloc à cet emplacement ne changerait rien à l'ordre. */
export function isNoopSlot(blocks: SiteBlock[], blockId: string, slot: number): boolean {
  return moveBlockToSlot(blocks, blockId, slot) === blocks;
}

/** Insère un nouveau bloc à un emplacement de dépôt (même règle de limites que pour un déplacement). */
export function insertBlockAtSlot(
  blocks: SiteBlock[],
  type: BlockType,
  slot: number,
  siteName?: string,
): { blocks: SiteBlock[]; newBlock: SiteBlock } {
  const newBlock = createBlockInstance(type, siteName);
  const at = clampSlot(blocks, type, boundSlot(slot, blocks.length));
  const next = [...blocks];
  next.splice(at, 0, newBlock);
  return { blocks: next, newBlock };
}

export interface DropResult {
  blocks: SiteBlock[];
  /** Bloc à sélectionner après le dépôt */
  selectedId: string | null;
  changed: boolean;
}

/** Applique un dépôt (nouveau bloc ou déplacement) à un emplacement. */
export function applyDrop(blocks: SiteBlock[], payload: DragPayload, slot: number, siteName?: string): DropResult {
  if (payload.kind === 'new') {
    const { blocks: next, newBlock } = insertBlockAtSlot(blocks, payload.type, slot, siteName);
    return { blocks: next, selectedId: newBlock.id, changed: true };
  }
  const next = moveBlockToSlot(blocks, payload.id, slot);
  return { blocks: next, selectedId: payload.id, changed: next !== blocks };
}

/** Emplacement le plus proche d'un point de la page : avant le bloc si le curseur est dans sa moitié haute. */
export function slotFromPointer(blockIndex: number, pointerY: number, rectTop: number, rectHeight: number): number {
  return pointerY < rectTop + rectHeight / 2 ? blockIndex : blockIndex + 1;
}

/**
 * Emplacement réellement utilisé après application des règles (barre de navigation en haut, pied de page en bas),
 * exprimé comme dans l'interface. Sert à illuminer la bonne zone pendant le glissement.
 */
export function visualSlotFor(blocks: SiteBlock[], payload: DragPayload, slot: number): number {
  const requested = boundSlot(slot, blocks.length);
  if (payload.kind === 'new') {
    return clampSlot(blocks, payload.type, requested);
  }
  const from = blocks.findIndex((b) => b.id === payload.id);
  if (from === -1) return requested;
  const rest = blocks.filter((_, i) => i !== from);
  const inRest = requested > from ? requested - 1 : requested;
  const to = clampSlot(rest, blocks[from].type, inRest);
  return to >= from ? to + 1 : to;
}

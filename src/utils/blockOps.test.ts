import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlockInstance } from './blockCatalog';
import {
  applyDrop,
  clampSlot,
  decodePayload,
  encodePayload,
  insertBlockAtSlot,
  isNoopSlot,
  moveBlockToSlot,
  slotFromPointer,
  visualSlotFor,
} from './blockOps';

const make = () => ['navbar', 'hero', 'services', 'contact', 'footer'].map((t) => createBlockInstance(t as any, 'Test'));
const types = (blocks: { type: string }[]) => blocks.map((b) => b.type).join(',');

test('le glisser-déposer ne reconnaît que les contenus venant de SiteForge', () => {
  assert.deepEqual(decodePayload(encodePayload({ kind: 'new', type: 'faq' })), { kind: 'new', type: 'faq' });
  assert.deepEqual(decodePayload(encodePayload({ kind: 'move', id: 'blk-1' })), { kind: 'move', id: 'blk-1' });
  assert.equal(decodePayload('{"kind":"new","type":"inconnu"}'), null);
  assert.equal(decodePayload('<script>alert(1)</script>'), null);
  assert.equal(decodePayload(''), null);
  assert.equal(decodePayload(undefined), null);
});

test('un bloc déplacé change de place, la barre de navigation et le pied de page restent aux extrémités', () => {
  const blocks = make();
  const [nav, hero, services, contact] = blocks;

  assert.equal(types(moveBlockToSlot(blocks, contact.id, 2)), 'navbar,hero,contact,services,footer');
  assert.equal(types(moveBlockToSlot(blocks, hero.id, 3)), 'navbar,services,hero,contact,footer');

  // Au-dessus de la barre de navigation ou sous le pied de page : ramené dans les limites
  assert.equal(types(moveBlockToSlot(blocks, services.id, 0)), 'navbar,services,hero,contact,footer');
  assert.equal(types(moveBlockToSlot(blocks, services.id, 5)), 'navbar,hero,contact,services,footer');

  // La barre de navigation ne quitte pas le haut, quoi qu'on fasse
  assert.equal(moveBlockToSlot(blocks, nav.id, 3), blocks, 'aucun changement : même liste');
  assert.equal(moveBlockToSlot(blocks, 'inexistant', 1), blocks);
});

test('les emplacements sans effet sont repérés', () => {
  const blocks = make();
  const hero = blocks[1];
  assert.equal(isNoopSlot(blocks, hero.id, 1), true, 'juste avant lui-même');
  assert.equal(isNoopSlot(blocks, hero.id, 2), true, 'juste après lui-même');
  assert.equal(isNoopSlot(blocks, hero.id, 0), true, 'au-dessus de la barre de navigation : ramené à sa place');
  assert.equal(isNoopSlot(blocks, hero.id, 3), false);
});

test('un nouveau bloc s’insère à l’emplacement visé, dans les limites de la page', () => {
  const blocks = make();
  const mid = insertBlockAtSlot(blocks, 'faq', 3, 'Test');
  assert.equal(types(mid.blocks), 'navbar,hero,services,faq,contact,footer');
  assert.equal(mid.blocks[3].id, mid.newBlock.id);

  assert.equal(types(insertBlockAtSlot(blocks, 'faq', 0, 'Test').blocks), 'navbar,faq,hero,services,contact,footer');
  assert.equal(types(insertBlockAtSlot(blocks, 'faq', 5, 'Test').blocks), 'navbar,hero,services,contact,faq,footer');
  assert.equal(insertBlockAtSlot(blocks, 'faq', 99, 'Test').blocks.at(-2)?.type, 'faq');
  assert.equal(insertBlockAtSlot(blocks, 'faq', -4, 'Test').blocks[1].type, 'faq');

  // Une barre de navigation va toujours en haut, un pied de page toujours en bas
  assert.equal(insertBlockAtSlot(blocks.slice(1), 'navbar', 2, 'Test').blocks[0].type, 'navbar');
  assert.equal(insertBlockAtSlot(blocks.slice(0, 4), 'footer', 1, 'Test').blocks.at(-1)?.type, 'footer');
  assert.equal(clampSlot(blocks, 'faq', 0), 1);
});

test('un dépôt renvoie le bloc à sélectionner et indique s’il a changé quelque chose', () => {
  const blocks = make();
  const dropNew = applyDrop(blocks, { kind: 'new', type: 'faq' }, 3, 'Test');
  assert.equal(dropNew.changed, true);
  assert.equal(dropNew.blocks.length, blocks.length + 1);
  assert.equal(dropNew.selectedId, dropNew.blocks[3].id);

  const dropMove = applyDrop(blocks, { kind: 'move', id: blocks[3].id }, 2);
  assert.equal(dropMove.changed, true);
  assert.equal(dropMove.selectedId, blocks[3].id);

  const noop = applyDrop(blocks, { kind: 'move', id: blocks[1].id }, 1);
  assert.equal(noop.changed, false);
  assert.equal(noop.blocks, blocks);
});

test('l’emplacement illuminé correspond à l’endroit où le bloc atterrira', () => {
  const blocks = make();
  assert.equal(visualSlotFor(blocks, { kind: 'new', type: 'faq' }, 0), 1, 'sous la barre de navigation');
  assert.equal(visualSlotFor(blocks, { kind: 'new', type: 'faq' }, 5), 4, 'au-dessus du pied de page');
  assert.equal(visualSlotFor(blocks, { kind: 'move', id: blocks[3].id }, 2), 2);
  assert.equal(visualSlotFor(blocks, { kind: 'new', type: 'navbar' }, 3), 0);
});

test('le curseur choisit l’emplacement le plus proche', () => {
  assert.equal(slotFromPointer(2, 110, 100, 100), 2, 'moitié haute : avant le bloc');
  assert.equal(slotFromPointer(2, 190, 100, 100), 3, 'moitié basse : après le bloc');
});

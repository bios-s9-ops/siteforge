import test from 'node:test';
import assert from 'node:assert/strict';
import type { SiteProject } from '../types/site';
import { createStarterProject } from '../utils/demoSites';
import { getBlockDefinition } from '../utils/blockCatalog';

/**
 * Test d'intégration : on rend le vrai éditeur dans jsdom et on rejoue un glisser-déposer
 * (palette → page, puis déplacement d'un bloc existant). jsdom n'a pas de mise en page ni de souris :
 * les événements de glissement sont envoyés à la main avec un faux dataTransfer.
 */
async function setup(project: SiteProject) {
  let jsdom: any;
  try {
    jsdom = await import('jsdom');
  } catch {
    return null;
  }
  const dom = new jsdom.JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    pretendToBeVisual: true,
    url: 'https://example.test/',
  });
  const w = dom.window as any;
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Node', 'Event', 'MutationObserver', 'getComputedStyle']) {
    Object.defineProperty(globalThis, key, { value: key === 'window' ? w : w[key], configurable: true, writable: true });
  }
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { EditorWorkspace } = await import('./EditorWorkspace');

  const changes: SiteProject[] = [];
  const root = createRoot(w.document.getElementById('root'));
  await React.act(async () => {
    root.render(
      <EditorWorkspace
        project={project}
        canUndo={false}
        canRedo={false}
        onUndo={() => {}}
        onRedo={() => {}}
        onChangeProject={(next) => changes.push(next)}
        onBackHome={() => {}}
      />,
    );
  });

  const makeTransfer = () => {
    const store = new Map<string, string>();
    return {
      setData: (k: string, v: string) => void store.set(k, v),
      getData: (k: string) => store.get(k) ?? '',
      setDragImage: () => {},
      effectAllowed: 'all',
      dropEffect: 'none',
    };
  };

  const fire = async (el: Element, type: string, dataTransfer: unknown) => {
    await React.act(async () => {
      const ev = new w.Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'dataTransfer', { value: dataTransfer });
      Object.defineProperty(ev, 'clientY', { value: 0 });
      el.dispatchEvent(ev);
      await new Promise((r) => setTimeout(r, 5)); // laisse passer le setTimeout(0) de début de glissement
    });
  };

  return { w, document: w.document as Document, changes, makeTransfer, fire, dispose: () => root.unmount() };
}

test('intégration : une tuile de la palette glissée sur la page crée un bloc à l’endroit visé', async (t) => {
  const project = createStarterProject('kora');
  const env = await setup(project);
  if (!env) return t.skip('jsdom non installé');
  const { document, changes, makeTransfer, fire } = env;

  assert.equal(document.querySelectorAll('[data-drop-slot]').length, 0, 'au repos, pas de bande de dépôt');

  const faqLabel = getBlockDefinition('faq').label;
  const tile = Array.from(document.querySelectorAll('button[draggable="true"]')).find((b) =>
    b.textContent?.includes(faqLabel),
  ) as HTMLElement;
  assert.ok(tile, `tuile « ${faqLabel} » présente dans la palette`);

  const transfer = makeTransfer();
  await fire(tile, 'dragstart', transfer);
  const zones = document.querySelectorAll('[data-drop-slot]');
  assert.ok(zones.length >= project.blocks.length, 'les bandes de dépôt apparaissent pendant le glissement');

  const zone = document.querySelector('[data-drop-slot="2"]')!;
  await fire(zone, 'dragover', transfer);
  assert.ok(zone.textContent?.includes('Déposer ici'), 'la bande sous le curseur s’illumine');
  await fire(zone, 'drop', transfer);

  assert.equal(changes.length, 1, 'un seul changement de projet');
  const next = changes[0];
  assert.equal(next.blocks.length, project.blocks.length + 1);
  assert.equal(next.blocks[2].type, 'faq');
  assert.equal(document.querySelectorAll('[data-drop-slot]').length, 0, 'les bandes disparaissent après le dépôt');
  env.dispose();
});

test('intégration : la poignée d’un bloc le déplace, et rien ne sort de la barre de navigation / du pied de page', async (t) => {
  const project = createStarterProject('kora');
  const env = await setup(project);
  if (!env) return t.skip('jsdom non installé');
  const { document, changes, makeTransfer, fire } = env;

  const handles = Array.from(document.querySelectorAll('[draggable="true"][title="Glisser pour déplacer ce bloc"]'));
  assert.equal(handles.length, project.blocks.length, 'une poignée par bloc');

  const lastIndex = project.blocks.length - 2; // avant le pied de page
  const movedId = project.blocks[lastIndex].id;
  const transfer = makeTransfer();
  await fire(handles[lastIndex], 'dragstart', transfer);

  // Déposer au-dessus de la barre de navigation : le bloc doit se placer juste dessous
  const zone = document.querySelector('[data-drop-slot="0"]')!;
  await fire(zone, 'dragover', transfer);
  await fire(zone, 'drop', transfer);

  assert.equal(changes.length, 1);
  const next = changes[0];
  assert.equal(next.blocks[0].type, 'navbar', 'la barre de navigation reste en haut');
  assert.equal(next.blocks[1].id, movedId, 'le bloc est juste sous la barre de navigation');
  assert.equal(next.blocks.at(-1)?.type, 'footer', 'le pied de page reste en bas');
  assert.equal(next.blocks.length, project.blocks.length);
  env.dispose();
});

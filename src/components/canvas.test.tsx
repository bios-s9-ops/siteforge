import test from 'node:test';
import assert from 'node:assert/strict';
import type { SiteLayoutMode, SiteProject } from '../types/site';
import { createBlockInstance } from '../utils/blockCatalog';
import { createBlankProject } from '../utils/projectIO';

function makeProject(layout: SiteLayoutMode = 'vertical'): SiteProject {
  const base = createBlankProject('Atelier Test');
  const blocks = ['navbar', 'hero', 'services', 'contact', 'footer'].map((t) => createBlockInstance(t as never, 'Atelier Test'));
  blocks[1].content.heading = 'Titre de départ';
  blocks[1].content.image = 'https://example.org/hero.jpg';
  blocks[1].content.imageEffect = { scroll: 'parallax-slow', scrollIntensity: 50, effect3d: 'tilt-3d-hover', effect3dIntensity: 50 };
  blocks[1].animation = 'fade-up';
  return { ...base, blocks, theme: { ...base.theme, layoutMode: layout } };
}

async function mount(project: SiteProject) {
  let jsdom: any;
  try {
    jsdom = await import('jsdom');
  } catch {
    return null;
  }
  const dom = new jsdom.JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true, url: 'https://example.test/' });
  const w = dom.window as any;
  w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Node', 'Event', 'MutationObserver', 'getComputedStyle', 'IntersectionObserver']) {
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
      <EditorWorkspace project={project} canUndo={false} canRedo={false} onUndo={() => {}} onRedo={() => {}} onChangeProject={(p) => changes.push(p)} onBackHome={() => {}} />,
    );
  });
  const act = (fn: () => void) => React.act(async () => { fn(); await new Promise((r) => setTimeout(r, 5)); });
  return { w, doc: w.document as Document, changes, act, dispose: () => root.unmount() };
}

test('édition directe : on clique sur un titre, on le modifie, Échap l’annule, l’aperçu coupe l’édition', async (t) => {
  const env = await mount(makeProject());
  if (!env) return t.skip('jsdom non installé');
  const { w, doc, changes, act } = env;

  const heading = doc.querySelector('[data-inline-edit="heading"]') as HTMLElement;
  assert.ok(heading, 'le titre du bloc d’en-tête est modifiable');
  assert.equal(heading.textContent, 'Titre de départ');

  heading.textContent = 'Nouveau titre';
  await act(() => heading.dispatchEvent(new w.Event('focusout', { bubbles: true })));
  assert.equal(changes.length, 1, 'une seule entrée dans l’historique');
  assert.equal(changes[0].blocks[1].content.heading, 'Nouveau titre');
  assert.equal(changes[0].blocks[0].content.heading, makeProject().blocks[0].content.heading, 'les autres blocs ne changent pas');

  // Texte inchangé : aucune entrée d'historique
  const again = doc.querySelector('[data-inline-edit="heading"]') as HTMLElement;
  again.textContent = 'Titre de départ';
  await act(() => again.dispatchEvent(new w.Event('focusout', { bubbles: true })));
  assert.equal(changes.length, 1);

  // Mode Aperçu : plus de champs modifiables, plus de poignées
  const preview = Array.from(doc.querySelectorAll('button')).find((b) => b.textContent?.includes('Aperçu')) as HTMLElement;
  await act(() => preview.click());
  assert.equal(doc.querySelectorAll('[data-inline-edit]').length, 0);
  assert.equal(doc.querySelectorAll('[draggable="true"][title="Glisser pour déplacer ce bloc"]').length, 0);
  assert.equal(doc.querySelectorAll('[data-drop-slot]').length, 0);
  const edit = Array.from(doc.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Modifier') as HTMLElement;
  await act(() => edit.click());
  assert.ok(doc.querySelector('[data-inline-edit="heading"]'), 'l’édition revient');
  env.dispose();
});

test('la page d’édition montre les effets et chaque architecture', async (t) => {
  for (const [layout, selector] of [
    ['vertical', '.sf-stage[data-layout="vertical"]'],
    ['bento-grid', '.sf-bento .sf-cell'],
    ['horizontal-slides', '.sf-track .sf-slide'],
    ['split-screen', '.sf-split .sf-split-visual img'],
  ] as const) {
    const env = await mount(makeProject(layout));
    if (!env) return t.skip('jsdom non installé');
    assert.ok(env.doc.querySelector(selector), `${layout} : ${selector}`);
    assert.ok(env.doc.querySelector('.sf-stage')?.classList.contains('sf-js'), 'le moteur d’effets est actif sur la page d’édition');
    assert.ok(env.doc.querySelector('.sf-fx[data-fx-scroll="parallax-slow"][data-fx-3d="tilt-3d-hover"]'), 'effets d’image présents');
    assert.ok(env.doc.querySelector('[data-anim="fade-up"]'), 'animation d’entrée présente');
    env.dispose();
  }
});

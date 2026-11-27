import test from 'node:test';
import assert from 'node:assert/strict';
import type { SiteBlock, SiteLayoutMode, SiteProject } from '../types/site';
import { createBlockInstance } from './blockCatalog';
import { contrastRatio, deriveAlternatePalette, generateAllHarmonies, generateHarmony, normalizeHex } from './colorHarmony';
import {
  IMAGE_3D_EFFECTS,
  IMAGE_SCROLL_EFFECTS,
  SECTION_ANIMATIONS,
  sanitizeHeaderStyle,
  sanitizeImageEffect,
  sanitizeLayoutMode,
  sanitizeSectionAnimation,
  clampDuration,
} from './effectsCatalog';
import { generateSeparateHtmlAndCss, generateStandaloneHtml } from './exporter';
import { EFFECTS_CSS, EFFECTS_RUNTIME_JS } from './effectsRuntime';
import { findForbiddenDesignPatterns } from './honesty';
import { clearAllImages, createBlankProject, applyInspirationEffects, parseForgeFile, serializeProject, ForgeFileError } from './projectIO';
import { fontFamilyParam, googleFontsHref } from './fonts';
import { collectImageCredits } from './credits';

function project(layout: SiteLayoutMode = 'vertical', patch?: (b: SiteBlock[]) => void): SiteProject {
  const base = createBlankProject('Atelier Test');
  const blocks = ['navbar', 'hero', 'services', 'gallery', 'contact', 'footer'].map((t) => createBlockInstance(t as never, 'Atelier Test'));
  const hero = blocks[1];
  hero.content.image = 'https://example.org/hero.jpg';
  hero.content.imageAlt = 'Une photo';
  hero.content.imageCredit = '« Photo » par Awa (CC BY 4.0) via Openverse';
  hero.content.imageEffect = { scroll: 'parallax-slow', scrollIntensity: 70, effect3d: 'tilt-3d-hover', effect3dIntensity: 40 };
  hero.animation = 'fade-up';
  hero.animationDurationMs = 900;
  patch?.(blocks);
  return { ...base, blocks, theme: { ...base.theme, layoutMode: layout } };
}

test('les catalogues rejettent toute valeur inconnue', () => {
  assert.equal(sanitizeLayoutMode('nimporte'), 'vertical');
  assert.equal(sanitizeHeaderStyle('floating-glass'), 'floating-glass');
  assert.equal(sanitizeSectionAnimation('flip-up'), 'flip-up');
  assert.equal(sanitizeSectionAnimation('<script>'), 'none');
  assert.deepEqual(sanitizeImageEffect({ scroll: 'x', scrollIntensity: 900, effect3d: 'magnifier-loupe', effect3dIntensity: -5 }), { scroll: 'none', scrollIntensity: 100, effect3d: 'magnifier-loupe', effect3dIntensity: 0 });
  assert.equal(clampDuration(99999), 3000);
});

test('les identifiants des catalogues sont bien pris en charge par le runtime partagé', () => {
  const runtime = `${EFFECTS_CSS}\n${EFFECTS_RUNTIME_JS}`;
  for (const option of [...IMAGE_3D_EFFECTS, ...IMAGE_SCROLL_EFFECTS, ...SECTION_ANIMATIONS]) {
    assert.ok(runtime.includes(option.id), `identifiant sans règle runtime : ${option.id}`);
  }
});

test('couleurs : saisie libre, harmonies lisibles, version claire / sombre', () => {
  assert.equal(normalizeHex('f60'), '#FF6600');
  assert.equal(normalizeHex('zzz'), null);
  for (const h of generateAllHarmonies('#7C2D12')) {
    assert.ok(contrastRatio(h.palette.text, h.palette.background) >= 4.5, `${h.kind} : texte lisible`);
  }
  const dark = generateHarmony('#7C2D12', 'analogous', true);
  assert.ok(contrastRatio(dark.text, dark.background) >= 7);
  const alt = deriveAlternatePalette({ primary: '#1B4332', secondary: '#7C2D12', background: '#FFFFFF', surface: '#F3F3F3', text: '#111111', mutedText: '#555555' }, true);
  assert.ok(contrastRatio(alt.primary, alt.background) >= 3, 'couleur de marque éclaircie pour rester lisible');
});

test('polices : graisses seulement quand elles existent, sinon requête simple', () => {
  assert.ok(fontFamilyParam('Fraunces').includes(':wght@400;500;600;700'));
  assert.equal(fontFamilyParam('Rubik Mono One'), 'family=Rubik+Mono+One', 'police inconnue : pas de graisses qui feraient échouer la requête');
  assert.ok(fontFamilyParam('Anton').endsWith(':wght@400'));
  assert.ok(googleFontsHref(['Lora', 'Lora', 'Syne']).startsWith('https://fonts.googleapis.com/css2?family=Lora'));
});

test('export : chaque architecture produit sa structure', () => {
  const html = (l: SiteLayoutMode) => generateStandaloneHtml(project(l));
  assert.ok(html('vertical').includes('data-layout="vertical"'));
  const h = html('horizontal-slides');
  assert.ok(h.includes('<div class="sf-track">') && (h.match(/class="sf-slide"/g) ?? []).length >= 4, 'une diapositive par section');
  const b = html('bento-grid');
  assert.ok(b.includes('<div class="sf-bento">') && b.includes('class="sf-cell sf-span-7"'));
  const s = html('split-screen');
  assert.ok(s.includes('<div class="sf-split">') && s.includes('<aside class="sf-split-visual"') && s.includes('<img src="https://example.org/hero.jpg" alt=""'));
  const story = html('scroll-story');
  assert.ok(story.includes(' data-story style='));
  assert.ok(!html('vertical').includes(' data-story style='));
});

test('export : navigation, animation, effets d’image, mode sombre et crédits', () => {
  const p = project('vertical');
  p.theme.headerStyle = 'floating-glass';
  p.theme.visitorThemeToggle = true;
  const html = generateStandaloneHtml(p);
  assert.ok(html.includes('data-header="floating-glass"'));
  assert.ok(html.includes('data-anim="fade-up"') && html.includes('--sf-anim-ms: 900ms'));
  assert.ok(html.includes('data-fx-scroll="parallax-slow"') && html.includes('data-fx-3d="tilt-3d-hover"'));
  assert.ok(html.includes('referrerpolicy="no-referrer"') && html.includes('window.__sfImageError'));
  assert.ok(html.includes('data-sf-theme-toggle'));
  assert.ok(html.includes(':root[data-theme="dark"]'), 'version sombre calculée');
  assert.ok(html.includes('Crédits photos') && html.includes('Awa (CC BY 4.0)'));
  assert.ok(html.includes('window.__sfFx(document'));
  assert.ok(!html.includes('data-sf-theme-toggle') === false);
  // sans le bouton : ni bouton ni variables alternatives
  const plain = generateStandaloneHtml(project());
  assert.ok(!plain.includes('<button type="button" class="sf-theme-toggle"') && !plain.includes(':root[data-theme="dark"]'));
  assert.equal(findForbiddenDesignPatterns(html).length, 0, JSON.stringify(findForbiddenDesignPatterns(html)));
});

test('export : le comparateur avant / après exige deux images, aucune image vide n’est exportée', () => {
  const p = project('vertical', (blocks) => {
    blocks[1].content.imageEffect = { scroll: 'none', scrollIntensity: 50, effect3d: 'before-after-slider', effect3dIntensity: 50 };
  });
  assert.ok(generateStandaloneHtml(p).includes('data-fx-3d="none"'), 'sans seconde image : comparateur désactivé');
  p.blocks[1].content.secondaryImage = 'https://example.org/after.jpg';
  const html = generateStandaloneHtml(p);
  assert.ok(html.includes('data-fx-3d="before-after-slider"') && html.includes('sf-fx-after'));
  assert.deepEqual(collectImageCredits(p), ['« Photo » par Awa (CC BY 4.0) via Openverse']);

  const empty = clearAllImages(project());
  const emptyHtml = generateStandaloneHtml(empty);
  assert.ok(!emptyHtml.includes('<img'), 'emplacement vide : aucune balise image');
  assert.equal(generateSeparateHtmlAndCss(empty).assetSources.length, 0);
  assert.equal(empty.blocks[1].content.imageEffect?.scroll, 'parallax-slow', 'effets conservés');
});

test('canevas vierge et mode inspiration', () => {
  const blank = createBlankProject();
  assert.deepEqual(blank.blocks, []);
  assert.equal(blank.projectInput?.mode, 'scratch');
  const p = applyInspirationEffects(project(), {
    pageGoal: '', layoutRhythm: '', visualHierarchy: '', layoutMode: 'bento-grid', headerStyle: 'minimal-centered',
    sections: [{ blockType: 'hero', animation: 'zoom-in', imageScroll: 'scroll-zoom-in', image3d: 'float-3d-shadow' } as never],
  });
  assert.equal(p.theme.layoutMode, 'bento-grid');
  assert.equal(p.theme.headerStyle, 'minimal-centered');
  assert.equal(p.blocks[1].animation, 'zoom-in');
  assert.equal(p.blocks[1].content.imageEffect?.effect3d, 'float-3d-shadow');
  const cleared = clearAllImages(p);
  assert.equal(cleared.blocks[1].content.image, '');
  assert.equal(cleared.blocks[1].content.imageEffect?.scroll, 'scroll-zoom-in');
});

test('.forge.json : aller-retour fidèle, fichiers douteux nettoyés ou refusés', () => {
  const original = project('split-screen');
  const back = parseForgeFile(serializeProject(original));
  assert.notEqual(back.id, original.id, 'nouvel identifiant : aucun projet écrasé');
  assert.equal(back.theme.layoutMode, 'split-screen');
  assert.equal(back.blocks.length, original.blocks.length);
  assert.equal(back.blocks[1].content.imageEffect?.scroll, 'parallax-slow');

  const evil = JSON.parse(serializeProject(original));
  evil.project.blocks[1].content.image = 'javascript:alert(1)';
  evil.project.blocks[1].content.ctaHref = 'javascript:alert(1)';
  evil.project.blocks[1].animation = '<img onerror=x>';
  evil.project.theme.palette.primary = 'red;}</style><script>';
  evil.project.blocks.push({ type: 'inconnu', content: {} });
  const clean = parseForgeFile(JSON.stringify(evil));
  assert.equal(clean.blocks[1].content.image, '');
  assert.ok(!String(clean.blocks[1].content.ctaHref).startsWith('javascript'));
  assert.equal(clean.blocks[1].animation, 'none');
  assert.ok(/^#[0-9A-F]{6}$/i.test(clean.theme.palette.primary));
  assert.equal(clean.blocks.length, original.blocks.length, 'bloc inconnu écarté');

  for (const bad of ['pas du json', '{"format":"autre"}', JSON.stringify({ format: 'siteforge-project', version: 99, project: {} })]) {
    assert.throws(() => parseForgeFile(bad), ForgeFileError);
  }
});

async function runtime(html: string, setup?: (w: any) => void) {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/' });
  const w = dom.window as any;
  setup?.(w);
  w.eval(EFFECTS_RUNTIME_JS);
  return { w, doc: w.document as Document };
}

test('moteur d’effets (jsdom) : animations, avant / après, diapositives, bouton clair / sombre', async (t) => {
  try {
    await import('jsdom');
  } catch {
    return t.skip('jsdom non installé');
  }
  const p = project('horizontal-slides', (blocks) => {
    blocks[1].content.imageEffect = { scroll: 'none', scrollIntensity: 50, effect3d: 'before-after-slider', effect3dIntensity: 50 };
    blocks[1].content.secondaryImage = 'https://example.org/after.jpg';
  });
  p.theme.visitorThemeToggle = true;
  const html = generateStandaloneHtml(p).replace(/<script>[\s\S]*<\/script>/, '');
  const { w, doc } = await runtime(html, (win) => {
    win.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
    win.HTMLElement.prototype.scrollTo = function () {};
    win.localStorage.clear();
  });
  const cleanup = w.__sfFx(doc, {});
  assert.ok(doc.documentElement.classList.contains('sf-js'));
  assert.ok(doc.querySelector('.sf-ba-range'), 'curseur avant / après créé');
  const range = doc.querySelector('.sf-ba-range') as HTMLInputElement;
  range.value = '20';
  range.dispatchEvent(new w.Event('input'));
  assert.equal((doc.querySelector('.sf-fx') as HTMLElement).style.getPropertyValue('--pos'), '20%');
  assert.ok(doc.querySelector('.sf-hnav'), 'navigation des diapositives créée');
  assert.equal(doc.querySelectorAll('.sf-hdot').length, doc.querySelectorAll('.sf-slide').length);
  const before = doc.documentElement.getAttribute('data-theme');
  (doc.querySelector('[data-sf-theme-toggle]') as HTMLElement).click();
  assert.notEqual(doc.documentElement.getAttribute('data-theme'), before, 'bascule clair / sombre');
  assert.equal(w.localStorage.getItem('sf-theme'), doc.documentElement.getAttribute('data-theme'));
  cleanup();
  assert.ok(!doc.documentElement.classList.contains('sf-js'));
  assert.ok(!doc.querySelector('.sf-hnav'), 'nettoyage complet');
});

test('moteur d’effets : sans IntersectionObserver ou avec mouvement réduit, tout reste visible', async (t) => {
  try {
    await import('jsdom');
  } catch {
    return t.skip('jsdom non installé');
  }
  const html = generateStandaloneHtml(project()).replace(/<script>[\s\S]*<\/script>/, '');
  const { w, doc } = await runtime(html);
  w.__sfFx(doc, {});
  assert.ok(doc.querySelector('[data-anim].is-in'), 'section visible même sans IntersectionObserver');
});

test('moteur d’effets : les animations se rejouent à chaque sortie et retour dans le viewport', () => {
  const classes = new Set<string>();
  const section = {
    classList: {
      add: (value: string) => classes.add(value),
      remove: (value: string) => classes.delete(value),
      contains: (value: string) => classes.has(value),
    },
    getAttribute: (name: string) => name === 'data-anim' ? 'fade-up' : null,
  };
  const host = { classList: { add() {}, remove() {} } };
  const doc = {
    nodeType: 9,
    documentElement: host,
    querySelectorAll: (selector: string) => selector === '[data-anim]' ? [section] : [],
    querySelector: () => null,
  };
  let callback: ((entries: Array<{ target: typeof section; isIntersecting: boolean }>) => void) | undefined;
  const win = {
    matchMedia: () => ({ matches: false }),
    IntersectionObserver: class {
      constructor(onChange: typeof callback) {
        callback = onChange;
      }
      observe() {}
      disconnect() {}
    },
  };
  new Function('window', 'document', 'IntersectionObserver', EFFECTS_RUNTIME_JS)(win, doc, win.IntersectionObserver);
  const runtimeWindow = win as typeof win & { __sfFx?: (root: typeof doc, opts: object) => () => void };
  assert.ok(runtimeWindow.__sfFx);
  runtimeWindow.__sfFx!(doc, {});
  callback!([{ target: section, isIntersecting: true }]);
  assert.ok(classes.has('is-in'));
  callback!([{ target: section, isIntersecting: false }]);
  assert.ok(!section.classList.contains('is-in'), 'l’état initial revient quand la section sort');
  callback!([{ target: section, isIntersecting: true }]);
  assert.ok(section.classList.contains('is-in'), 'l’animation peut se rejouer au retour');
});

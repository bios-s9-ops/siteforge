import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, pushHistory, undoHistory, redoHistory, canUndo, canRedo } from './history';
import {
  createStarterProject,
  duplicateBlockInList,
  insertBlockInList,
  moveBlockInList,
  reorderBlocksByIds,
} from './demoSites';
import { BLOCK_CATALOG } from './blockCatalog';
import { escapeHtml, getContrastTextColor, sanitizeColor, sanitizeUrl } from './validation';
import { generateSeparateHtmlAndCss, generateSiteCss, generateStandaloneHtml } from './exporter';
import { buildSafeSvgDataUrl } from './svgIllustration';
import {
  ART_DIRECTIONS,
  BANNED_FONTS,
  SITEFORGE_UI_IDENTITY,
  applyArtDirectionToTheme,
} from './artDirections';
import {
  DEMO_FICTION_BANNER_TEXT,
  collectIncompleteFields,
  computeBlockSurfaceColors,
  findForbiddenDesignPatterns,
  sanitizeForbiddenCopy,
} from './honesty';

test('le catalogue contient exactement les 15 types de blocs avec 3 variantes chacun', () => {
  assert.equal(BLOCK_CATALOG.length, 15);
  for (const def of BLOCK_CATALOG) {
    assert.ok(def.variants.length >= 3, `Le bloc ${def.type} doit avoir au moins 3 variantes`);
  }
});

test('les 8 directions artistiques respectent les polices autorisées, la diversité d’accents et se distinguent de SiteForge', () => {
  assert.equal(ART_DIRECTIONS.length, 8);
  const fontUsage = new Map<string, number>();
  const accents = new Set<string>();

  for (const dir of ART_DIRECTIONS) {
    assert.ok(!BANNED_FONTS.includes(dir.fonts.heading as (typeof BANNED_FONTS)[number]));
    assert.ok(!BANNED_FONTS.includes(dir.fonts.body as (typeof BANNED_FONTS)[number]));
    fontUsage.set(dir.fonts.heading, (fontUsage.get(dir.fonts.heading) ?? 0) + 1);
    fontUsage.set(dir.fonts.body, (fontUsage.get(dir.fonts.body) ?? 0) + 1);
    accents.add(dir.palette.primary.toLowerCase());
  }

  for (const [font, count] of fontUsage.entries()) {
    assert.ok(count <= 2, `La police ${font} ne doit pas apparaître dans plus de 2 directions (${count})`);
  }
  assert.equal(accents.size, 8, 'Chaque direction doit posséder un accent distinct');

  const artisanal = ART_DIRECTIONS.find((d) => d.id === 'artisanal');
  assert.ok(artisanal);
  assert.notEqual(SITEFORGE_UI_IDENTITY.accent, artisanal.palette.primary);
  assert.notEqual(SITEFORGE_UI_IDENTITY.headingFont, artisanal.fonts.heading);
  assert.notEqual(SITEFORGE_UI_IDENTITY.bodyFont, artisanal.fonts.body);
});

test('l’historique Annuler / Rétablir gère correctement les états', () => {
  let hist = createHistory('v1');
  assert.equal(canUndo(hist), false);
  assert.equal(canRedo(hist), false);

  hist = pushHistory(hist, 'v2');
  hist = pushHistory(hist, 'v3');
  assert.equal(hist.present, 'v3');
  assert.equal(canUndo(hist), true);

  hist = undoHistory(hist);
  assert.equal(hist.present, 'v2');
  assert.equal(canRedo(hist), true);

  hist = redoHistory(hist);
  assert.equal(hist.present, 'v3');

  hist = undoHistory(hist);
  hist = pushHistory(hist, 'v4');
  assert.equal(canRedo(hist), false);
  assert.equal(hist.present, 'v4');
});

test('les opérations sur les blocs (monter, descendre, glisser, dupliquer, insérer) fonctionnent', () => {
  const project = createStarterProject('kora');
  const firstId = project.blocks[0].id;
  const secondId = project.blocks[1].id;

  const movedDown = moveBlockInList(project.blocks, firstId, 'down');
  assert.equal(movedDown[1].id, firstId);
  assert.equal(movedDown[0].id, secondId);

  const movedBack = moveBlockInList(movedDown, firstId, 'up');
  assert.equal(movedBack[0].id, firstId);

  const reordered = reorderBlocksByIds(project.blocks, firstId, project.blocks[2].id);
  assert.equal(reordered[2].id, firstId);

  const { blocks: duplicated, newBlockId } = duplicateBlockInList(project.blocks, secondId);
  assert.equal(duplicated.length, project.blocks.length + 1);
  assert.equal(duplicated[2].id, newBlockId);

  const { blocks: inserted, newBlock } = insertBlockInList(project.blocks, 'cta', null, 'Atelier Kora');
  assert.equal(inserted.length, project.blocks.length + 1);
  assert.equal(inserted[inserted.length - 1].type, 'footer');
  assert.equal(inserted[inserted.length - 2].id, newBlock.id);
});

test('les fonctions de sécurité bloquent les URLs javascript: et échappent le HTML', () => {
  assert.equal(sanitizeUrl('javascript:alert(1)'), '#');
  assert.equal(sanitizeUrl('data:text/html,<script>alert(1)</script>'), '#');
  assert.equal(sanitizeUrl('https://exemple.fr/contact'), 'https://exemple.fr/contact');
  assert.equal(escapeHtml('<script>x</script>'), '&lt;script&gt;x&lt;/script&gt;');
  assert.equal(sanitizeColor('red; background:url(x)', '#000000'), '#000000');
  assert.equal(sanitizeColor('#1E40AF', '#000000'), '#1E40AF');
  assert.equal(getContrastTextColor('#1E40AF'), '#FFFFFF');
  assert.equal(getContrastTextColor('#F8FAFC'), '#0F172A');
});

test('les garde-fous anti-slop et d’honnêteté détectent les motifs bannis et les champs À compléter', () => {
  const violations = findForbiddenDesignPatterns(
    "font-family: 'Inter', sans-serif; backdrop-blur-md bg-clip-text box-shadow: 0 0 24px rgba(124,58,237,0.5);",
  );
  assert.ok(violations.length >= 4);

  const cleaned = sanitizeForbiddenCopy('✨ Révolutionnez votre activité avec notre solution tout-en-un 🚀');
  assert.ok(!cleaned.includes('✨'));
  assert.ok(!cleaned.includes('🚀'));
  assert.ok(!/révolutionnez/i.test(cleaned));
  assert.ok(!/solution tout-en-un/i.test(cleaned));

  const kora = createStarterProject('kora');
  const todos = collectIncompleteFields(kora);
  assert.ok(todos.length >= 3, 'Un projet de démonstration doit recenser ses champs À compléter');
  assert.ok(todos.some((f) => f.fieldKey === 'email'));

  for (const preset of ['kora', 'seve'] as const) {
    const demo = createStarterProject(preset);
    const contentBlocks = demo.blocks.filter((b) => b.type !== 'navbar' && b.type !== 'footer');
    for (let i = 1; i < contentBlocks.length; i++) {
      const prevBg = computeBlockSurfaceColors(contentBlocks[i - 1], i, demo.theme).bg;
      const currBg = computeBlockSurfaceColors(contentBlocks[i], i + 1, demo.theme).bg;
      assert.notEqual(
        prevBg,
        currBg,
        `${preset}: deux sections consécutives (${contentBlocks[i - 1].type}, ${contentBlocks[i].type}) ont le même fond`,
      );
    }
  }
});

test('l’export HTML autonome et ZIP est sans XSS, sans motifs bannis et inclut le bandeau Exemple fictif sur les démos', () => {
  const project = createStarterProject('kora');
  assert.equal(project.isDemo, true);
  project.blocks[1].content.heading = 'Titre <script>alert(1)</script>';

  const html = generateStandaloneHtml(project);
  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('<html lang="fr">'));
  assert.ok(html.includes('<main>'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes(DEMO_FICTION_BANNER_TEXT));
  assert.deepEqual(findForbiddenDesignPatterns(html), []);

  const separate = generateSeparateHtmlAndCss(project);
  assert.ok(separate.indexHtml.includes('<link rel="stylesheet" href="style.css" />'));
  assert.ok(separate.indexHtml.includes(DEMO_FICTION_BANNER_TEXT));
  assert.ok(separate.styleCss.includes('--sf-primary:'));
  assert.ok(separate.assetSources.length > 0);
  assert.deepEqual(findForbiddenDesignPatterns(separate.styleCss), []);

  // Vérifie chaque direction artistique à l'export
  for (const dir of ART_DIRECTIONS) {
    const themed = { ...project, isDemo: false, theme: applyArtDirectionToTheme(dir.id) };
    const css = generateSiteCss(themed);
    const outHtml = generateStandaloneHtml(themed);
    assert.deepEqual(findForbiddenDesignPatterns(css), [], `CSS propre pour ${dir.id}`);
    assert.ok(!outHtml.includes(DEMO_FICTION_BANNER_TEXT), 'Pas de bandeau démo si isDemo est false');
  }
});

test('le générateur d’illustration SVG produit une Data URL valide', () => {
  const dataUrl = buildSafeSvgDataUrl({
    title: 'Atelier lumineux',
    backgroundStart: '#F8FAFC',
    backgroundEnd: '#E2E8F0',
    accentColor: '#1E40AF',
    secondaryAccent: '#0F766E',
    motif: 'architecture',
  });
  assert.ok(dataUrl.startsWith('data:image/svg+xml;utf8,'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanModelText, createLLM, extractJson, toJsonSchema } from './llm';
import { isUsableLicense, normalizeOpenverse, normalizeWikimedia, searchRoyaltyFreeImages } from './stockImageService';
import {
  diversifyChoices,
  fillImageSlots,
  generateSiteProposals,
  isClicheNeonColor,
  sanitizeProposalPalette,
} from './geminiService';
import { contrastRatio } from '../src/utils/colorHarmony';

const noSleep = async () => {};
const jsonRes = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
const chat = (content: string) => ({ choices: [{ message: { content } }] });

test('la sortie du modèle est nettoyée : réflexion, clôtures markdown, texte autour', () => {
  assert.equal(cleanModelText('<think>je réfléchis</think>{"a":1}'), '{"a":1}');
  assert.equal(extractJson('<think>x</think>\n```json\n{"a":[1,2]}\n```'), '{"a":[1,2]}');
  assert.equal(extractJson('Voici : {"a":{"b":"}"}} merci'), '{"a":{"b":"}"}}');
  assert.equal(extractJson('{"a":1'), null, 'JSON tronqué refusé');
  assert.equal(extractJson(''), null);
  assert.deepEqual(toJsonSchema({ type: 'OBJECT', properties: { x: { type: 'STRING' } } }), { type: 'object', properties: { x: { type: 'string' } } });
});

test('Groq : reprise sur 429, modèle suivant, JSON réparé, jamais de réponse vide', async () => {
  process.env.GROQ_API_KEY = 'test-key';
  delete process.env.GEMINI_API_KEY;
  const seen: string[] = [];
  const queue: Response[] = [
    jsonRes(429, { error: 'rate' }, { 'retry-after': '1' }),
    jsonRes(200, chat('<think>..</think>{"ok":true}')),
  ];
  const llm = createLLM({
    sleepFn: noSleep,
    fetchFn: (async (_url: string, init: RequestInit) => {
      seen.push(JSON.parse(String(init.body)).model);
      return queue.shift() ?? jsonRes(500, 'x');
    }) as unknown as typeof fetch,
  });
  const res = await llm.models.generateContent({ contents: 'bonjour', config: { responseMimeType: 'application/json' } });
  assert.equal(res.text, '{"ok":true}');
  assert.deepEqual(seen, ['openai/gpt-oss-120b', 'openai/gpt-oss-120b'], '429 : même modèle, nouvelle tentative');

  // Deux modèles : le premier ne répond que du texte cassé, le second répond bien
  const calls: string[] = [];
  const llm2 = createLLM({
    sleepFn: noSleep,
    fetchFn: (async (_u: string, init: RequestInit) => {
      const model = JSON.parse(String(init.body)).model as string;
      calls.push(model);
      return jsonRes(200, chat(model.startsWith('openai') ? '{"cassé":' : '{"bon":1}'));
    }) as unknown as typeof fetch,
  });
  const res2 = await llm2.models.generateContent({ contents: 'x', config: { responseMimeType: 'application/json' } });
  assert.equal(res2.text, '{"bon":1}');
  assert.ok(calls.includes('qwen/qwen3-32b'));

  // Clé refusée : erreur claire, sans insister
  const llm3 = createLLM({ sleepFn: noSleep, fetchFn: (async () => jsonRes(401, { error: 'bad' })) as unknown as typeof fetch });
  await assert.rejects(llm3.models.generateContent({ contents: 'x' }), (e: { code?: string }) => e.code === 'API_KEY_INVALID');

  // Saturation permanente : erreur claire (jamais de corps vide)
  const llm4 = createLLM({ sleepFn: noSleep, fetchFn: (async () => jsonRes(503, 'down')) as unknown as typeof fetch });
  await assert.rejects(llm4.models.generateContent({ contents: 'x' }), (e: { status?: number }) => e.status === 503);
});

test('sans clé Groq ni Gemini : message clair', async () => {
  delete process.env.GROQ_API_KEY;
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(createLLM().models.generateContent({ contents: 'x' }), (e: { code?: string }) => e.code === 'API_KEY_MISSING');
});

test('recherche d’images libres : normalisation, licences, sources en panne', async () => {
  assert.equal(isUsableLicense('CC BY 4.0'), true);
  assert.equal(isUsableLicense('CC BY-NC 4.0'), false);
  assert.equal(isUsableLicense('CC BY-ND 2.0'), false);
  assert.equal(isUsableLicense('CC0'), true);

  const ov = normalizeOpenverse({
    results: [
      { id: 'a', title: 'Pain <b>doré</b>', url: 'https://x/a.jpg', thumbnail: 'https://x/a_t.jpg', creator: 'Awa', license: 'by', license_version: '4.0', foreign_landing_url: 'https://x/p' },
      { id: 'b', title: 'NC', url: 'https://x/b.jpg', license: 'by-nc', license_version: '2.0' },
      { id: 'c', title: 'javascript', url: 'javascript:alert(1)', license: 'cc0' },
    ],
  });
  assert.equal(ov.length, 1);
  assert.deepEqual([ov[0].id, ov[0].title, ov[0].license, ov[0].source], ['openverse:a', 'Pain doré', 'CC BY 4.0', 'openverse']);

  const wm = normalizeWikimedia({
    query: { pages: { 1: { pageid: 1, title: 'File:Baguette.jpg', imageinfo: [{ url: 'https://c/full.jpg', thumburl: 'https://c/t.jpg', mime: 'image/jpeg', descriptionurl: 'https://c/page', extmetadata: { LicenseShortName: { value: 'CC BY-SA 3.0' }, Artist: { value: '<a href="#">Jean</a>' } } }] }, 2: { pageid: 2, title: 'File:x.svg', imageinfo: [{ url: 'https://c/x.svg', mime: 'image/svg+xml', extmetadata: { LicenseShortName: { value: 'CC0' } } }] } } },
  });
  assert.equal(wm.length, 1, 'SVG écarté');
  assert.equal(wm[0].title, 'Baguette');
  assert.equal(wm[0].author, 'Jean');

  const okFetch = (async (url: string) =>
    url.includes('openverse') ? jsonRes(500, 'x') : jsonRes(200, { query: { pages: { 1: { pageid: 1, title: 'File:A.jpg', imageinfo: [{ url: 'https://c/a.jpg', mime: 'image/jpeg', extmetadata: { LicenseShortName: { value: 'CC0' } } }] } } } })) as unknown as typeof fetch;
  const one = await searchRoyaltyFreeImages('pain', 5, { fetchFn: okFetch });
  assert.equal(one.length, 1, 'une source en panne : l’autre répond');
  await assert.rejects(searchRoyaltyFreeImages('pain', 5, { fetchFn: (async () => jsonRes(500, 'x')) as unknown as typeof fetch }), (e: { code?: string }) => e.code === 'STOCK_UNAVAILABLE');
  assert.deepEqual(await searchRoyaltyFreeImages('   ', 5, { fetchFn: okFetch }), []);
});

test('palettes de l’IA : pas de néon violet ou rose, texte lisible', () => {
  assert.equal(isClicheNeonColor('#B14AED'), true);
  assert.equal(isClicheNeonColor('#7C2D12'), false);
  const fallback = { primary: '#7C2D12', secondary: '#14532D', background: '#FBF8F3', surface: '#F1EADC', text: '#1C1917', mutedText: '#57534E' };
  const p = sanitizeProposalPalette({ primary: '#C026D3', secondary: '#0E7490', background: '#FFFFFF', surface: '#FFFFFF', text: '#EEEEEE', mutedText: 'pas une couleur' }, fallback);
  assert.equal(p.primary, fallback.primary, 'violet fluo remplacé');
  assert.notEqual(p.surface, p.background);
  assert.ok(contrastRatio(p.text, p.background) >= 4.5);
  assert.ok(contrastRatio(p.mutedText, p.background) >= 3.5);
  assert.deepEqual(diversifyChoices(['vertical', 'vertical', 'vertical'] as const as unknown as string[], ['vertical', 'split-screen', 'bento-grid']), ['vertical', 'split-screen', 'bento-grid']);
});

const slotBlock = (slots: unknown) => ({ id: 'b1', type: 'hero', variant: 'split', visible: true, content: { heading: 'x', image: '' }, __slots: slots }) as never;

test('les images viennent uniquement des banques libres : sans résultat, l’emplacement reste vide et les effets sont gardés', async () => {
  const found = { id: 'openverse:1', url: 'https://x/1.jpg', thumbUrl: 'https://x/1t.jpg', title: 'Pain', author: 'Awa', license: 'CC BY 4.0', source: 'openverse' as const };
  const withImage = slotBlock([{ target: 'content', query: 'pain', scroll: 'parallax-slow', scrollIntensity: 70, effect3d: 'tilt-3d-hover' }]);
  await fillImageSlots([withImage], async () => [found]);
  const c = (withImage as { content: { image: string; imageCredit: string; imageEffect: { scroll: string; scrollIntensity: number; effect3d: string } } }).content;
  assert.equal(c.image, 'https://x/1.jpg');
  assert.ok(c.imageCredit.includes('Awa') && c.imageCredit.includes('CC BY 4.0'));
  assert.deepEqual([c.imageEffect.scroll, c.imageEffect.scrollIntensity, c.imageEffect.effect3d], ['parallax-slow', 70, 'tilt-3d-hover']);

  const noImage = slotBlock([{ target: 'content', query: 'introuvable', scroll: 'scroll-zoom-in', effect3d: 'before-after-slider' }]);
  const stats = await fillImageSlots([noImage], async () => {
    throw new Error('réseau');
  });
  const e = (noImage as { content: { image: string; imageEffect: { scroll: string; effect3d: string } } }).content;
  assert.equal(e.image, '', 'jamais d’image de substitution');
  assert.equal(e.imageEffect.scroll, 'scroll-zoom-in');
  assert.equal(e.imageEffect.effect3d, 'none', 'avant / après impossible sans seconde image');
  assert.equal(stats.empty, 1);
});

test('trois propositions : mises en page distinctes, aucune image inventée, sections factuelles jamais remplies', async () => {
  const mk = (i: number, primary: string) => ({
    name: `Idée ${i}`,
    concept: 'Concept',
    layoutMode: 'vertical',
    headerStyle: 'classic-bar',
    palette: { primary, secondary: '#14532D', background: '#FBF8F3', surface: '#F1EADC', text: '#1C1917', mutedText: '#57534E' },
    fonts: { heading: 'Fraunces', body: 'Hanken Grotesk' },
    blocks: [
      { type: 'navbar', variant: 'inline', content: { brandName: 'Test', items: [{ title: 'Services', linkHref: '#services' }] } },
      { type: 'hero', variant: 'split', animation: 'fade-up', animationDurationMs: 900, content: { heading: 'Du pain', subheading: 'Sobre' }, imageSlots: [{ target: 'content', query: 'pain levain', scroll: 'parallax-slow' }] },
      { type: 'testimonials', variant: 'cards', content: { heading: 'Avis', items: [{ title: 'Faux client', description: 'Génial' }] } },
      { type: 'services', variant: 'numbered-list', content: { heading: 'Services', items: [{ title: 'Pain', description: 'Au levain' }] } },
      { type: 'contact', variant: 'split-info', content: { heading: 'Contact', email: 'inventé@exemple.fr' } },
      { type: 'footer', variant: 'multi-column', content: { brandName: 'Test' } },
    ],
  });
  const llm = { models: { generateContent: async () => ({ text: JSON.stringify({ proposals: [mk(1, '#C026D3'), mk(2, '#7C2D12'), mk(3, '#14532D')] }) }) } };
  const out = await generateSiteProposals(
    { description: 'Une boulangerie', vision: 'chaleureux, parallaxe', mustHave: 'Des témoignages et une carte' },
    { llm, search: async () => [] },
  );
  assert.equal(out.length, 3);
  assert.equal(new Set(out.map((p) => p.project.theme.layoutMode)).size, 3, 'trois architectures différentes');
  for (const p of out) {
    const hero = p.project.blocks.find((b) => b.type === 'hero')!;
    assert.equal(hero.content.image, '', 'aucune image sans résultat libre de droits');
    assert.equal(hero.content.imageEffect?.scroll, 'parallax-slow', 'effet conservé pour la future photo');
    assert.equal(hero.animation, 'fade-up');
    const testimonials = p.project.blocks.find((b) => b.type === 'testimonials')!;
    assert.ok(!JSON.stringify(testimonials).includes('Faux client'), 'avis inventé écarté');
    const contact = p.project.blocks.find((b) => b.type === 'contact')!;
    assert.ok(!JSON.stringify(contact.content).includes('inventé@exemple.fr'), 'e-mail inventé écarté');
    assert.equal(p.project.blocks[0].type, 'navbar');
    assert.equal(p.project.blocks.at(-1)?.type, 'footer');
    assert.equal(p.project.projectInput?.mode, 'ai');
  }
  assert.notEqual(out[0].project.theme.palette.primary, '#C026D3', 'violet fluo refusé');
});

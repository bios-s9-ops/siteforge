import test from 'node:test';
import assert from 'node:assert/strict';
import type { SiteBlock, SiteProject, SiteSettings } from '../types/site';
import { createBlockInstance } from './blockCatalog';
import { createStarterProject } from './demoSites';
import { generateStandaloneHtml } from './exporter';
import { buildAnchorMap, collectLinkIssues, resolveHref } from './links';
import { describeFormDelivery, resolveFormDelivery } from './forms';
import {
  buildDeploymentGuide,
  buildFaviconSvg,
  buildJsonLd,
  buildRobotsTxt,
  buildSitemapXml,
  collectPublishIssues,
} from './publish';
import { buildWhatsappUrl, normalizeSiteUrl, normalizeWhatsappNumber, parseSocialLinks } from './siteSettings';

function makeProject(settings?: SiteSettings, patch?: (blocks: SiteBlock[]) => void): SiteProject {
  const base = createStarterProject('kora');
  const blocks: SiteBlock[] = [
    createBlockInstance('navbar', 'Atelier Test'),
    createBlockInstance('hero', 'Atelier Test'),
    createBlockInstance('services', 'Atelier Test'),
    createBlockInstance('contact', 'Atelier Test'),
    createBlockInstance('footer', 'Atelier Test'),
  ];
  const contact = blocks.find((b) => b.type === 'contact')!;
  contact.content.email = 'contact@atelier-test.fr';
  contact.content.phone = '+33 6 12 34 56 78';
  contact.content.address = 'À compléter';
  patch?.(blocks);
  return { ...base, id: 'test', name: 'Atelier Test', isDemo: false, blocks, settings };
}

test('les liens pointent vers des sections qui existent, sinon ils sont retirés', () => {
  const project = makeProject();
  const anchors = buildAnchorMap(project.blocks);

  assert.equal(resolveHref('#contact', anchors)?.href, '#contact');
  assert.equal(resolveHref('#accueil', anchors)?.href, '#accueil');
  assert.equal(resolveHref('#devis', anchors)?.href, '#contact', 'alias devis → contact');
  assert.equal(resolveHref('#Réalisations', anchors), null, 'pas de galerie : lien retiré');
  assert.equal(resolveHref('#realisations', anchors, { fallbackToContact: true })?.href, '#contact');
  assert.equal(resolveHref('#', anchors), null);
  assert.equal(resolveHref('javascript:alert(1)', anchors), null);
  assert.equal(resolveHref('contact.html', anchors), null, 'chemin relatif : site à une seule page');
  assert.deepEqual(resolveHref('https://example.com/x', anchors), { href: 'https://example.com/x', external: true });
  assert.equal(resolveHref('mailto:a@b.fr', anchors)?.external, false);

  const twoServices = buildAnchorMap([
    createBlockInstance('services'),
    createBlockInstance('services'),
  ]);
  assert.deepEqual([...twoServices.byBlockId.values()], ['services', 'services-2']);
});

test('l’export ne contient aucun lien mort, aucun id en double et un menu mobile', () => {
  const project = makeProject();
  const html = generateStandaloneHtml(project);

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'ids uniques');
  const hrefs = [...html.matchAll(/href="#([^"]*)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length > 0);
  for (const h of hrefs) {
    assert.ok(h !== '', 'pas de href="#" vide');
    assert.ok(ids.includes(h), `l’ancre #${h} existe`);
  }
  // « À propos » et « Réalisations » n'existent pas dans cette page : leurs liens de menu sont retirés
  assert.ok(!html.includes('>À propos</a>'));
  assert.ok(!html.includes('>Réalisations</a>'));

  assert.ok(html.includes('data-nav-toggle'));
  assert.ok(html.includes('aria-expanded="false"'));
  assert.ok(html.includes('id="top"'));
  assert.ok(!html.includes('bien été préparé'), 'plus de faux message de succès');

  const issues = collectLinkIssues(project);
  assert.ok(issues.some((i) => i.label === 'À propos'));
});

test('les coordonnées sont cliquables et « À compléter » n’est pas affiché au public', () => {
  const html = generateStandaloneHtml(makeProject({ formProvider: 'none', whatsappNumber: '+33 6 12 34 56 78' }));
  assert.ok(html.includes('href="mailto:contact@atelier-test.fr"'));
  assert.ok(html.includes('href="tel:+33612345678"'));
  assert.ok(!html.includes('<strong>Adresse :</strong>'), 'adresse « À compléter » non publiée');
  assert.ok(html.includes('https://wa.me/33612345678'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
});

test('chaque mode de réception produit la bonne configuration, sans rien inventer', () => {
  const base = makeProject();

  // Rien choisi + e-mail présent : repli honnête sur la messagerie du visiteur
  const fallback = resolveFormDelivery(base);
  assert.equal(fallback.provider, 'mailto');
  assert.equal(fallback.viaFallback, true);
  assert.equal(describeFormDelivery(base).level, 'warn');

  // Rien choisi et aucun e-mail : le formulaire ne peut rien envoyer, et le dit
  const empty = makeProject(undefined, (blocks) => {
    const c = blocks.find((b) => b.type === 'contact')!;
    c.content.email = 'À compléter';
  });
  assert.equal(resolveFormDelivery(empty).configured, false);
  assert.equal(describeFormDelivery(empty).level, 'error');
  assert.ok(generateStandaloneHtml(empty).includes('pas encore relié à une boîte de réception'));
  assert.ok(collectPublishIssues(empty).some((i) => i.id === 'form-unconfigured'));

  const formsubmit = resolveFormDelivery({ ...base, settings: { formProvider: 'formsubmit' } });
  assert.equal(formsubmit.provider, 'formsubmit');
  assert.equal(formsubmit.endpoint, 'https://formsubmit.co/ajax/contact@atelier-test.fr');

  const web3 = resolveFormDelivery({ ...base, settings: { formProvider: 'web3forms', formKey: 'abcd1234-ef56-7890' } });
  assert.equal(web3.provider, 'web3forms');
  assert.equal(web3.key, 'abcd1234-ef56-7890');
  const web3Bad = resolveFormDelivery({ ...base, settings: { formProvider: 'web3forms', formKey: '<x>' } });
  assert.equal(web3Bad.provider, 'mailto', 'clé invalide : repli, jamais de clé inventée');

  const formspree = resolveFormDelivery({
    ...base,
    settings: { formProvider: 'formspree', formKey: 'https://formspree.io/f/xyzabcd1' },
  });
  assert.equal(formspree.endpoint, 'https://formspree.io/f/xyzabcd1');

  const netlifyHtml = generateStandaloneHtml({ ...base, settings: { formProvider: 'netlify' } });
  assert.ok(netlifyHtml.includes('data-netlify="true"'));
  assert.ok(netlifyHtml.includes('name="form-name"'));

  const wa = resolveFormDelivery({ ...base, settings: { formProvider: 'whatsapp', whatsappNumber: '0033 6 12 34 56 78' } });
  assert.equal(wa.provider, 'whatsapp');
  assert.equal(wa.whatsapp, '33612345678');
});

test('le formulaire de devis propose les vrais services du site et rien d’autre', () => {
  const project = makeProject(undefined, (blocks) => {
    const contact = blocks.find((b) => b.type === 'contact')!;
    contact.variant = 'devis';
    const services = blocks.find((b) => b.type === 'services')!;
    services.content.items = [
      { id: 's1', title: 'Cuisine sur mesure' },
      { id: 's2', title: 'À compléter' },
      { id: 's3', title: 'Dressing' },
    ];
  });
  const html = generateStandaloneHtml(project);
  assert.ok(html.includes('<option value="Cuisine sur mesure">'));
  assert.ok(html.includes('<option value="Dressing">'));
  assert.ok(!html.includes('<option value="À compléter">'));
  assert.ok(html.includes('name="budget"'));
  assert.ok(html.includes('Demande de devis — Atelier Test'));
});

test('les fichiers de mise en ligne sont cohérents et ne contiennent rien d’inventé', () => {
  const noUrl = makeProject();
  assert.equal(buildSitemapXml(noUrl), null);
  assert.ok(!buildRobotsTxt(noUrl).includes('Sitemap:'));

  const withUrl = makeProject({ formProvider: 'formsubmit', siteUrl: 'https://www.atelier-test.fr/' });
  assert.equal(normalizeSiteUrl('https://www.atelier-test.fr/'), 'https://www.atelier-test.fr');
  assert.equal(normalizeSiteUrl('www.sans-protocole.fr'), '');
  const sitemap = buildSitemapXml(withUrl, new Date('2026-11-22T10:00:00Z'));
  assert.ok(sitemap?.includes('<loc>https://www.atelier-test.fr/</loc>'));
  assert.ok(sitemap?.includes('<lastmod>2026-11-22</lastmod>'));
  assert.ok(buildRobotsTxt(withUrl).includes('Sitemap: https://www.atelier-test.fr/sitemap.xml'));

  const html = generateStandaloneHtml(withUrl);
  assert.ok(html.includes('<link rel="canonical" href="https://www.atelier-test.fr/" />'));
  assert.ok(html.includes('application/ld+json'));

  const ld = JSON.parse(buildJsonLd(withUrl));
  assert.equal(ld.email, 'contact@atelier-test.fr');
  assert.equal(ld.address, undefined, 'adresse « À compléter » absente des données structurées');

  assert.ok(buildFaviconSvg(withUrl).includes('>A</text>'));
  const guide = buildDeploymentGuide(withUrl);
  assert.ok(guide.includes('Netlify'));
  assert.ok(guide.includes('FormSubmit'));
});

test('les numéros WhatsApp et les liens de réseaux sont nettoyés', () => {
  assert.equal(normalizeWhatsappNumber('+225 07 12 34 56 78'), '2250712345678');
  assert.equal(normalizeWhatsappNumber('12'), '');
  assert.ok(buildWhatsappUrl('0033612345678', 'Bonjour').includes('wa.me/33612345678?text=Bonjour'));
  const links = parseSocialLinks('Insta : https://www.instagram.com/atelier, javascript:alert(1) et https://facebook.com/atelier.');
  assert.deepEqual(
    links.map((l) => l.label),
    ['Instagram', 'Facebook'],
  );
});

// --- Exécution réelle du site exporté (jsdom) ---------------------------------------------------

async function loadJsdom(): Promise<any | null> {
  try {
    return await import('jsdom');
  } catch {
    return null;
  }
}

function fillForm(window: any, form: HTMLFormElement, consent = true) {
  (form.querySelector('[name="name"]') as HTMLInputElement).value = 'Awa Test';
  (form.querySelector('[name="email"]') as HTMLInputElement).value = 'awa@example.com';
  (form.querySelector('[name="message"]') as HTMLTextAreaElement).value = 'Bonjour, je voudrais un devis.';
  (form.querySelector('[name="consent"]') as HTMLInputElement).checked = consent;
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
}

const tick = () => new Promise((r) => setTimeout(r, 25));

test('exécution : le menu mobile s’ouvre et se ferme', async (t) => {
  const jsdom = await loadJsdom();
  if (!jsdom) return t.skip('jsdom non installé');
  const dom = new jsdom.JSDOM(generateStandaloneHtml(makeProject()), { runScripts: 'dangerously', url: 'https://example.test/' });
  const { document } = dom.window;
  const toggle = document.querySelector('[data-nav-toggle]') as HTMLButtonElement;
  const panel = document.getElementById('sf-nav-panel')!;
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.ok(panel.classList.contains('is-open'));
  (panel.querySelector('a') as HTMLAnchorElement).click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.ok(!panel.classList.contains('is-open'));
});

test('exécution : le formulaire n’annonce « envoyé » que si le service a répondu OK', async (t) => {
  const jsdom = await loadJsdom();
  if (!jsdom) return t.skip('jsdom non installé');
  const project = makeProject({ formProvider: 'formsubmit' });
  const html = generateStandaloneHtml(project);

  // 1. Succès du service
  const calls: Array<{ url: string; body: any }> = [];
  const okDom = new jsdom.JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://example.test/',
    beforeParse(window: any) {
      window.fetch = async (url: string, init: any) => {
        calls.push({ url, body: JSON.parse(init.body) });
        return { ok: true, json: async () => ({ success: 'true' }) };
      };
    },
  });
  const okForm = okDom.window.document.querySelector('form[data-sf-form]') as HTMLFormElement;
  fillForm(okDom.window, okForm);
  await tick();
  const okStatus = okForm.querySelector('[data-form-status]') as HTMLElement;
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://formsubmit.co/ajax/contact@atelier-test.fr');
  assert.equal(calls[0].body.email, 'awa@example.com');
  assert.equal(calls[0].body.name, 'Awa Test');
  assert.equal(okStatus.getAttribute('data-kind'), 'ok');
  assert.ok(okStatus.textContent!.includes('bien été envoyé'));

  // 2. Le service refuse : jamais de faux succès, coordonnées de secours affichées
  const refuseDom = new jsdom.JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://example.test/',
    beforeParse(window: any) {
      window.fetch = async () => ({ ok: true, json: async () => ({ success: 'false' }) });
    },
  });
  const refuseForm = refuseDom.window.document.querySelector('form[data-sf-form]') as HTMLFormElement;
  fillForm(refuseDom.window, refuseForm);
  await tick();
  const refuseStatus = refuseForm.querySelector('[data-form-status]') as HTMLElement;
  assert.equal(refuseStatus.getAttribute('data-kind'), 'error');
  assert.ok(!refuseStatus.textContent!.includes('bien été envoyé'));
  assert.ok(refuseStatus.textContent!.includes('contact@atelier-test.fr'));

  // 3. Réseau coupé
  const offlineDom = new jsdom.JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://example.test/',
    beforeParse(window: any) {
      window.fetch = async () => {
        throw new Error('offline');
      };
    },
  });
  const offlineForm = offlineDom.window.document.querySelector('form[data-sf-form]') as HTMLFormElement;
  fillForm(offlineDom.window, offlineForm);
  await tick();
  assert.equal((offlineForm.querySelector('[data-form-status]') as HTMLElement).getAttribute('data-kind'), 'error');
  assert.equal((offlineForm.querySelector('button[type="submit"]') as HTMLButtonElement).disabled, false);
});

test('exécution : consentement requis, anti-spam, mode test et formulaire non configuré', async (t) => {
  const jsdom = await loadJsdom();
  if (!jsdom) return t.skip('jsdom non installé');
  const project = makeProject({ formProvider: 'formsubmit' });

  // Sans consentement : rien n'est envoyé
  let fetchCalls = 0;
  const countFetch = (window: any) => {
    window.fetch = async () => {
      fetchCalls += 1;
      return { ok: true, json: async () => ({ success: true }) };
    };
  };
  const noConsent = new jsdom.JSDOM(generateStandaloneHtml(project), {
    runScripts: 'dangerously',
    url: 'https://example.test/',
    beforeParse: countFetch,
  });
  fillForm(noConsent.window, noConsent.window.document.querySelector('form[data-sf-form]') as HTMLFormElement, false);
  await tick();
  assert.equal(fetchCalls, 0);

  // Champ piège rempli : rien n'est envoyé
  const bot = new jsdom.JSDOM(generateStandaloneHtml(project), {
    runScripts: 'dangerously',
    url: 'https://example.test/',
    beforeParse: countFetch,
  });
  const botForm = bot.window.document.querySelector('form[data-sf-form]') as HTMLFormElement;
  (botForm.querySelector('[name="_gotcha"]') as HTMLInputElement).value = 'spam';
  fillForm(bot.window, botForm);
  await tick();
  assert.equal(fetchCalls, 0);

  // Mode test de l'aperçu : rien n'est transmis
  const dry = new jsdom.JSDOM(generateStandaloneHtml(project, { dryRun: true }), {
    runScripts: 'dangerously',
    url: 'https://example.test/',
    beforeParse: countFetch,
  });
  const dryForm = dry.window.document.querySelector('form[data-sf-form]') as HTMLFormElement;
  fillForm(dry.window, dryForm);
  await tick();
  assert.equal(fetchCalls, 0);
  assert.ok((dryForm.querySelector('[data-form-status]') as HTMLElement).textContent!.includes('Mode test'));

  // Formulaire sans aucune boîte de réception : message d'erreur honnête
  const empty = makeProject(undefined, (blocks) => {
    blocks.find((b) => b.type === 'contact')!.content.email = 'À compléter';
  });
  const none = new jsdom.JSDOM(generateStandaloneHtml(empty), {
    runScripts: 'dangerously',
    url: 'https://example.test/',
    beforeParse: countFetch,
  });
  const noneForm = none.window.document.querySelector('form[data-sf-form]') as HTMLFormElement;
  fillForm(none.window, noneForm);
  await tick();
  assert.equal(fetchCalls, 0);
  const noneStatus = noneForm.querySelector('[data-form-status]') as HTMLElement;
  assert.equal(noneStatus.getAttribute('data-kind'), 'error');
  assert.ok(noneStatus.textContent!.includes('pas encore relié'));
});

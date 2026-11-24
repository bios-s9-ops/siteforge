import type { SiteBlock, SiteProject } from '../types/site';
import { describeFormDelivery, resolveFormDelivery } from './forms';
import { collectLinkIssues } from './links';
import { cleanEmail, getSiteSettings, normalizeSiteUrl, toTelHref } from './siteSettings';
import { isEmptyOrTodo } from './honesty';
import { escapeHtml, sanitizeColor } from './validation';

export interface PublishIssue {
  id: string;
  /** warning : demande une confirmation avant l'export ; info : simple rappel */
  severity: 'warning' | 'info';
  title: string;
  detail: string;
  /** Où corriger : l'onglet Publier, ou un bloc précis */
  fix?: { kind: 'publish-settings' } | { kind: 'block'; blockId: string };
}

/** Ce qu'il reste à régler pour que le site soit réellement utilisable une fois en ligne. */
export function collectPublishIssues(project: SiteProject): PublishIssue[] {
  const issues: PublishIssue[] = [];
  const contact = project.blocks.find((b) => b.type === 'contact' && b.visible);

  if (!contact) {
    issues.push({
      id: 'no-contact',
      severity: 'warning',
      title: 'Aucun moyen de vous contacter',
      detail: 'La page ne contient pas de bloc « Formulaire de contact » : les visiteurs ne pourront ni vous écrire ni demander un devis.',
    });
  } else {
    const delivery = describeFormDelivery(project);
    const d = resolveFormDelivery(project);
    if (delivery.level === 'error') {
      issues.push({
        id: 'form-unconfigured',
        severity: 'warning',
        title: 'Le formulaire n’enverra rien',
        detail: delivery.text,
        fix: { kind: 'publish-settings' },
      });
    } else if (d.viaFallback || d.provider === 'mailto') {
      issues.push({
        id: 'form-fallback',
        severity: 'warning',
        title: 'Réception par la messagerie du visiteur',
        detail: delivery.text,
        fix: { kind: 'publish-settings' },
      });
    } else if (delivery.level === 'warn' || d.provider === 'formsubmit') {
      issues.push({
        id: 'form-note',
        severity: 'info',
        title: 'À vérifier pour la réception des messages',
        detail: delivery.text,
        fix: { kind: 'publish-settings' },
      });
    }
  }

  for (const link of collectLinkIssues(project)) {
    issues.push({
      id: `link:${link.blockId}:${link.label}`,
      severity: 'warning',
      title: `Lien retiré : « ${link.label} »`,
      detail: link.reason,
      fix: { kind: 'block', blockId: link.blockId },
    });
  }

  if (!normalizeSiteUrl(getSiteSettings(project).siteUrl)) {
    issues.push({
      id: 'site-url',
      severity: 'info',
      title: 'Adresse du site non renseignée',
      detail: 'Sans l’adresse publique du site, l’export ne peut pas inclure de sitemap.xml ni de lien canonique pour Google.',
      fix: { kind: 'publish-settings' },
    });
  }

  issues.push({
    id: 'legal',
    severity: 'info',
    title: 'Mentions légales à prévoir',
    detail:
      'En France, un site professionnel doit présenter des mentions légales (éditeur, hébergeur, contact). SiteForge ne les génère pas : à ajouter selon votre situation avant la mise en ligne.',
  });

  return issues;
}

function brandInitial(project: SiteProject): string {
  const navbar = project.blocks.find((b) => b.type === 'navbar');
  const name = (navbar?.content.brandName || project.name || '').trim();
  const match = name.match(/[A-Za-zÀ-ÿ0-9]/);
  return (match ? match[0] : 'S').toUpperCase();
}

/** Favicon SVG : initiale du nom du site sur la couleur principale. Aucune image à fournir. */
export function buildFaviconSvg(project: SiteProject): string {
  const fill = sanitizeColor(project.theme.palette.primary, '#1B4332');
  const text = sanitizeColor(project.theme.palette.background, '#FFFFFF');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${fill}"/><text x="32" y="45" font-size="38" text-anchor="middle" font-family="Georgia, serif" font-weight="700" fill="${text}">${escapeHtml(brandInitial(project))}</text></svg>`;
}

export function faviconDataUri(project: SiteProject): string {
  return `data:image/svg+xml,${encodeURIComponent(buildFaviconSvg(project))}`;
}

function contactValues(blocks: SiteBlock[]) {
  const contact = blocks.find((b) => b.type === 'contact' && b.visible);
  const email = cleanEmail(contact?.content.email);
  const tel = toTelHref(contact?.content.phone).replace(/^tel:/, '');
  const address = isEmptyOrTodo(contact?.content.address) ? '' : (contact?.content.address ?? '').trim();
  return { email, tel, address };
}

/** Données structurées Organization : uniquement ce que l'utilisateur a réellement renseigné. */
export function buildJsonLd(project: SiteProject): string {
  const siteUrl = normalizeSiteUrl(getSiteSettings(project).siteUrl);
  const { email, tel, address } = contactValues(project.blocks);
  const data: Record<string, string> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: project.name,
  };
  if (siteUrl) data.url = siteUrl;
  if (email) data.email = email;
  if (tel) data.telephone = tel;
  if (address) data.address = address;
  // Empêche toute fermeture prématurée de la balise <script>
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** Balises <head> utiles à la mise en ligne : canonical, partage, couleur du navigateur, favicon, JSON-LD. */
export function buildHeadExtras(project: SiteProject, faviconHref: string): string {
  const siteUrl = normalizeSiteUrl(getSiteSettings(project).siteUrl);
  const title = project.seoTitle || project.name;
  const description = project.seoDescription || '';
  const primary = sanitizeColor(project.theme.palette.primary, '#1B4332');
  const lines = [
    `<meta name="theme-color" content="${escapeHtml(primary)}" />`,
    `<link rel="icon" type="image/svg+xml" href="${escapeHtml(faviconHref)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:card" content="summary" />`,
  ];
  if (siteUrl) {
    lines.push(`<link rel="canonical" href="${escapeHtml(siteUrl)}/" />`);
    lines.push(`<meta property="og:url" content="${escapeHtml(siteUrl)}/" />`);
  }
  lines.push(`<script type="application/ld+json">${buildJsonLd(project)}</script>`);
  return lines.join('\n  ');
}

export function buildRobotsTxt(project: SiteProject): string {
  const siteUrl = normalizeSiteUrl(getSiteSettings(project).siteUrl);
  return `User-agent: *\nAllow: /\n${siteUrl ? `\nSitemap: ${siteUrl}/sitemap.xml\n` : ''}`;
}

/** Renvoie null quand l'adresse du site est inconnue : pas de sitemap inventé. */
export function buildSitemapXml(project: SiteProject, today = new Date()): string | null {
  const siteUrl = normalizeSiteUrl(getSiteSettings(project).siteUrl);
  if (!siteUrl) return null;
  const lastmod = today.toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${escapeHtml(siteUrl)}/</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>\n</urlset>\n`;
}

/** Guide de mise en ligne livré dans le ZIP, adapté au mode de réception choisi. */
export function buildDeploymentGuide(project: SiteProject): string {
  const d = resolveFormDelivery(project);
  const siteUrl = normalizeSiteUrl(getSiteSettings(project).siteUrl);

  const formSection = (() => {
    switch (d.provider) {
      case 'formsubmit':
        return `Réception des messages : FormSubmit, vers ${d.email}.
- Au tout premier envoi depuis le site en ligne, FormSubmit envoie un e-mail d'activation à cette adresse.
- Cliquez sur le lien de cet e-mail (pensez aux courriers indésirables), puis refaites un test.
- Tant que ce n'est pas activé, les messages ne sont pas transmis : le site affichera un message d'erreur au visiteur.
- Attention : l'adresse e-mail est lisible dans le code de la page.`;
      case 'web3forms':
        return `Réception des messages : Web3Forms.
- Votre clé d'accès est dans le code de la page : c'est normal, elle est faite pour cela.
- Les messages arrivent à l'adresse associée à cette clé sur le site de Web3Forms.`;
      case 'formspree':
        return `Réception des messages : Formspree.
- Les messages arrivent à l'adresse associée à votre formulaire dans votre compte Formspree.
- Vérifiez dans votre compte Formspree que le formulaire est actif.`;
      case 'netlify':
        return `Réception des messages : Netlify Forms.
- Cela ne fonctionne que si le site est hébergé chez Netlify.
- Après la mise en ligne, les messages se lisent dans le tableau de bord Netlify, rubrique Forms. Vous pouvez y activer les notifications par e-mail.`;
      case 'whatsapp':
        return `Réception des messages : WhatsApp (+${d.whatsapp}).
- Le formulaire ouvre WhatsApp avec le message prêt ; le visiteur doit appuyer sur Envoyer.`;
      case 'mailto':
        return `Réception des messages : messagerie du visiteur, vers ${d.email}.
- Le formulaire ouvre le logiciel de messagerie du visiteur avec un message prérempli. S'il n'en a pas de configuré, rien ne part.
- Pour une réception plus fiable, relancez l'export avec FormSubmit, Web3Forms ou Formspree (onglet Publier de SiteForge).`;
      default:
        return `Réception des messages : non configurée.
- Le formulaire ne peut rien envoyer. Retournez dans SiteForge, onglet Publier, et choisissez un mode de réception avant de mettre le site en ligne.`;
    }
  })();

  return `# Mettre en ligne « ${project.name} »

Ce dossier contient un site prêt à être publié :
- index.html : la page du site
- style.css : la mise en forme
- assets/ : les images
- favicon.svg : l'icône de l'onglet
- robots.txt${siteUrl ? ' et sitemap.xml : pour les moteurs de recherche' : ' : pour les moteurs de recherche (sitemap.xml absent : adresse du site non renseignée)'}

## 1. Publier gratuitement avec une adresse générique

Ces services hébergent des sites statiques et donnent une adresse du type nom-du-site.netlify.app ou nom-du-site.pages.dev. Leurs interfaces évoluent : suivez leurs instructions actuelles.

- Netlify : glissez-déposez tout le dossier sur la page « Netlify Drop » (app.netlify.com/drop).
- Cloudflare Pages : « Créer un projet » puis « Téléverser des fichiers » (Direct Upload).
- GitHub Pages : placez les fichiers dans un dépôt, puis activez Pages dans les réglages du dépôt.
- Vercel : importez le dossier ou le dépôt comme projet statique.

## 2. Utiliser votre propre nom de domaine

1. Achetez le nom de domaine chez un registraire de votre choix.
2. Dans l'hébergeur, ajoutez le domaine personnalisé au site.
3. Chez le registraire, créez les enregistrements DNS que l'hébergeur vous indique.
4. Attendez la propagation (de quelques minutes à quelques heures). Le HTTPS est en général activé automatiquement.
5. Revenez dans SiteForge, renseignez l'adresse du site dans l'onglet Publier et réexportez : le sitemap et le lien canonique seront corrects.

## 3. ${formSection.split('\n')[0]}

${formSection.split('\n').slice(1).join('\n')}

## 4. Avant de publier : liste de vérification

- Envoyez-vous un message de test depuis le site en ligne et vérifiez qu'il arrive.
- Cliquez sur tous les liens du menu, sur mobile comme sur ordinateur.
- Remplacez tout texte « À compléter » et toutes les images d'exemple par vos vraies informations.
- N'affichez que des avis, chiffres et photos de personnes réels, avec leur accord.
- Ajoutez vos mentions légales (obligatoires en France pour un site professionnel).
- Les polices viennent de Google Fonts : le navigateur du visiteur contacte les serveurs de Google pour les charger. Si cela vous préoccupe pour la vie privée, hébergez les polices vous-même.
`;
}

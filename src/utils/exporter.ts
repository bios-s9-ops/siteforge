import JSZip from 'jszip';
import type { SiteBlock, SiteProject, SiteRadius, SiteSpacing, SiteTheme } from '../types/site';
import { computeBlockSurfaceColors, DEMO_FICTION_BANNER_TEXT, isEmptyOrTodo } from './honesty';
import { escapeHtml, getContrastTextColor, sanitizeColor, sanitizeFontName, sanitizeUrl } from './validation';
import { buildAnchorMap, externalAttrs, resolveHref, type AnchorMap } from './links';
import { FORM_RUNTIME_SCRIPT, renderFormHtml } from './forms';
import {
  buildDeploymentGuide,
  buildFaviconSvg,
  buildHeadExtras,
  buildRobotsTxt,
  buildSitemapXml,
  faviconDataUri,
} from './publish';
import { buildWhatsappUrl, cleanEmail, getSiteSettings, parseSafeBlockCss, parseSocialLinks, serializeSafeBlockCss, toTelHref } from './siteSettings';
import { BENTO_SPANS, EFFECTS_CSS, EFFECTS_RUNTIME_JS } from './effectsRuntime';
import {
  clampDuration,
  hasAnyImageEffect,
  sanitizeHeaderStyle,
  sanitizeImageEffect,
  sanitizeLayoutMode,
  sanitizeSectionAnimation,
} from './effectsCatalog';
import { deriveAlternatePalette } from './colorHarmony';
import { collectImageCredits } from './credits';
import { genericFallback, googleFontsHref } from './fonts';
import type { ImageEffectConfig, SiteLayoutMode, SitePalette } from '../types/site';

const RADIUS_MAP: Record<SiteRadius, string> = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '14px',
  full: '9999px',
};

const SPACING_MAP: Record<SiteSpacing, string> = {
  compact: '52px',
  normal: '84px',
  airy: '116px',
};

interface RenderCtx {
  project: SiteProject;
  anchors: AnchorMap;
  rewriteAssetSrc: (src?: string) => string;
}

/**
 * Lien ou bouton qui fonctionne vraiment : ancre vérifiée, e-mail/téléphone cliquables,
 * liens externes sécurisés. Si rien ne peut fonctionner, l'élément est retiré (jamais de lien mort).
 */
function linkHtml(
  ctx: RenderCtx,
  label: string | undefined,
  href: string | undefined,
  className: string,
  opts: { fallback?: boolean; style?: string; prefill?: string } = {},
): string {
  if (!label || !label.trim()) return '';
  const link = href && /^#page-[a-z0-9-]+$/i.test(href)
    ? { href, external: false }
    : resolveHref(href, ctx.anchors, { fallbackToContact: opts.fallback ?? true });
  if (!link) return '';
  const contactAnchor = ctx.anchors.firstByType.get('contact');
  const prefill =
    opts.prefill && !isEmptyOrTodo(opts.prefill) && contactAnchor && link.href === `#${contactAnchor}`
      ? ` data-prefill="${escapeHtml(opts.prefill)}"`
      : '';
  const style = opts.style ? ` style="${opts.style}"` : '';
  return `<a class="${className}"${style} href="${escapeHtml(link.href)}"${externalAttrs(link)}${prefill}>${escapeHtml(label)}</a>`;
}

function buildGoogleFontsHref(heading: string, body: string): string {
  return googleFontsHref([sanitizeFontName(heading, 'Fraunces'), sanitizeFontName(body, 'Hanken Grotesk')]);
}

/** Référence de couleur : variable CSS quand la couleur est un rôle de la palette (le mode sombre peut alors l'échanger). */
function cssColorRef(value: string | undefined, palette: SitePalette, fallback: string): string {
  const v = sanitizeColor(value ?? '', fallback).toUpperCase();
  const roles: Array<[string, string]> = [
    [palette.background, '--sf-bg'],
    [palette.surface, '--sf-surface'],
    [palette.text, '--sf-text'],
    [palette.mutedText, '--sf-muted'],
    [palette.primary, '--sf-primary'],
    [palette.secondary, '--sf-secondary'],
  ];
  for (const [hex, name] of roles) {
    if (sanitizeColor(hex, '#000000').toUpperCase() === v) return `var(${name})`;
  }
  return v;
}

interface MediaOptions {
  src: string;
  alt: string;
  aspect: string;
  extraStyle?: string;
  effect?: ImageEffectConfig;
  secondary?: string;
  secondaryAlt?: string;
  hero?: boolean;
}

/** Image simple, ou enveloppe à effets (défilement, 3D, avant / après) lue par le moteur d'effets partagé. */
function mediaHtml(o: MediaOptions): string {
  if (!o.src) return '';
  const cls = `sf-media${o.hero ? ' sf-hero-media' : ''}`;
  const alt = escapeHtml(o.alt);
  const extra = o.extraStyle ? ` ${o.extraStyle}` : '';
  const effect = o.effect ? sanitizeImageEffect(o.effect) : null;
  if (!effect || !hasAnyImageEffect(effect)) {
    return `<img class="${cls}" style="aspect-ratio: ${o.aspect};${extra}" src="${escapeHtml(o.src)}" alt="${alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="window.__sfImageError&amp;&amp;window.__sfImageError(this)" />`;
  }
  const hasAfter = effect.effect3d === 'before-after-slider' && Boolean(o.secondary);
  const fx3d = effect.effect3d === 'before-after-slider' && !hasAfter ? 'none' : effect.effect3d;
  const after = hasAfter
    ? `<img class="sf-media sf-fx-after" src="${escapeHtml(o.secondary as string)}" alt="${escapeHtml(o.secondaryAlt || '')}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="window.__sfImageError&amp;&amp;window.__sfImageError(this)" />`
    : '';
  return `<div class="sf-fx${o.hero ? ' sf-hero-media' : ''}" data-fx-scroll="${effect.scroll}" data-fx-scroll-i="${effect.scrollIntensity}" data-fx-3d="${fx3d}" data-fx-3d-i="${effect.effect3dIntensity}" style="aspect-ratio: ${o.aspect}; --k3: ${(effect.effect3dIntensity / 100).toFixed(2)}; --ks: ${(effect.scrollIntensity / 100).toFixed(2)};${extra}"><div class="sf-fx-3d"><div class="sf-fx-inner"><img class="sf-media" src="${escapeHtml(o.src)}" alt="${alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="window.__sfImageError&amp;&amp;window.__sfImageError(this)" />${after}</div></div></div>`;
}

function getButtonCssVars(theme: SiteTheme): { btnRadius: string; btnShadow: string; borderWidth: string } {
  const btnStyle = theme.buttonStyle ?? 'sharp';
  const borderStyle = theme.borderStyle ?? 'hairline';
  const btnRadius =
    btnStyle === 'pill-clean'
      ? '9999px'
      : btnStyle === 'soft'
        ? '8px'
        : btnStyle === 'editorial' || btnStyle === 'sharp' || btnStyle === 'offset-brutal'
          ? '0px'
          : RADIUS_MAP[theme.borderRadius] ?? '4px';

  const btnShadow = btnStyle === 'offset-brutal' ? '3px 3px 0px currentColor' : 'none';
  const borderWidth = borderStyle === 'strong' ? '1.5px' : '1px';
  return { btnRadius, btnShadow, borderWidth };
}

function alternateThemeCss(theme: SiteTheme): string {
  if (!theme.visitorThemeToggle) return '';
  const toDark = theme.mode !== 'dark';
  const alt = deriveAlternatePalette(theme.palette, toDark);
  const border = toDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(17, 17, 17, 0.14)';
  return `:root[data-theme="${toDark ? 'dark' : 'light'}"] {
  color-scheme: ${toDark ? 'dark' : 'light'};
  --sf-primary: ${alt.primary};
  --sf-on-primary: ${getContrastTextColor(alt.primary)};
  --sf-secondary: ${alt.secondary};
  --sf-bg: ${alt.background};
  --sf-surface: ${alt.surface};
  --sf-text: ${alt.text};
  --sf-muted: ${alt.mutedText};
  --sf-border: ${border};
}`;
}

export function generateSiteCss(project: SiteProject): string {
  const { theme } = project;
  const p = theme.palette;
  const primary = sanitizeColor(p.primary, '#1B4332');
  const secondary = sanitizeColor(p.secondary, '#262626');
  const background = sanitizeColor(p.background, theme.mode === 'dark' ? '#0F1419' : '#F7F6F2');
  const surface = sanitizeColor(p.surface, theme.mode === 'dark' ? '#161E27' : '#ECEBE4');
  const text = sanitizeColor(p.text, theme.mode === 'dark' ? '#F1F5F9' : '#111111');
  const muted = sanitizeColor(p.mutedText, theme.mode === 'dark' ? '#94A3B8' : '#525252');
  const headingFont = sanitizeFontName(theme.fonts.heading, 'Fraunces');
  const bodyFont = sanitizeFontName(theme.fonts.body, 'Libre Franklin');
  const radius = RADIUS_MAP[theme.borderRadius] ?? '4px';
  const sectionPad = SPACING_MAP[theme.spacing] ?? '84px';
  const onPrimary = getContrastTextColor(primary);
  const borderCol = theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.14)' : 'rgba(17, 17, 17, 0.14)';
  const { btnRadius, btnShadow, borderWidth } = getButtonCssVars(theme);

  return `:root {
  --sf-primary: ${primary};
  --sf-on-primary: ${onPrimary};
  --sf-secondary: ${secondary};
  --sf-bg: ${background};
  --sf-surface: ${surface};
  --sf-text: ${text};
  --sf-muted: ${muted};
  --sf-border: ${borderCol};
  --sf-border-width: ${borderWidth};
  --sf-radius: ${radius};
  --sf-btn-radius: ${btnRadius};
  --sf-btn-shadow: ${btnShadow};
  --sf-section-pad: ${sectionPad};
  --sf-font-heading: '${headingFont}', ${genericFallback(headingFont)};
  --sf-font-body: '${bodyFont}', ${genericFallback(bodyFont)};
}
${alternateThemeCss(theme)}
${EFFECTS_CSS}
${theme.customCss ? `:root { ${serializeSafeBlockCss(theme.customCss)} }` : ''}
body.sf-liquid-glass { isolation: isolate; }
 .sf-site-page[hidden] { display: none !important; }
body.sf-liquid-glass::before, body.sf-liquid-glass::after { content:''; position:fixed; z-index:-1; width:min(45vw,36rem); aspect-ratio:1; border-radius:50%; filter:blur(72px); opacity:.25; pointer-events:none; }
body.sf-liquid-glass::before { top:8%; left:3%; background:radial-gradient(circle,#f59e0b,transparent 70%); }
body.sf-liquid-glass::after { top:38%; right:2%; background:radial-gradient(circle,#60a5fa,transparent 70%); }
[data-glass="true"] > section { background-color:transparent !important; }

*, *::before, *::after {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
  scroll-padding-top: 84px;
}

body {
  margin: 0;
  font-family: var(--sf-font-body);
  background-color: var(--sf-bg);
  color: var(--sf-text);
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4 {
  font-family: var(--sf-font-heading);
  margin: 0 0 0.75rem;
  line-height: 1.08;
  letter-spacing: -0.025em;
  text-wrap: balance;
}

p {
  margin: 0 0 1rem;
}

img {
  display: block;
  max-width: 100%;
}

a {
  color: inherit;
}

.sf-demo-banner {
  background-color: #FEF3C7;
  color: #78350F;
  border-bottom: 1px solid #D97706;
  padding: 0.65rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  text-align: center;
}

.sf-container {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.sf-section {
  padding: var(--sf-section-pad) 0;
  border-bottom: 1px solid var(--sf-border);
}

.sf-kicker {
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--sf-primary);
  margin-bottom: 0.75rem;
  display: block;
}

.sf-heading {
  font-size: clamp(1.9rem, 3.4vw, 2.85rem);
  font-weight: 600;
}

.sf-hero-title {
  font-size: clamp(2.5rem, 5vw, 4.25rem);
  font-weight: 600;
  line-height: 1.04;
}

.sf-lead {
  font-size: 1.0625rem;
  color: var(--sf-muted);
  max-width: 58ch;
}

.sf-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.82rem 1.5rem;
  border-radius: var(--sf-btn-radius);
  font-weight: 600;
  font-size: 0.9375rem;
  text-decoration: none;
  border: var(--sf-border-width) solid transparent;
  box-shadow: var(--sf-btn-shadow);
  cursor: pointer;
  transition: transform 0.16s ease, opacity 0.16s ease;
  white-space: nowrap;
}

.sf-btn:hover {
  opacity: 0.92;
  transform: translateY(-1px);
}

.sf-btn-primary {
  background-color: var(--sf-primary);
  color: var(--sf-on-primary);
}

.sf-btn-secondary {
  background-color: transparent;
  color: inherit;
  border-color: currentColor;
}

.sf-navbar {
  position: sticky;
  top: 0;
  z-index: 40;
  background-color: var(--nav-bg, color-mix(in srgb, var(--sf-surface) 96%, transparent));
  border-bottom: var(--sf-border-width) solid var(--nav-border, var(--sf-border));
  -webkit-backdrop-filter: blur(var(--nav-blur, 16px)) saturate(185%);
  backdrop-filter: blur(var(--nav-blur, 16px)) saturate(185%);
  transition: padding .25s ease, transform .3s ease, opacity .25s ease, border-radius .25s ease;
}
.sf-navbar[data-nav-shrink="true"] { transition: min-height .25s ease, transform .3s ease, opacity .25s ease; }
.sf-navbar.sf-nav-floating-pill { width: min(1120px, calc(100% - 32px)); margin: 12px auto; border: 1px solid var(--nav-border); border-radius: var(--nav-radius); box-shadow: 0 10px 32px rgba(0,0,0,.12); }
.sf-navbar.sf-nav-floating-wide { width: calc(100% - 40px); margin: 12px 20px; border: 1px solid var(--nav-border); border-radius: var(--nav-radius); }
.sf-navbar.sf-nav-shrunk .sf-navbar-inner { min-height: 54px; }
.sf-navbar.sf-nav-hidden { transform: translateY(-120%); }
.sf-navbar.sf-nav-active-pill .sf-nav-link[aria-current="page"] { background: color-mix(in srgb, var(--sf-primary) 14%, transparent); border-radius: 999px; padding: .45rem .8rem; }
.sf-navbar.sf-nav-active-underline .sf-nav-link[aria-current="page"] { text-decoration: underline; text-decoration-color: var(--sf-primary); text-underline-offset: 6px; }
.sf-navbar.sf-nav-active-glow .sf-nav-link[aria-current="page"] { color: var(--sf-text); text-shadow: 0 0 14px color-mix(in srgb, var(--sf-primary) 50%, transparent); }
.sf-nav-backdrop { position: fixed; inset: 0; z-index: 38; background: rgba(15,23,42,.32); backdrop-filter: blur(5px); opacity: 0; visibility: hidden; transition: opacity .25s ease, visibility .25s ease; }
.sf-nav-backdrop.is-open { opacity: 1; visibility: visible; }

.sf-navbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  min-height: 70px;
}

.sf-brand {
  font-family: var(--sf-font-heading);
  font-weight: 700;
  font-size: 1.2rem;
  text-decoration: none;
  white-space: nowrap;
}

.sf-nav-links {
  display: flex;
  align-items: center;
  gap: 1.75rem;
}

.sf-nav-link {
  font-size: 0.9rem;
  font-weight: 500;
  text-decoration: none;
  color: var(--sf-muted);
  white-space: nowrap;
}

.sf-nav-link:hover {
  color: var(--sf-text);
}

.sf-nav-panel {
  display: flex;
  align-items: center;
  gap: 1.75rem;
}

.sf-nav-cta-mobile {
  display: none;
}

.sf-nav-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: var(--sf-border-width) solid var(--sf-border);
  border-radius: var(--sf-btn-radius);
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.sf-burger,
.sf-burger::before,
.sf-burger::after {
  display: block;
  width: 20px;
  height: 2px;
  background: currentColor;
  content: '';
  transition: transform 0.2s ease, background-color 0.2s ease;
}

.sf-burger {
  position: relative;
}

.sf-burger::before {
  position: absolute;
  top: -6px;
}

.sf-burger::after {
  position: absolute;
  top: 6px;
}

.sf-nav-toggle[aria-expanded="true"] .sf-burger {
  background-color: transparent;
}

.sf-nav-toggle[aria-expanded="true"] .sf-burger::before {
  top: 0;
  transform: rotate(45deg);
}

.sf-nav-toggle[aria-expanded="true"] .sf-burger::after {
  top: 0;
  transform: rotate(-45deg);
}

.sf-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

a:focus-visible,
button:focus-visible,
.sf-input:focus-visible,
.sf-textarea:focus-visible {
  outline: 2px solid var(--sf-primary);
  outline-offset: 2px;
}

.sf-grid-asym {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 3rem;
  align-items: center;
}

.sf-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2.5rem;
  align-items: start;
}

.sf-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.75rem;
}

.sf-grid-4 {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1.25rem;
}

.sf-card {
  border: var(--sf-border-width) solid var(--sf-border);
  border-radius: var(--sf-radius);
  padding: 1.75rem;
}

.sf-card-highlight {
  border-color: var(--sf-primary);
}

.sf-media {
  width: 100%;
  border-radius: var(--sf-radius);
  object-fit: cover;
}

.sf-price {
  font-family: var(--sf-font-heading);
  font-size: 2rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  margin: 0.65rem 0;
}

.sf-stat-value {
  font-family: var(--sf-font-heading);
  font-size: clamp(2rem, 3.2vw, 2.75rem);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--sf-primary);
}

.sf-list-clean {
  list-style: none;
  padding: 0;
  margin: 1rem 0 1.5rem;
  display: grid;
  gap: 0.5rem;
}

.sf-faq-item {
  border-bottom: 1px solid var(--sf-border);
  padding: 1.1rem 0;
}

.sf-faq-btn {
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  color: inherit;
  font-family: var(--sf-font-heading);
  font-size: 1.125rem;
  font-weight: 600;
  padding: 0.25rem 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
}

.sf-form {
  display: grid;
  gap: 1rem;
}

.sf-field-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.375rem;
}

.sf-input, .sf-textarea {
  width: 100%;
  padding: 0.75rem 0.9rem;
  border-radius: var(--sf-radius);
  border: var(--sf-border-width) solid var(--sf-border);
  background-color: var(--sf-bg);
  color: var(--sf-text);
  font: inherit;
}

.sf-field-note {
  font-weight: 400;
  color: var(--sf-muted);
}

select.sf-input {
  appearance: auto;
}

.sf-check {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  font-size: 0.85rem;
  color: var(--sf-muted);
}

.sf-check input {
  margin-top: 0.25rem;
  accent-color: var(--sf-primary);
}

.sf-hp {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.sf-form-note {
  margin: 0;
  padding: 0.65rem 0.85rem;
  font-size: 0.85rem;
  border: 1px dashed var(--sf-border);
  border-radius: var(--sf-radius);
  color: var(--sf-muted);
}

.sf-form-status {
  margin: 0;
  padding: 0.75rem 0.9rem;
  font-size: 0.9rem;
  white-space: pre-line;
  border-left: 3px solid var(--sf-primary);
  background-color: var(--sf-bg);
}

.sf-form-status[data-kind="error"] {
  border-left-color: #B42318;
}

.sf-contact-lines a {
  text-underline-offset: 3px;
}

.sf-social {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.sf-footer {
  border-top: var(--sf-border-width) solid var(--sf-border);
  background-color: var(--sf-surface);
  padding: 3.5rem 0;
}

@media (max-width: 900px) {
  .sf-grid-3, .sf-grid-4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .sf-grid-2, .sf-grid-asym {
    grid-template-columns: 1fr;
  }
  .sf-navbar-inner {
    position: relative;
  }
  .sf-nav-toggle {
    display: inline-flex;
  }
  .sf-nav-cta {
    display: none;
  }
  .sf-nav-panel {
    display: flex;
    position: fixed;
    top: 76px;
    left: 12px;
    right: 12px;
    z-index: 39;
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
    padding: 1rem 1.5rem 1.5rem;
    background-color: var(--sf-nav-bg, var(--sf-surface));
    border-bottom: var(--sf-border-width) solid var(--sf-border);
    border-radius: var(--nav-radius, 24px);
    box-shadow: 0 24px 64px rgba(0,0,0,.18);
    backdrop-filter: blur(max(18px, var(--nav-blur,16px))) saturate(185%);
    opacity: 0;
    visibility: hidden;
    transform: translateY(-8px);
    transition: opacity .22s ease, transform .22s ease, visibility .22s ease;
    pointer-events: none;
  }
  .sf-nav-panel.is-open {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
    pointer-events: auto;
  }
  .sf-nav-links {
    flex-direction: column;
    align-items: stretch;
    gap: 0;
  }
  .sf-nav-links .sf-nav-link {
    padding: 0.8rem 0;
    font-size: 1.05rem;
    border-bottom: 1px solid var(--sf-border);
  }
  .sf-nav-cta-mobile {
    display: block;
  }
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  *, *::before, *::after {
    transition: none !important;
  }
}

@media (max-width: 600px) {
  .sf-grid-3, .sf-grid-4 {
    grid-template-columns: 1fr;
  }
}
`;
}

function renderBlockToHtml(
  block: SiteBlock,
  index: number,
  project: SiteProject,
  anchors: AnchorMap,
  rewriteAssetSrc: (src?: string) => string,
): string {
  if (!block.visible) return '';
  const theme: SiteTheme = project.theme;
  const ctx: RenderCtx = { project, anchors, rewriteAssetSrc };
  const c = block.content;
  const items = Array.isArray(c.items) ? c.items : [];
  const colors = computeBlockSurfaceColors(block, index, theme);
  const bgRef = escapeHtml(cssColorRef(colors.bg, theme.palette, theme.palette.background));
  const textRef = escapeHtml(cssColorRef(colors.text, theme.palette, theme.palette.text));
  const animType = block.type === 'navbar' ? 'none' : sanitizeSectionAnimation(block.animation);
  const animAttr = animType !== 'none' ? ` data-anim="${animType}"` : '';
  const storyAttr =
    theme.layoutMode === 'scroll-story' && block.type !== 'navbar' && block.type !== 'footer' ? ' data-story' : '';
  const override = block.styleOverride;
  const glassAttrs = theme.liquidGlass || override?.glassMode ? ' data-glass="true"' : '';
  const customStyle = serializeSafeBlockCss(override?.customCss);
  const sectionStyle = `${animAttr}${storyAttr}${glassAttrs} style="--sf-anim-ms: ${clampDuration(block.animationDurationMs)}ms; background-color: ${bgRef}; color: ${textRef}; --glass-opacity:${Math.max(0, Math.min(100, override?.opacity ?? 22)) / 100}; --glass-blur:${Math.max(0, Math.min(32, override?.blurPx ?? 24))}px; --glass-border-opacity:.38;${override?.backgroundGradient && /^linear-gradient\\([\\w\\s,#.%()-]+\\)$/i.test(override.backgroundGradient) ? `background:${escapeHtml(override.backgroundGradient)};` : ''}${override?.paddingY !== undefined ? `padding-block:${Math.max(0, Math.min(160, override.paddingY))}px;` : ''}${override?.borderRadius !== undefined ? `border-radius:${Math.max(0, Math.min(999, override.borderRadius))}px;` : ''}${override?.shadowDepth !== undefined ? `box-shadow:0 ${Math.max(0, Math.min(48, override.shadowDepth))}px ${Math.max(0, Math.min(96, override.shadowDepth * 2))}px rgba(15,23,42,.18);` : ''}${customStyle ? `${customStyle};` : ''}"`;
  const cardBgStyle = `background-color: ${escapeHtml(cssColorRef(colors.cardBg, theme.palette, theme.palette.surface))};`;
  const anchorId = anchors.byBlockId.get(block.id) ?? block.id;

  switch (block.type) {
    case 'navbar': {
      const minimal = block.variant === 'minimal';
      const linksHtml = minimal
        ? ''
        : items
            .map((item) => linkHtml(ctx, item.title, item.linkHref, 'sf-nav-link', { fallback: false }))
            .filter(Boolean)
            .join('');
      const cta = linkHtml(ctx, c.ctaLabel, c.ctaHref, 'sf-btn sf-btn-primary');
      const hasMenu = Boolean(linksHtml);
      const navBg = escapeHtml(cssColorRef(colors.bg, theme.palette, theme.palette.surface));
      const navText = escapeHtml(cssColorRef(colors.text, theme.palette, theme.palette.text));
      const nav = getSiteSettings(project).navbar;
      const variantClass = nav?.variant === 'floating-pill' ? 'sf-nav-floating-pill' : nav?.variant === 'floating-wide' ? 'sf-nav-floating-wide' : '';
      const indicatorClass = `sf-nav-active-${nav?.activeIndicator ?? 'underline'}`;
      const opacity = nav?.opacity ?? 96;
      const navStyle = `background-color: color-mix(in srgb, ${navBg} ${opacity}%, transparent); color: ${navText}; --sf-nav-bg: color-mix(in srgb, ${navBg} ${opacity}%, transparent); --nav-bg: color-mix(in srgb, ${navBg} ${opacity}%, transparent); --nav-blur: ${nav?.blurPx ?? 16}px; --nav-radius: ${nav?.borderRadiusPx ?? 24}px; --nav-border: color-mix(in srgb, ${navText} ${nav?.borderOpacity ?? 20}%, transparent);`;
      const currentPage = project.pages?.find((page) => page.id === project.activePageId);
      const navPanelId = `sf-nav-panel-${escapeHtml(currentPage?.slug || 'home')}`;
      return `<header class="sf-navbar ${variantClass} ${indicatorClass}" data-nav-shrink="${nav?.shrinkOnScroll !== false}" data-nav-autohide="${nav?.autoHideOnScrollDown === true}" style="${navStyle}">
  <div class="sf-container sf-navbar-inner">
    <a class="sf-brand" href="#top">${escapeHtml(c.brandName || 'Mon Site')}</a>
    ${
      hasMenu
        ? `<nav class="sf-nav-panel" id="${navPanelId}" aria-label="Navigation principale">
      <div class="sf-nav-links">${linksHtml}</div>
      ${cta ? `<div class="sf-nav-cta-mobile">${cta}</div>` : ''}
    </nav>`
        : ''
    }
    ${cta ? `<div class="sf-nav-cta">${cta}</div>` : ''}
    ${
      hasMenu
        ? `<button type="button" class="sf-nav-toggle" aria-expanded="false" aria-controls="${navPanelId}" data-nav-toggle><span class="sf-sr-only">Ouvrir ou fermer le menu</span><span class="sf-burger" aria-hidden="true"></span></button>`
        : ''
    }
  </div>
</header>`;
    }

    case 'hero': {
      const imgSrc = rewriteAssetSrc(c.image);
      const primaryBtn = linkHtml(ctx, c.ctaLabel, c.ctaHref, 'sf-btn sf-btn-primary');
      const secondaryBtn = linkHtml(ctx, c.secondaryCtaLabel, c.secondaryCtaHref, 'sf-btn sf-btn-secondary');

      if (block.variant === 'centered') {
        return `<section id="${anchorId}" class="sf-section"${sectionStyle}>
  <div class="sf-container" style="text-align: center;">
    ${c.kicker ? `<span class="sf-kicker">${escapeHtml(c.kicker)}</span>` : ''}
    <h1 class="sf-hero-title" style="max-width: 18ch; margin-inline: auto;">${escapeHtml(c.heading)}</h1>
    ${c.subheading ? `<p class="sf-lead" style="margin: 1rem auto 1.75rem;">${escapeHtml(c.subheading)}</p>` : ''}
    <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 0.75rem; margin-bottom: 2.5rem;">
      ${primaryBtn}${secondaryBtn}
    </div>
    ${imgSrc ? `${mediaHtml({ src: imgSrc, alt: c.imageAlt || c.heading || '', aspect: '16 / 9', effect: c.imageEffect, secondary: rewriteAssetSrc(c.secondaryImage), secondaryAlt: c.secondaryImageAlt, hero: block.type === 'hero' })}` : ''}
  </div>
</section>`;
      }

      if (block.variant === 'editorial') {
        return `<section id="${anchorId}" class="sf-section"${sectionStyle}>
  <div class="sf-container">
    ${c.kicker ? `<span class="sf-kicker">${escapeHtml(c.kicker)}</span>` : ''}
    <h1 class="sf-hero-title" style="max-width: 17ch;">${escapeHtml(c.heading)}</h1>
    <div class="sf-grid-asym" style="margin-top: 1.5rem; margin-bottom: 2.5rem;">
      ${c.subheading ? `<p class="sf-lead" style="margin: 0;">${escapeHtml(c.subheading)}</p>` : '<div></div>'}
      <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: flex-start;">
        ${primaryBtn}${secondaryBtn}
      </div>
    </div>
    ${imgSrc ? `${mediaHtml({ src: imgSrc, alt: c.imageAlt || c.heading || '', aspect: '21 / 9', effect: c.imageEffect, secondary: rewriteAssetSrc(c.secondaryImage), secondaryAlt: c.secondaryImageAlt, hero: block.type === 'hero' })}` : ''}
  </div>
</section>`;
      }

      return `<section id="${anchorId}" class="sf-section"${sectionStyle}>
  <div class="sf-container sf-grid-asym">
    <div>
      ${c.kicker ? `<span class="sf-kicker">${escapeHtml(c.kicker)}</span>` : ''}
      <h1 class="sf-hero-title">${escapeHtml(c.heading)}</h1>
      ${c.subheading ? `<p class="sf-lead">${escapeHtml(c.subheading)}</p>` : ''}
      <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.75rem;">
        ${primaryBtn}${secondaryBtn}
      </div>
    </div>
    <div>
      ${imgSrc ? `${mediaHtml({ src: imgSrc, alt: c.imageAlt || c.heading || '', aspect: '4 / 3', effect: c.imageEffect, secondary: rewriteAssetSrc(c.secondaryImage), secondaryAlt: c.secondaryImageAlt, hero: block.type === 'hero' })}` : ''}
    </div>
  </div>
</section>`;
    }

    case 'about': {
      const imgSrc = rewriteAssetSrc(c.image);
      const textCol = `<div>
      ${c.kicker ? `<span class="sf-kicker">${escapeHtml(c.kicker)}</span>` : ''}
      <h2 class="sf-heading">${escapeHtml(c.heading)}</h2>
      ${c.body ? `<p class="sf-lead">${escapeHtml(c.body)}</p>` : ''}
      ${linkHtml(ctx, c.ctaLabel, c.ctaHref, 'sf-btn sf-btn-secondary', { style: 'margin-top: 1rem;' })}
    </div>`;
      const imgCol = imgSrc
        ? `<div>${mediaHtml({ src: imgSrc, alt: c.imageAlt || c.heading || '', aspect: '4 / 3', effect: c.imageEffect, secondary: rewriteAssetSrc(c.secondaryImage), secondaryAlt: c.secondaryImageAlt, hero: false })}</div>`
        : '';
      return `<section id="${anchorId}" class="sf-section"${sectionStyle}>
  <div class="sf-container sf-grid-asym">
    ${block.variant === 'media-left' ? `${imgCol}${textCol}` : `${textCol}${imgCol}`}
  </div>
</section>`;
    }

    case 'services': {
      const body =
        block.variant === 'numbered-list'
          ? `<div style="display: grid; gap: 0; margin-top: 2rem; border-top: 1px solid var(--sf-border);">
      ${items
        .map(
          (item, i) => `<article style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 1rem; align-items: baseline; padding: 1.5rem 0; border-bottom: 1px solid var(--sf-border);">
        <div style="max-width: 58ch;">
          <span class="sf-kicker" style="margin-bottom: 0.25rem;">0${i + 1}.</span>
          <h3 style="font-size: 1.25rem;">${escapeHtml(item.title)}</h3>
          <p style="color: var(--sf-muted); margin: 0;">${escapeHtml(item.description)}</p>
        </div>
        ${item.meta ? `<span style="font-size: 0.875rem; color: var(--sf-muted);">${escapeHtml(item.meta)}</span>` : ''}
      </article>`,
        )
        .join('')}
    </div>`
          : `<div class="sf-grid-3" style="margin-top: 2rem;">
      ${items
        .map(
          (item) => `<article class="sf-card" style="${cardBgStyle}">
        ${item.meta ? `<span class="sf-kicker">${escapeHtml(item.meta)}</span>` : ''}
        <h3 style="font-size: 1.2rem;">${escapeHtml(item.title)}</h3>
        <p style="color: var(--sf-muted); margin: 0;">${escapeHtml(item.description)}</p>
      </article>`,
        )
        .join('')}
    </div>`;
      return `<section id="${anchorId}" class="sf-section"${sectionStyle}>
  <div class="sf-container">
    ${c.kicker ? `<span class="sf-kicker">${escapeHtml(c.kicker)}</span>` : ''}
    <h2 class="sf-heading">${escapeHtml(c.heading)}</h2>
    ${c.subheading ? `<p class="sf-lead">${escapeHtml(c.subheading)}</p>` : ''}
    ${body}
  </div>
</section>`;
    }

    case 'gallery': {
      const gridClass = block.variant === 'showcase-2' ? 'sf-grid-2' : 'sf-grid-3';
      return `<section id="${anchorId}" class="sf-section"${sectionStyle}>
  <div class="sf-container">
    ${c.kicker ? `<span class="sf-kicker">${escapeHtml(c.kicker)}</span>` : ''}
    <h2 class="sf-heading">${escapeHtml(c.heading)}</h2>
    ${c.subheading ? `<p class="sf-lead">${escapeHtml(c.subheading)}</p>` : ''}
    <div class="${gridClass}" style="margin-top: 2rem;">
      ${items
        .map((item) => {
          const src = rewriteAssetSrc(item.image);
          return `<figure style="margin: 0;">
        ${src ? `${mediaHtml({ src, alt: item.imageAlt || item.title, aspect: '4 / 3', effect: item.imageEffect })}` : ''}
        <figcaption style="margin-top: 0.75rem;">
          <strong style="display: block;">${escapeHtml(item.title)}</strong>
          ${item.subtitle ? `<span style="font-size: 0.875rem; color: var(--sf-muted);">${escapeHtml(item.subtitle)}</span>` : ''}
        </figcaption>
      </figure>`;
        })
        .join('')}
    </div>
  </div>
</section>`;
    }

    case 'products': {
      const gridClass = block.variant === 'compact-grid' ? 'sf-grid-2' : block.variant === 'featured-list' ? '' : 'sf-grid-3';
      return `<section id="${anchorId}" class="sf-section"${sectionStyle}>
  <div class="sf-container">
    ${c.kicker ? `<span class="sf-kicker">${escapeHtml(c.kicker)}</span>` : ''}
    <h2 class="sf-heading">${escapeHtml(c.heading)}</h2>
    ${c.subheading ? `<p class="sf-lead">${escapeHtml(c.subheading)}</p>` : ''}
    <div class="${gridClass}" style="margin-top: 2rem; display: grid; gap: 1.5rem;">
      ${items
        .map((item) => {
          const src = rewriteAssetSrc(item.image);
          return `<article class="sf-card" style="${cardBgStyle} display: flex; flex-direction: column; justify-content: space-between; gap: 1rem;">
        <div>
          ${src ? `${mediaHtml({ src, alt: item.imageAlt || item.title, aspect: '4 / 3', extraStyle: 'margin-bottom: 1rem;', effect: item.imageEffect })}` : ''}
          <div style="display: flex; justify-content: space-between; gap: 1rem; align-items: baseline;">
            <h3 style="font-size: 1.15rem; margin: 0;">${escapeHtml(item.title)}</h3>
            ${item.price ? `<strong style="font-variant-numeric: tabular-nums;">${escapeHtml(item.price)}</strong>` : ''}
          </div>
          <p style="color: var(--sf-muted); margin: 0.5rem 0 0;">${escapeHtml(item.description)}</p>
        </div>
        ${linkHtml(ctx, item.linkLabel, item.linkHref, 'sf-btn sf-btn-secondary', { prefill: item.title })}
      </article>`;
        })
        .join('')}
    </div>
  </div>
</section>`;
    }

    case 'pricing': {
      const gridClass = block.variant === 'two-columns' ? 'sf-grid-2' : 'sf-grid-3';
      return `<section id="${anchorId}" class="sf-section"${sectionStyle}>
  <div class="sf-container">
    ${c.kicker ? `<span class="sf-kicker">${escapeHtml(c.kicker)}</span>` : ''}
    <h2 class="sf-heading">${escapeHtml(c.heading)}</h2>
    ${c.subheading ? `<p class="sf-lead">${escapeHtml(c.subheading)}</p>` : ''}
    <div class="${gridClass}" style="margin-top: 2rem; align-items: stretch;">
      ${items
        .map(
          (item) => `<article class="sf-card ${item.highlighted ? 'sf-card-highlight' : ''}" style="${cardBgStyle} display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h3 style="font-size: 1.25rem;">${escapeHtml(item.title)}</h3>
          ${item.meta ? `<span style="font-size: 0.875rem; color: var(--sf-muted);">${escapeHtml(item.meta)}</span>` : ''}
          <div class="sf-price">${escapeHtml(item.price)}</div>
          <p style="color: var(--sf-muted);">${escapeHtml(item.description)}</p>
          ${
            Array.isArray(item.features)
              ? `<ul class="sf-list-clean">${item.features.map((f) => `<li>— ${escapeHtml(f)}</li>`).join('')}</ul>`
              : ''
          }
        </div>
        ${linkHtml(ctx, item.linkLabel, item.linkHref, `sf-btn ${item.highlighted ? 'sf-btn-primary' : 'sf-btn-secondary'}`, { prefill: item.title })}
      </article>`,
        )
        .join('')}
    </div>
  </div>
</section>`;
    }

    case 'testimonials': {
      const gridClass = block.variant === 'two-column-quotes' ? 'sf-grid-2' : block.variant === 'spotlight' ? '' : 'sf-grid-3';
      return `<section id="${anchorId}" class="sf-section"${sectionStyle}>
  <div class="sf-container">
    ${c.kicker ? `<span class="sf-kicker">${escapeHtml(c.kicker)}</span>` : ''}
    <h2 class="sf-heading">${escapeHtml(c.heading)}</h2>
    <div class="${gridClass}" style="margin-top: 2rem;">
      ${(block.variant === 'spotlight' ? items.slice(0, 1) : items)
        .map(
          (item) => `<blockquote class="sf-card" style="${cardBgStyle} margin: 0;">
        <p style="font-size: 1.06rem; margin-bottom: 1rem;">${escapeHtml(item.description)}</p>
        <footer>
          <strong>${escapeHtml(item.title)}</strong>
          ${item.subtitle ? `<div style="font-size: 0.875rem; color: var(--sf-muted);">${escapeHtml(item.subtitle)}</div>` : ''}
        </footer>
      </blockquote>`,
        )
        .join('')}
    </div>
  </div>
</section>`;
    }

    case 'faq': {
      return `<section id="${anchorId}" class="sf-section"${sectionStyle}>
  <div class="sf-container">
    ${c.kicker ? `<span class="sf-kicker">${escapeHtml(c.kicker)}</span>` : ''}
    <h2 class="sf-heading">${escapeHtml(c.heading)}</h2>
    <div class="${block.variant === 'two-columns' ? 'sf-grid-2' : ''}" style="margin-top: 2rem;">
      ${items
        .map(
          (item, i) => `<div class="sf-faq-item">
        <button type="button" class="sf-faq-btn" aria-expanded="${i === 0 ? 'true' : 'false'}" data-faq-toggle>
          <span>${escapeHtml(item.title)}</span>
          <span aria-hidden="true">${i === 0 ? '−' : '+'}</span>
        </button>
        <div class="sf-faq-answer" style="${i === 0 || block.variant === 'two-columns' ? '' : 'display: none;'} color: var(--sf-muted); padding-top: 0.5rem;">
          ${escapeHtml(item.description)}
        </div>
      </div>`,
        )
        .join('')}
    </div>
  </div>
</section>`;
    }

    case 'stats': {
      const gridClass = items.length >= 4 && block.variant === 'bar-4' ? 'sf-grid-4' : 'sf-grid-3';
      return `<section id="${anchorId}" class="sf-section"${sectionStyle}>
  <div class="sf-container">
    ${c.kicker ? `<span class="sf-kicker">${escapeHtml(c.kicker)}</span>` : ''}
    ${c.heading ? `<h2 class="sf-heading">${escapeHtml(c.heading)}</h2>` : ''}
    <div class="${gridClass}" style="margin-top: 1.75rem;">
      ${items
        .map(
          (item) => `<div class="sf-card" style="${cardBgStyle}">
        <div class="sf-stat-value">${escapeHtml(item.title)}</div>
        <div style="font-weight: 600; margin-top: 0.25rem;">${escapeHtml(item.subtitle)}</div>
        ${item.meta ? `<div style="font-size: 0.85rem; color: var(--sf-muted);">${escapeHtml(item.meta)}</div>` : ''}
      </div>`,
        )
        .join('')}
    </div>
  </div>
</section>`;
    }

    case 'team': {
      const gridClass = block.variant === 'list-2' ? 'sf-grid-2' : 'sf-grid-3';
      return `<section id="${anchorId}" class="sf-section"${sectionStyle}>
  <div class="sf-container">
    ${c.kicker ? `<span class="sf-kicker">${escapeHtml(c.kicker)}</span>` : ''}
    <h2 class="sf-heading">${escapeHtml(c.heading)}</h2>
    <div class="${gridClass}" style="margin-top: 2rem;">
      ${items
        .map((item) => {
          const src = rewriteAssetSrc(item.image);
          return `<article class="sf-card" style="${cardBgStyle}">
        ${src ? `${mediaHtml({ src, alt: item.imageAlt || item.title, aspect: '1 / 1', extraStyle: 'margin-bottom: 1rem;', effect: item.imageEffect })}` : ''}
        <h3 style="font-size: 1.15rem; margin-bottom: 0.2rem;">${escapeHtml(item.title)}</h3>
        ${item.subtitle ? `<div style="font-size: 0.875rem; color: var(--sf-primary); font-weight: 600; margin-bottom: 0.5rem;">${escapeHtml(item.subtitle)}</div>` : ''}
        <p style="color: var(--sf-muted); margin: 0;">${escapeHtml(item.description)}</p>
      </article>`;
        })
        .join('')}
    </div>
  </div>
</section>`;
    }

    case 'logos': {
      return `<section id="${anchorId}" class="sf-section"${sectionStyle}>
  <div class="sf-container">
    ${c.kicker ? `<span class="sf-kicker">${escapeHtml(c.kicker)}</span>` : ''}
    <h2 class="sf-heading">${escapeHtml(c.heading)}</h2>
    ${c.subheading ? `<p class="sf-lead">${escapeHtml(c.subheading)}</p>` : ''}
    <div class="sf-grid-3" style="margin-top: 2rem;">
      ${items
        .map(
          (item) => `<div class="sf-card" style="${cardBgStyle}">
        <strong style="font-family: var(--sf-font-heading); font-size: 1.125rem; display: block;">${escapeHtml(item.title)}</strong>
        ${item.subtitle ? `<span style="font-size: 0.875rem; color: var(--sf-muted);">${escapeHtml(item.subtitle)}</span>` : ''}
      </div>`,
        )
        .join('')}
    </div>
  </div>
</section>`;
    }

    case 'cta': {
      return `<section id="${anchorId}" class="sf-section"${sectionStyle}>
  <div class="sf-container" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 2rem;">
    <div style="max-width: 54ch;">
      ${c.kicker ? `<span class="sf-kicker">${escapeHtml(c.kicker)}</span>` : ''}
      <h2 class="sf-heading">${escapeHtml(c.heading)}</h2>
      ${c.subheading ? `<p style="opacity: 0.85; margin: 0;">${escapeHtml(c.subheading)}</p>` : ''}
    </div>
    ${(() => {
      const btn = linkHtml(ctx, c.ctaLabel, c.ctaHref, 'sf-btn sf-btn-primary');
      return btn ? `<div>${btn}</div>` : '';
    })()}
  </div>
</section>`;
    }

    case 'contact': {
      const email = cleanEmail(c.email);
      const tel = toTelHref(c.phone);
      const address = isEmptyOrTodo(c.address) ? '' : (c.address ?? '').trim();
      const whatsappUrl = buildWhatsappUrl(
        getSiteSettings(project).whatsappNumber ?? '',
        `Bonjour, je vous écris depuis le site ${project.name}.`,
      );
      const infoLines = [
        email ? `<div><strong>E-mail :</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></div>` : '',
        tel ? `<div><strong>Téléphone :</strong> <a href="${escapeHtml(tel)}">${escapeHtml(c.phone)}</a></div>` : '',
        address
          ? `<div><strong>Adresse :</strong> <a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(address)}" target="_blank" rel="noopener noreferrer">${escapeHtml(address)}</a></div>`
          : '',
      ]
        .filter(Boolean)
        .join('\n        ');
      const whatsappButton = whatsappUrl
        ? `<a class="sf-btn sf-btn-secondary" style="margin-top: 1.25rem;" href="${escapeHtml(whatsappUrl)}" target="_blank" rel="noopener noreferrer">Écrire sur WhatsApp</a>`
        : '';
      return `<section id="${anchorId}" class="sf-section"${sectionStyle}>
  <div class="sf-container ${block.variant === 'centered-form' ? '' : 'sf-grid-asym'}">
    <div>
      ${c.kicker ? `<span class="sf-kicker">${escapeHtml(c.kicker)}</span>` : ''}
      <h2 class="sf-heading">${escapeHtml(c.heading)}</h2>
      ${c.subheading ? `<p class="sf-lead">${escapeHtml(c.subheading)}</p>` : ''}
      ${infoLines ? `<div class="sf-contact-lines" style="margin-top: 1.5rem; display: grid; gap: 0.5rem; color: var(--sf-muted);">\n        ${infoLines}\n      </div>` : ''}
      ${whatsappButton}
    </div>
    ${renderFormHtml(block, project, cardBgStyle)}
  </div>
</section>`;
    }

    case 'footer': {
      const linksHtml = items
        .map((item) => linkHtml(ctx, item.title, item.linkHref, 'sf-nav-link', { fallback: false }))
        .filter(Boolean)
        .join('');
      const social = parseSocialLinks(project.projectInput?.realFacts?.socialLinks);
      const socialHtml = social.length
        ? `<nav class="sf-social" aria-label="Réseaux sociaux">${social
            .map(
              (l) =>
                `<a class="sf-nav-link" href="${escapeHtml(l.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}</a>`,
            )
            .join('')}</nav>`
        : '';
      return `<footer class="sf-footer"${sectionStyle}>
  <div class="sf-container" style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 1.5rem; align-items: center;">
    <div>
      <strong class="sf-brand">${escapeHtml(c.brandName || 'Mon Site')}</strong>
      ${c.subheading ? `<p style="color: var(--sf-muted); font-size: 0.9rem; margin: 0.35rem 0 0;">${escapeHtml(c.subheading)}</p>` : ''}
    </div>
    ${linksHtml ? `<nav style="display: flex; flex-wrap: wrap; gap: 1.25rem;" aria-label="Pied de page">${linksHtml}</nav>` : ''}
    ${socialHtml}
    <div style="width: 100%; border-top: 1px solid var(--sf-border); padding-top: 1rem; font-size: 0.85rem; color: var(--sf-muted);">
      ${escapeHtml(c.copyright || '')}
    </div>
  </div>
</footer>`;
    }
  }
}

const PAGE_SCRIPT = `(function () {
  Array.prototype.forEach.call(document.querySelectorAll('[data-faq-toggle]'), function (btn) {
    btn.addEventListener('click', function () {
      var expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      var answer = btn.nextElementSibling;
      if (answer) answer.style.display = expanded ? 'none' : 'block';
      var sign = btn.querySelector('span[aria-hidden="true"]');
      if (sign) sign.textContent = expanded ? '+' : '−';
    });
  });

  document.querySelectorAll('.sf-navbar').forEach(function (navbar) {
    var toggle = navbar.querySelector('[data-nav-toggle]');
    var panel = navbar.querySelector('.sf-nav-panel');
    if (!toggle || !panel) return;
    var backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'sf-nav-backdrop';
    backdrop.setAttribute('aria-label', 'Fermer le menu');
    document.body.appendChild(backdrop);
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) panel.classList.add('is-open');
      else panel.classList.remove('is-open');
      if (open) backdrop.classList.add('is-open');
      else backdrop.classList.remove('is-open');
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    backdrop.addEventListener('click', function () { setOpen(false); });
    panel.addEventListener('click', function (event) {
      var target = event.target;
      var link = target && target.closest && target.closest('a');
      if (!link) return;
      setOpen(false);
      var href = link.getAttribute('href') || '';
      if (href.charAt(0) === '#' && href.length > 1) {
        var destination = document.getElementById(decodeURIComponent(href.slice(1)));
        if (destination) {
          event.preventDefault();
          destination.scrollIntoView({ behavior: 'smooth', block: 'start' });
          panel.querySelectorAll('a').forEach(function (item) { item.removeAttribute('aria-current'); });
          link.setAttribute('aria-current', 'page');
        }
      }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setOpen(false);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) setOpen(false);
    });
  });

  document.addEventListener('click', function (event) {
    var target = event.target;
    var link = target && target.closest && target.closest('a[href^="#page-"]');
    if (!link) return;
    var slug = link.getAttribute('href').slice(6);
    var page = document.querySelector('[data-site-page="' + CSS.escape(slug) + '"]');
    if (!page) return;
    event.preventDefault();
    document.querySelectorAll('[data-site-page]').forEach(function (item) { item.hidden = item !== page; });
    document.querySelectorAll('.sf-nav-panel').forEach(function (panel) { panel.classList.remove('is-open'); });
    document.querySelectorAll('[data-nav-toggle]').forEach(function (button) { button.setAttribute('aria-expanded', 'false'); });
    document.querySelectorAll('.sf-nav-backdrop').forEach(function (backdrop) { backdrop.classList.remove('is-open'); });
    page.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  var navbar = document.querySelector('.sf-navbar');
  if (navbar) {
    var previousY = window.scrollY;
    var queued = false;
    window.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () {
        var y = window.scrollY;
        navbar.classList.toggle('sf-nav-shrunk', navbar.getAttribute('data-nav-shrink') === 'true' && y > 40);
        navbar.classList.toggle('sf-nav-hidden', navbar.getAttribute('data-nav-autohide') === 'true' && y > previousY && y > 100);
        if (y < previousY) navbar.classList.remove('sf-nav-hidden');
        previousY = y;
        queued = false;
      });
    }, { passive: true });
  }
})();`;

export interface PageOptions {
  /** Aperçu de l'éditeur : les formulaires n'envoient rien, ils montrent ce qui serait transmis. */
  dryRun?: boolean;
}

function buildInlineScripts(options: PageOptions): string {
  const dry = options.dryRun ? 'window.__SF_DRY_RUN__ = true;\n' : '';
  return `<script>\n${dry}${EFFECTS_RUNTIME_JS}\nwindow.__sfFx(document, {});\n${PAGE_SCRIPT}\n${FORM_RUNTIME_SCRIPT}\n</script>`;
}

export interface RenderedBody {
  header: string;
  main: string;
  footer: string;
  layout: SiteLayoutMode;
}

/**
 * Assemble les sections selon l'architecture choisie :
 * vertical, diapositives horizontales, grille bento, écran partagé ou récit au défilement.
 * La navigation et le pied de page restent hors de la zone principale (sauf diapositives : le pied devient la dernière).
 */
function renderBody(
  project: SiteProject,
  anchors: AnchorMap,
  rewriteAssetSrc: (src?: string) => string,
): RenderedBody {
  const layout = sanitizeLayoutMode(project.theme.layoutMode);
  const headerStyle = sanitizeHeaderStyle(project.theme.headerStyle);
  const rendered = project.blocks
    .map((block, i) => ({ block, html: renderBlockToHtml(block, i, project, anchors, rewriteAssetSrc) }))
    .filter((r) => r.html);
  const header = rendered.filter((r) => r.block.type === 'navbar').map((r) => r.html).join('\n');
  let footer = rendered.filter((r) => r.block.type === 'footer').map((r) => r.html).join('\n');
  const body = rendered.filter((r) => r.block.type !== 'navbar' && r.block.type !== 'footer');

  let main = '';
  if (layout === 'horizontal-slides') {
    const slides = [...body.map((r) => r.html), ...(footer ? [footer] : [])];
    footer = '';
    const slideHeight = header && (headerStyle === 'classic-bar' || headerStyle === 'minimal-centered') ? 'calc(100vh - 76px)' : '100vh';
    main = `<div class="sf-hslides" style="--sf-slide-h: ${slideHeight}"><div class="sf-track">${slides
      .map((html) => `<div class="sf-slide">${html}</div>`)
      .join('\n')}</div></div>`;
  } else if (layout === 'bento-grid') {
    const heroFirst = body[0]?.block.type === 'hero' ? body[0] : null;
    const cells = heroFirst ? body.slice(1) : body;
    main = `${heroFirst ? heroFirst.html : ''}<div class="sf-bento">${cells
      .map((r, i) => `<div class="sf-cell ${BENTO_SPANS[i % BENTO_SPANS.length]}">${r.html}</div>`)
      .join('\n')}</div>`;
  } else if (layout === 'split-screen') {
    let visual = '';
    for (const r of body) {
      const candidate = r.block.content.image || r.block.content.items?.find((it) => it.image)?.image;
      const src = rewriteAssetSrc(candidate);
      if (src) {
        visual = `<img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="window.__sfImageError&amp;&amp;window.__sfImageError(this)" />`;
        break;
      }
    }
    const brand = project.blocks.find((b) => b.type === 'navbar')?.content.brandName || project.name;
    const panel = visual || `<div class="sf-split-empty"><strong style="font-family: var(--sf-font-heading); font-size: 2rem;">${escapeHtml(brand)}</strong></div>`;
    main = `<div class="sf-split"><aside class="sf-split-visual" aria-hidden="true">${panel}</aside><div class="sf-split-content">${body
      .map((r) => r.html)
      .join('\n')}</div></div>`;
  } else {
    main = body.map((r) => r.html).join('\n');
  }
  return { header, main, footer, layout };
}

const THEME_TOGGLE_HTML = `<button type="button" class="sf-theme-toggle" data-sf-theme-toggle aria-pressed="false" aria-label="Basculer entre le mode clair et le mode sombre"><svg class="sf-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><svg class="sf-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button>`;

function renderCredits(project: SiteProject): string {
  const credits = collectImageCredits(project);
  if (credits.length === 0) return '';
  return `<p class="sf-credits">Crédits photos : ${credits.map((c) => escapeHtml(c)).join(' · ')}</p>`;
}

function renderPageContent(project: SiteProject, body: RenderedBody, demoBanner: string): string {
  const main = `<main id="contenu" class="sf-layout" data-layout="${body.layout}">\n${body.main}\n</main>`;
  return `${demoBanner}
  ${body.header}
  ${main}
  ${body.footer}
  ${renderCredits(project)}
  ${project.theme.visitorThemeToggle ? THEME_TOGGLE_HTML : ''}`;
}

function renderProjectPages(
  project: SiteProject,
  demoBanner: string,
  rewriteAssetSrc: (src?: string) => string,
  options: PageOptions,
): string {
  const pages = project.pages?.length
    ? project.pages
    : [{ id: project.activePageId ?? 'home', title: 'Accueil', slug: 'accueil', blocks: project.blocks }];
  const markup = pages.map((page, index) => {
    const pageProject: SiteProject = { ...project, blocks: page.blocks, activePageId: page.id };
    const pageBody = renderBody(pageProject, buildAnchorMap(page.blocks), rewriteAssetSrc);
    return `<div class="sf-site-page" data-site-page="${escapeHtml(page.slug)}"${index ? ' hidden' : ''}>${renderPageContent(pageProject, pageBody, demoBanner)}</div>`;
  }).join('\n');
  return `${markup}\n${buildInlineScripts(options)}`;
}

export function generateStandaloneHtml(project: SiteProject, options: PageOptions = {}): string {
  const css = generateSiteCss(project);
  const fontsUrl = buildGoogleFontsHref(project.theme.fonts.heading, project.theme.fonts.body);
  const demoBanner = project.isDemo
    ? `<aside class="sf-demo-banner" role="note">${escapeHtml(DEMO_FICTION_BANNER_TEXT)}</aside>`
    : '';
  const allBlocks = project.pages?.length ? project.pages.flatMap((page) => page.blocks) : project.blocks;
  const pages = renderProjectPages(project, demoBanner, (src) => sanitizeUrl(src, ''), options);

  return `<!DOCTYPE html>
<html lang="fr" data-theme="${project.theme.mode === 'dark' ? 'dark' : 'light'}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(project.seoTitle || project.name)}</title>
  <meta name="description" content="${escapeHtml(project.seoDescription || '')}" />
  ${buildHeadExtras(project, faviconDataUri(project))}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="${escapeHtml(fontsUrl)}" />
  <style>
${css}
  </style>
</head>
<body id="top" class="${project.theme.liquidGlass ? 'sf-liquid-glass' : ''}" data-header="${sanitizeHeaderStyle(project.theme.headerStyle)}">
  ${pages}
</body>
</html>`;
}

export function generateSeparateHtmlAndCss(
  project: SiteProject,
  options: PageOptions = {},
): {
  indexHtml: string;
  styleCss: string;
  assetSources: Array<{ original: string; fileName: string }>;
} {
  const assetMap = new Map<string, string>();
  let assetCounter = 1;

  const rewriteAssetSrc = (raw?: string): string => {
    const clean = sanitizeUrl(raw, '');
    if (!clean) return '';
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      return clean;
    }
    if (assetMap.has(clean)) {
      return `assets/${assetMap.get(clean)}`;
    }
    let ext = 'jpg';
    if (clean.startsWith('data:image/png')) ext = 'png';
    else if (clean.startsWith('data:image/webp')) ext = 'webp';
    else if (clean.startsWith('data:image/svg+xml')) ext = 'svg';
    else if (clean.endsWith('.png')) ext = 'png';
    else if (clean.endsWith('.svg')) ext = 'svg';
    const fileName = `media-${assetCounter++}.${ext}`;
    assetMap.set(clean, fileName);
    return `assets/${fileName}`;
  };

  const styleCss = generateSiteCss(project);
  const fontsUrl = buildGoogleFontsHref(project.theme.fonts.heading, project.theme.fonts.body);
  const demoBanner = project.isDemo
    ? `<aside class="sf-demo-banner" role="note">${escapeHtml(DEMO_FICTION_BANNER_TEXT)}</aside>`
    : '';
  const allBlocks = project.pages?.length ? project.pages.flatMap((page) => page.blocks) : project.blocks;
  const pages = renderProjectPages(project, demoBanner, rewriteAssetSrc, options);

  const indexHtml = `<!DOCTYPE html>
<html lang="fr" data-theme="${project.theme.mode === 'dark' ? 'dark' : 'light'}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(project.seoTitle || project.name)}</title>
  <meta name="description" content="${escapeHtml(project.seoDescription || '')}" />
  ${buildHeadExtras(project, 'favicon.svg')}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="${escapeHtml(fontsUrl)}" />
  <link rel="stylesheet" href="style.css" />
</head>
<body id="top" class="${project.theme.liquidGlass ? 'sf-liquid-glass' : ''}" data-header="${sanitizeHeaderStyle(project.theme.headerStyle)}">
  ${pages}
</body>
</html>`;

  const assetSources = Array.from(assetMap.entries()).map(([original, fileName]) => ({
    original,
    fileName,
  }));

  return { indexHtml, styleCss, assetSources };
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function isLocalAssetPath(value?: string): value is string {
  return Boolean(value && value.startsWith('/') && !value.startsWith('//'));
}

/**
 * Pour le fichier HTML unique : les images locales de l'application (/src/assets/...) n'existent plus
 * une fois le fichier ouvert ailleurs. On les intègre donc dans le fichier sous forme de Data URL.
 * Une image introuvable est retirée plutôt que laissée cassée.
 */
export async function inlineLocalAssets(project: SiteProject): Promise<SiteProject> {
  const urls = new Set<string>();
  const allBlocks = [...project.blocks, ...(project.pages ?? []).flatMap((page) => page.blocks)];
  for (const block of allBlocks) {
    if (isLocalAssetPath(block.content.image)) urls.add(block.content.image);
    if (isLocalAssetPath(block.content.secondaryImage)) urls.add(block.content.secondaryImage);
    for (const item of block.content.items ?? []) {
      if (isLocalAssetPath(item.image)) urls.add(item.image);
    }
  }
  if (urls.size === 0) return project;

  const resolved = new Map<string, string>();
  await Promise.all(
    Array.from(urls).map(async (url) => {
      const dataUrl = await fetchAsDataUrl(url);
      resolved.set(url, dataUrl ?? '');
    }),
  );

  const swap = (value?: string): string | undefined =>
    isLocalAssetPath(value) ? resolved.get(value) || undefined : value;

  return {
    ...project,
    blocks: project.blocks.map((block) => ({
      ...block,
      content: {
        ...block.content,
        image: swap(block.content.image),
        secondaryImage: swap(block.content.secondaryImage),
        items: block.content.items?.map((item) => ({ ...item, image: swap(item.image) })),
      },
    })),
    pages: project.pages?.map((page) => ({
      ...page,
      blocks: page.blocks.map((block) => ({
        ...block,
        content: {
          ...block.content,
          image: swap(block.content.image),
          secondaryImage: swap(block.content.secondaryImage),
          items: block.content.items?.map((item) => ({ ...item, image: swap(item.image) })),
        },
      })),
    })),
  };
}

export async function exportProjectAsZipBlob(project: SiteProject): Promise<Blob> {
  const zip = new JSZip();
  const { indexHtml, styleCss, assetSources } = generateSeparateHtmlAndCss(project);

  zip.file('index.html', indexHtml);
  zip.file('style.css', styleCss);
  zip.file('favicon.svg', buildFaviconSvg(project));
  zip.file('robots.txt', buildRobotsTxt(project));
  const sitemap = buildSitemapXml(project);
  if (sitemap) zip.file('sitemap.xml', sitemap);
  zip.file('LISEZMOI.md', buildDeploymentGuide(project));
  const assetsFolder = zip.folder('assets');

  if (assetsFolder) {
    for (const asset of assetSources) {
      try {
        if (asset.original.startsWith('data:image/svg+xml;utf8,')) {
          const svgText = decodeURIComponent(asset.original.replace('data:image/svg+xml;utf8,', ''));
          assetsFolder.file(asset.fileName, svgText);
        } else if (asset.original.startsWith('data:')) {
          const base64Part = asset.original.split(',')[1];
          if (base64Part) {
            assetsFolder.file(asset.fileName, base64Part, { base64: true });
          }
        } else if (asset.original.startsWith('/')) {
          const res = await fetch(asset.original);
          if (res.ok) {
            const buf = await res.arrayBuffer();
            assetsFolder.file(asset.fileName, buf);
          }
        }
      } catch {
        // Skip unreachable asset safely without aborting ZIP export
      }
    }
  }

  return zip.generateAsync({ type: 'blob' });
}

/**
 * Moteur d'effets partagé entre la page d'édition (canvas) et le site exporté.
 * Le HTML porte des attributs data-* ; le script ci-dessous les lit et anime la page.
 * C'est une chaîne de caractères (et non une fonction) pour pouvoir être copiée telle quelle dans l'export.
 *
 * Contrat de balisage :
 *   <section data-anim="fade-up" style="--sf-anim-ms:700ms">                       animation d'entrée
 *   <div class="sf-fx" data-fx-scroll="parallax-slow" data-fx-scroll-i="50"
 *        data-fx-3d="tilt-3d-hover" data-fx-3d-i="50" style="--k3:.5">
 *     <div class="sf-fx-3d"><div class="sf-fx-inner"><img .../><img class="sf-fx-after" .../></div></div>
 *   </div>
 *   <main class="sf-layout" data-layout="horizontal-slides"><div class="sf-track"><div class="sf-slide">…
 *   <button data-sf-theme-toggle>                                                   mode clair / sombre
 */

export const EFFECTS_CSS = `
.sf-liquid-glass, [data-glass="true"] {
  background: linear-gradient(135deg, rgba(255,255,255,calc(var(--glass-opacity,.22) * 1.25)), rgba(255,255,255,calc(var(--glass-opacity,.22) * .65)));
  -webkit-backdrop-filter: blur(var(--glass-blur,24px)) saturate(185%) contrast(105%);
  backdrop-filter: blur(var(--glass-blur,24px)) saturate(185%) contrast(105%);
  border: 1px solid rgba(255,255,255,var(--glass-border-opacity,.38));
  box-shadow: 0 20px 45px -15px rgba(15,23,42,.22), inset 0 1px 1px rgba(255,255,255,.55), inset 0 -1px 1px rgba(255,255,255,.12);
}
.sf-navbar-preview { position: relative; z-index: 40; }
.sf-navbar-pill { margin: 12px auto; width: calc(100% - 24px); border-radius: var(--nav-radius); }
.sf-navbar-wide { margin: 12px 20px; width: calc(100% - 40px); border-radius: var(--nav-radius); }
.sf-navbar-drawer { border-radius: var(--nav-radius); }
/* ===== Animations d'entrée ===== */
[data-anim] { --sf-anim-ms: 700ms; }
[data-anim]:not([data-anim="none"]) {
  transition: opacity var(--sf-anim-ms) cubic-bezier(0.22, 1, 0.36, 1), transform var(--sf-anim-ms) cubic-bezier(0.22, 1, 0.36, 1);
}
.sf-js [data-anim="fade-in"]:not(.is-in),
.sf-js [data-anim="fade-up"]:not(.is-in),
.sf-js [data-anim="fade-down"]:not(.is-in),
.sf-js [data-anim="slide-left"]:not(.is-in),
.sf-js [data-anim="slide-right"]:not(.is-in),
.sf-js [data-anim="zoom-in"]:not(.is-in),
.sf-js [data-anim="zoom-out"]:not(.is-in),
.sf-js [data-anim="flip-up"]:not(.is-in) { opacity: 0; }
.sf-js [data-anim="fade-up"]:not(.is-in) { transform: translateY(32px); }
.sf-js [data-anim="fade-down"]:not(.is-in) { transform: translateY(-32px); }
.sf-js [data-anim="slide-left"]:not(.is-in) { transform: translateX(-64px); }
.sf-js [data-anim="slide-right"]:not(.is-in) { transform: translateX(64px); }
.sf-js [data-anim="zoom-in"]:not(.is-in) { transform: scale(0.92); }
.sf-js [data-anim="zoom-out"]:not(.is-in) { transform: scale(1.08); }
.sf-js [data-anim="flip-up"]:not(.is-in) { transform: perspective(900px) rotateX(16deg) translateY(24px); transform-origin: top center; }
.sf-js [data-anim="stagger-children"]:not(.is-in) .sf-st { opacity: 0; transform: translateY(24px); }
.sf-st {
  transition: opacity var(--sf-anim-ms, 700ms) ease calc(var(--i, 0) * 90ms),
    transform var(--sf-anim-ms, 700ms) cubic-bezier(0.2, 0.7, 0.2, 1) calc(var(--i, 0) * 90ms);
}

/* ===== Images : enveloppe commune ===== */
.sf-fx { position: relative; width: 100%; --k3: 0.5; --ks: 0.5; }
.sf-fx-3d { position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: inherit; transition: transform 0.18s ease-out, box-shadow 0.3s ease; }
.sf-fx-inner { position: relative; width: 100%; height: 100%; will-change: transform; }
.sf-fx img { display: block; width: 100%; height: 100%; object-fit: cover; }
.sf-fx[data-fx-scroll="sticky-showcase"] { position: sticky; top: 12vh; }
.sf-fx[data-fx-scroll="parallax-slow"] img, .sf-fx[data-fx-scroll="parallax-fast"] img,
.sf-fx[data-fx-scroll="scroll-zoom-out"] img, .sf-fx[data-fx-scroll="horizontal-drift"] img,
.sf-fx[data-fx-scroll="scroll-rotate-subtle"] img { transform: scale(1.18); }

/* ===== Effets 3D et interactifs ===== */
.sf-fx[data-fx-3d="float-3d-shadow"] .sf-fx-3d {
  animation: sf-float 5s ease-in-out infinite;
  box-shadow: 0 calc(var(--k3) * 36px) calc(var(--k3) * 56px) -14px rgba(0, 0, 0, 0.38);
}
@keyframes sf-float {
  0%, 100% { transform: translateY(0) rotateX(1.5deg); }
  50% { transform: translateY(calc(var(--k3) * -18px)) rotateX(-1.5deg); }
}
.sf-fx[data-fx-3d="isometric-card"] { perspective: 1400px; }
.sf-fx[data-fx-3d="isometric-card"] .sf-fx-3d {
  transform: rotateX(calc(var(--k3) * 58deg)) rotateZ(calc(var(--k3) * -40deg));
  box-shadow: calc(var(--k3) * -26px) calc(var(--k3) * 30px) calc(var(--k3) * 40px) -10px rgba(0, 0, 0, 0.4);
}
.sf-fx[data-fx-3d="isometric-card"]:hover .sf-fx-3d { transform: rotateX(calc(var(--k3) * 38deg)) rotateZ(calc(var(--k3) * -26deg)); }
.sf-fx[data-fx-3d="device-frame-3d"] { perspective: 1200px; }
.sf-fx[data-fx-3d="device-frame-3d"] .sf-fx-3d {
  border: calc(7px + var(--k3) * 7px) solid #141414;
  border-radius: 22px;
  transform: rotateY(calc(var(--k3) * -20deg)) rotateX(calc(var(--k3) * 6deg));
  box-shadow: 0 28px 48px -16px rgba(0, 0, 0, 0.5);
}
.sf-fx[data-fx-3d="glass-refraction"] .sf-fx-3d::after,
.sf-fx[data-fx-3d="spotlight-glow"] .sf-fx-3d::after {
  content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity 0.25s ease;
}
.sf-fx[data-fx-3d="glass-refraction"] .sf-fx-3d::after {
  background: linear-gradient(115deg, rgba(255, 255, 255, 0) 30%, rgba(255, 255, 255, calc(0.15 + var(--k3) * 0.35)) 48%, rgba(255, 255, 255, 0) 66%);
  background-size: 220% 100%; background-position: calc(var(--mx, 50) * 1%) 0;
}
.sf-fx[data-fx-3d="glass-refraction"] .sf-fx-3d { box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45); }
.sf-fx[data-fx-3d="spotlight-glow"] .sf-fx-3d::after {
  background: radial-gradient(circle at calc(var(--mx, 50) * 1%) calc(var(--my, 50) * 1%), rgba(255, 255, 255, calc(0.25 + var(--k3) * 0.5)), rgba(255, 255, 255, 0) 55%);
  mix-blend-mode: soft-light;
}
.sf-fx[data-fx-3d="glass-refraction"]:hover .sf-fx-3d::after,
.sf-fx[data-fx-3d="spotlight-glow"]:hover .sf-fx-3d::after { opacity: 1; }
.sf-fx[data-fx-3d="ken-burns-loop"] img { animation: sf-kb 18s ease-in-out infinite alternate; }
@keyframes sf-kb {
  0% { transform: scale(1) translate(0, 0); }
  100% { transform: scale(calc(1.06 + var(--k3) * 0.22)) translate(-2.5%, -2%); }
}
.sf-fx-after { position: absolute; inset: 0; clip-path: inset(0 0 0 var(--pos, 50%)); }
.sf-ba-line { position: absolute; top: 0; bottom: 0; left: var(--pos, 50%); width: 2px; background: #fff; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25); transform: translateX(-1px); pointer-events: none; }
.sf-ba-knob { position: absolute; top: 50%; left: var(--pos, 50%); width: 34px; height: 34px; border-radius: 50%; background: #fff; border: 2px solid rgba(0, 0, 0, 0.35); transform: translate(-50%, -50%); pointer-events: none; }
.sf-ba-range { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: ew-resize; }
.sf-lens { position: absolute; width: 132px; height: 132px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4); background-repeat: no-repeat; pointer-events: none; display: none; z-index: 3; }

/* ===== Mises en page ===== */
.sf-layout { width: 100%; }
.sf-cell { min-width: 0; }
[data-layout="bento-grid"] .sf-bento { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 1.25rem; max-width: 1280px; margin: 0 auto; padding: 1.25rem; }
[data-layout="bento-grid"] .sf-cell { grid-column: span 12; }
[data-layout="bento-grid"] .sf-cell > section { height: 100%; border-radius: calc(var(--sf-radius, 8px) * 2); overflow: hidden; border: var(--sf-border-width, 1px) solid var(--sf-border, rgba(0, 0, 0, 0.12)); }
@media (min-width: 901px) {
  [data-layout="bento-grid"] .sf-cell.sf-span-7 { grid-column: span 7; }
  [data-layout="bento-grid"] .sf-cell.sf-span-5 { grid-column: span 5; }
  [data-layout="bento-grid"] .sf-cell.sf-span-6 { grid-column: span 6; }
  [data-layout="bento-grid"] .sf-cell.sf-span-4 { grid-column: span 4; }
}
[data-layout="split-screen"] .sf-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
[data-layout="split-screen"] .sf-split-visual { position: sticky; top: 0; height: 100vh; overflow: hidden; background: var(--sf-surface); }
[data-layout="split-screen"] .sf-split-visual img { width: 100%; height: 100%; object-fit: cover; display: block; }
[data-layout="split-screen"] .sf-split-visual .sf-split-empty { display: flex; align-items: center; justify-content: center; height: 100%; padding: 2rem; color: var(--sf-muted); text-align: center; }
[data-layout="split-screen"] .sf-split-content { min-width: 0; }
[data-layout="split-screen"] .sf-split-content .sf-hero-media { display: none; }
@media (max-width: 900px) {
  [data-layout="split-screen"] .sf-split { grid-template-columns: 1fr; }
  [data-layout="split-screen"] .sf-split-visual { position: relative; height: 46vh; }
}
[data-layout="scroll-story"] [data-story] {
  transform: translateY(calc((1 - var(--sf-story-p, 1)) * 56px)) scale(calc(0.95 + 0.05 * var(--sf-story-p, 1)));
  opacity: calc(0.2 + 0.8 * var(--sf-story-p, 1));
  will-change: transform, opacity;
}
[data-layout="horizontal-slides"] .sf-track {
  display: flex; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x proximity; scroll-behavior: smooth;
  height: var(--sf-slide-h, 100vh); scrollbar-width: none;
}
[data-layout="horizontal-slides"] .sf-track::-webkit-scrollbar { display: none; }
[data-layout="horizontal-slides"] .sf-slide { flex: 0 0 100%; min-width: 100%; height: 100%; overflow-y: auto; scroll-snap-align: start; }
[data-layout="horizontal-slides"] .sf-slide > section { min-height: 100%; }
.sf-hnav { position: sticky; bottom: 14px; display: flex; align-items: center; justify-content: center; gap: 0.6rem; margin-top: -48px; height: 34px; z-index: 20; pointer-events: none; }
.sf-hnav > * { pointer-events: auto; }
.sf-hnav button { border: 1px solid var(--sf-border, rgba(0,0,0,.2)); background: var(--sf-surface, #fff); color: var(--sf-text, #111); border-radius: 999px; width: 34px; height: 34px; cursor: pointer; font-size: 16px; line-height: 1; }
.sf-hdot { width: 9px !important; height: 9px !important; padding: 0; border-radius: 50%; background: var(--sf-border, rgba(0,0,0,.25)) !important; }
.sf-hdot[aria-current="true"] { background: var(--sf-primary, #111) !important; transform: scale(1.35); }

/* ===== Styles de navigation ===== */
[data-header="floating-glass"] .sf-navbar {
  position: fixed; top: 14px; left: 50%; transform: translateX(-50%); width: min(1080px, calc(100% - 28px));
  border: 1px solid var(--sf-border, rgba(0,0,0,.15)); border-radius: 999px; z-index: 60;
  background-color: color-mix(in srgb, var(--sf-nav-bg, #fff) 74%, transparent) !important;
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
}
[data-header="floating-glass"] .sf-navbar .sf-navbar-inner { padding-top: 0.55rem; padding-bottom: 0.55rem; }
[data-header="vertical-sidebar"] .sf-navbar { position: fixed; top: 0; left: 0; bottom: 0; width: 232px; z-index: 60; border-right: var(--sf-border-width, 1px) solid var(--sf-border); border-bottom: 0; overflow-y: auto; }
[data-header="vertical-sidebar"] .sf-navbar-inner { flex-direction: column; align-items: flex-start; justify-content: flex-start; gap: 2rem; height: 100%; padding: 2rem 1.5rem; }
[data-header="vertical-sidebar"] .sf-nav-panel { flex-direction: column; align-items: stretch; width: 100%; gap: 1.5rem; }
[data-header="vertical-sidebar"] .sf-nav-links { flex-direction: column; align-items: stretch; gap: 0.25rem; }
[data-header="vertical-sidebar"] .sf-nav-cta-mobile { display: block; }
[data-header="vertical-sidebar"] .sf-nav-cta { display: none; }
[data-header="vertical-sidebar"] .sf-layout, [data-header="vertical-sidebar"] main { margin-left: 232px; }
[data-header="minimal-centered"] .sf-navbar-inner { flex-direction: column; align-items: center; gap: 0.6rem; }
[data-header="minimal-centered"] .sf-nav-panel { gap: 1.5rem; justify-content: center; }
[data-header="minimal-centered"] .sf-nav-cta { display: none; }
[data-header="hidden"] .sf-navbar { display: none; }
@media (max-width: 900px) {
  [data-header="vertical-sidebar"] .sf-navbar { position: sticky; width: auto; bottom: auto; border-right: 0; border-bottom: var(--sf-border-width, 1px) solid var(--sf-border); }
  [data-header="vertical-sidebar"] .sf-navbar-inner { flex-direction: row; align-items: center; height: auto; padding: 0.9rem 1.25rem; gap: 1rem; }
  [data-header="vertical-sidebar"] .sf-layout, [data-header="vertical-sidebar"] main { margin-left: 0; }
  [data-header="vertical-sidebar"] .sf-nav-cta { display: block; }
  [data-header="floating-glass"] .sf-navbar { border-radius: 24px; }
  [data-header="minimal-centered"] .sf-navbar-inner { flex-direction: row; justify-content: space-between; }
  [data-header="minimal-centered"] .sf-nav-cta { display: block; }
}

/* ===== Mode clair / sombre du visiteur, crédits photos ===== */
.sf-theme-toggle {
  position: fixed; right: 16px; bottom: 16px; z-index: 70; width: 44px; height: 44px; border-radius: 50%;
  border: 1px solid var(--sf-border, rgba(0,0,0,.2)); background: var(--sf-surface, #fff); color: var(--sf-text, #111);
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,.18);
}
.sf-theme-toggle svg { width: 20px; height: 20px; }
.sf-theme-toggle .sf-moon { display: none; }
[data-theme="light"] .sf-theme-toggle .sf-sun { display: none; }
[data-theme="light"] .sf-theme-toggle .sf-moon { display: block; }
.sf-credits { font-size: 0.75rem; color: var(--sf-muted); padding: 1rem 1.5rem 1.5rem; text-align: center; line-height: 1.5; }
.sf-credits a { color: inherit; }
@media (prefers-reduced-motion: reduce) {
  .sf-fx[data-fx-3d="float-3d-shadow"] .sf-fx-3d, .sf-fx[data-fx-3d="ken-burns-loop"] img { animation: none; }
  [data-anim], .sf-st { transition: none !important; }
}
`;

export const EFFECTS_RUNTIME_JS = `(function () {
  window.__sfImageError = function (img) {
    if (!img || !img.parentNode) return;
    var fallback = document.createElement('div');
    fallback.className = 'sf-image-fallback';
    fallback.setAttribute('role', 'img');
    fallback.setAttribute('aria-label', img.alt || 'Image indisponible');
    fallback.textContent = 'Image indisponible';
    fallback.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:4rem;padding:1rem;box-sizing:border-box;background:#EFE7D8;color:#57534E;font:500 12px sans-serif;text-align:center;border-radius:inherit';
    img.parentNode.replaceChild(fallback, img);
  };

  window.__sfFxReplay = function (el) {
    if (!el) return;
    el.classList.remove('is-in');
    void el.offsetWidth;
    window.requestAnimationFrame(function () { el.classList.add('is-in'); });
  };

  window.__sfFx = function (root, opts) {
    opts = opts || {};
    var doc = root.nodeType === 9 ? root : root.ownerDocument;
    var host = root.nodeType === 9 ? root.documentElement : root;
    var scroller = opts.scroller || null;
    var cleanups = [];
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var all = function (sel, ctx) { return [].slice.call((ctx || root).querySelectorAll(sel)); };
    var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
    var listen = function (target, type, fn, o) {
      target.addEventListener(type, fn, o);
      cleanups.push(function () { target.removeEventListener(type, fn, o); });
    };

    host.classList.add('sf-js');

    /* 1. Animations d'entrée */
    var anims = all('[data-anim]').filter(function (el) { return el.getAttribute('data-anim') !== 'none'; });
    anims.forEach(function (el) {
      if (el.getAttribute('data-anim') === 'stagger-children') {
        var items = all('.sf-container > *:not([class*="sf-grid"]), [class*="sf-grid"] > *', el);
        items.forEach(function (item, i) { item.classList.add('sf-st'); item.style.setProperty('--i', String(i)); });
      }
    });
    if (opts.edit || reduce || !('IntersectionObserver' in window)) {
      anims.forEach(function (el) { el.classList.add('is-in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) entry.target.classList.add('is-in');
          else entry.target.classList.remove('is-in');
        });
      }, { threshold: 0.12, rootMargin: '-8% 0px -8% 0px' });
      anims.forEach(function (el) { io.observe(el); });
      cleanups.push(function () { io.disconnect(); });
    }

    /* 2. Effets d'image liés au défilement, et récit au défilement */
    var scrollFx = all('.sf-fx[data-fx-scroll]').filter(function (el) {
      var t = el.getAttribute('data-fx-scroll');
      return t !== 'none' && t !== 'sticky-showcase';
    });
    var story = all('[data-story]');
    var ticking = false;
    var update = function () {
      ticking = false;
      var vh = scroller ? scroller.clientHeight : window.innerHeight;
      var top0 = scroller ? scroller.getBoundingClientRect().top : 0;
      scrollFx.forEach(function (el) {
        var inner = el.querySelector('.sf-fx-inner');
        if (!inner) return;
        if (reduce) { inner.style.transform = ''; inner.style.clipPath = ''; return; }
        var r = el.getBoundingClientRect();
        var p = clamp((vh - (r.top - top0)) / (vh + r.height), 0, 1);
        var k = (parseFloat(el.getAttribute('data-fx-scroll-i')) || 50) / 100;
        var type = el.getAttribute('data-fx-scroll');
        var t = '';
        var clip = '';
        if (type === 'parallax-slow') t = 'translate3d(0,' + ((p - 0.5) * -70 * k).toFixed(1) + 'px,0)';
        else if (type === 'parallax-fast') t = 'translate3d(0,' + ((p - 0.5) * -170 * k).toFixed(1) + 'px,0)';
        else if (type === 'scroll-zoom-in') t = 'scale(' + (1 + p * 0.4 * k).toFixed(3) + ')';
        else if (type === 'scroll-zoom-out') t = 'scale(' + (1 + 0.4 * k - p * 0.4 * k).toFixed(3) + ')';
        else if (type === 'horizontal-drift') t = 'translate3d(' + ((p - 0.5) * 140 * k).toFixed(1) + 'px,0,0)';
        else if (type === 'scroll-rotate-subtle') t = 'rotate(' + ((p - 0.5) * 10 * k).toFixed(2) + 'deg)';
        else if (type === 'scroll-reveal-curtain') clip = 'inset(0 ' + ((1 - clamp(p * 1.7, 0, 1)) * 100).toFixed(1) + '% 0 0)';
        inner.style.transform = t;
        inner.style.clipPath = clip;
      });
      story.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var p = reduce ? 1 : clamp((vh - (r.top - top0)) / (vh * 0.7), 0, 1);
        el.style.setProperty('--sf-story-p', p.toFixed(3));
      });
    };
    var schedule = function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };
    if (scrollFx.length || story.length) {
      listen(doc, 'scroll', schedule, true);
      listen(window, 'resize', schedule);
      update();
    }

    /* 3. Effets 3D et interactifs */
    all('.sf-fx[data-fx-3d]').forEach(function (el) {
      var mode = el.getAttribute('data-fx-3d');
      var k = (parseFloat(el.getAttribute('data-fx-3d-i')) || 50) / 100;
      var box = el.querySelector('.sf-fx-3d');
      if (!box || mode === 'none') return;

      if (mode === 'tilt-3d-hover') {
        listen(el, 'pointermove', function (e) {
          var r = el.getBoundingClientRect();
          var x = (e.clientX - r.left) / (r.width || 1) - 0.5;
          var y = (e.clientY - r.top) / (r.height || 1) - 0.5;
          box.style.transform = 'perspective(900px) rotateX(' + (-y * 30 * k).toFixed(2) + 'deg) rotateY(' + (x * 30 * k).toFixed(2) + 'deg) scale3d(1.02,1.02,1.02)';
        });
        listen(el, 'pointerleave', function () { box.style.transform = ''; });
      }

      if (mode === 'glass-refraction' || mode === 'spotlight-glow') {
        listen(el, 'pointermove', function (e) {
          var r = el.getBoundingClientRect();
          el.style.setProperty('--mx', String(clamp(((e.clientX - r.left) / (r.width || 1)) * 100, 0, 100).toFixed(1)));
          el.style.setProperty('--my', String(clamp(((e.clientY - r.top) / (r.height || 1)) * 100, 0, 100).toFixed(1)));
        });
      }

      if (mode === 'before-after-slider') {
        var inner = el.querySelector('.sf-fx-inner');
        if (inner && el.querySelector('.sf-fx-after') && !el.querySelector('.sf-ba-range')) {
          var line = doc.createElement('div'); line.className = 'sf-ba-line';
          var knob = doc.createElement('div'); knob.className = 'sf-ba-knob';
          var range = doc.createElement('input');
          range.type = 'range'; range.min = '0'; range.max = '100'; range.value = '50'; range.className = 'sf-ba-range';
          range.setAttribute('aria-label', 'Comparer avant et après');
          inner.appendChild(line); inner.appendChild(knob); inner.appendChild(range);
          var setPos = function () { el.style.setProperty('--pos', range.value + '%'); };
          listen(range, 'input', setPos);
          setPos();
        }
      }

      if (mode === 'magnifier-loupe') {
        var img = el.querySelector('img');
        var lens = el.querySelector('.sf-lens');
        if (img && !lens) { lens = doc.createElement('div'); lens.className = 'sf-lens'; box.appendChild(lens); }
        if (img && lens) {
          var zoom = 1.6 + 1.8 * k;
          listen(el, 'pointermove', function (e) {
            var r = box.getBoundingClientRect();
            var x = e.clientX - r.left;
            var y = e.clientY - r.top;
            lens.style.display = 'block';
            lens.style.left = (x - 66) + 'px';
            lens.style.top = (y - 66) + 'px';
            lens.style.backgroundImage = 'url("' + img.currentSrc.replace(/"/g, '%22') + '")';
            lens.style.backgroundSize = (r.width * zoom) + 'px ' + (r.height * zoom) + 'px';
            lens.style.backgroundPosition = (-(x * zoom - 66)) + 'px ' + (-(y * zoom - 66)) + 'px';
          });
          listen(el, 'pointerleave', function () { lens.style.display = 'none'; });
        }
      }
    });

    /* 4. Diapositives horizontales : la molette verticale fait avancer de gauche à droite */
    all('.sf-track').forEach(function (track) {
      var slides = [].slice.call(track.children);
      if (slides.length === 0) return;
      var holder = track.parentNode;
      var nav = holder.querySelector('.sf-hnav');
      if (!nav) {
        nav = doc.createElement('div'); nav.className = 'sf-hnav';
        var prev = doc.createElement('button'); prev.type = 'button'; prev.textContent = '‹'; prev.setAttribute('aria-label', 'Diapositive précédente');
        var next = doc.createElement('button'); next.type = 'button'; next.textContent = '›'; next.setAttribute('aria-label', 'Diapositive suivante');
        nav.appendChild(prev);
        slides.forEach(function (s, i) {
          var dot = doc.createElement('button'); dot.type = 'button'; dot.className = 'sf-hdot';
          dot.setAttribute('aria-label', 'Aller à la diapositive ' + (i + 1));
          dot.addEventListener('click', function () { go(i); });
          nav.appendChild(dot);
        });
        nav.appendChild(next);
        holder.insertBefore(nav, track.nextSibling);
        prev.addEventListener('click', function () { go(current() - 1); });
        next.addEventListener('click', function () { go(current() + 1); });
        cleanups.push(function () { if (nav.parentNode) nav.parentNode.removeChild(nav); });
      }
      var current = function () { return clamp(Math.round(track.scrollLeft / (track.clientWidth || 1)), 0, slides.length - 1); };
      var go = function (i) { track.scrollTo({ left: clamp(i, 0, slides.length - 1) * track.clientWidth, behavior: reduce ? 'auto' : 'smooth' }); };
      var sync = function () {
        var c = current();
        [].forEach.call(nav.querySelectorAll('.sf-hdot'), function (d, i) { d.setAttribute('aria-current', i === c ? 'true' : 'false'); });
      };
      listen(track, 'scroll', sync);
      listen(track, 'wheel', function (e) {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        var node = e.target;
        var slide = null;
        while (node && node !== track) { if (node.parentNode === track) { slide = node; break; } node = node.parentNode; }
        if (slide && slide.scrollHeight > slide.clientHeight + 2) {
          var atTop = slide.scrollTop <= 0;
          var atBottom = slide.scrollTop + slide.clientHeight >= slide.scrollHeight - 2;
          if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atBottom)) return;
        }
        e.preventDefault();
        track.scrollLeft += e.deltaY;
      }, { passive: false });
      listen(track, 'keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); go(current() + 1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(current() - 1); }
      });
      track.setAttribute('tabindex', '0');
      sync();
    });

    /* 5. Bouton clair / sombre du visiteur */
    var toggle = root.querySelector('[data-sf-theme-toggle]');
    if (toggle) {
      var themeHost = opts.themeHost || host;
      if (!opts.edit) {
        try {
          var saved = window.localStorage.getItem('sf-theme');
          if (saved === 'dark' || saved === 'light') themeHost.setAttribute('data-theme', saved);
        } catch (e) { /* stockage indisponible : on garde le thème du site */ }
      }
      var paint = function () { toggle.setAttribute('aria-pressed', themeHost.getAttribute('data-theme') === 'dark' ? 'true' : 'false'); };
      listen(toggle, 'click', function () {
        var nextTheme = themeHost.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        themeHost.setAttribute('data-theme', nextTheme);
        if (!opts.edit) { try { window.localStorage.setItem('sf-theme', nextTheme); } catch (e) { /* ignoré */ } }
        paint();
      });
      paint();
    }

    return function () {
      cleanups.forEach(function (fn) { fn(); });
      host.classList.remove('sf-js');
    };
  };
})();`;

/** Palette de classes de largeur utilisées par la grille bento, selon la position de la section. */
export const BENTO_SPANS = ['sf-span-7', 'sf-span-5', 'sf-span-5', 'sf-span-7', 'sf-span-6', 'sf-span-6', 'sf-span-4'];
export const bentoSpanFor = (position: number): string => BENTO_SPANS[position % BENTO_SPANS.length];

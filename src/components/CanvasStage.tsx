import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';
import type { SiteBlock, SiteTheme } from '../types/site';
import { EFFECTS_CSS, EFFECTS_RUNTIME_JS, BENTO_SPANS } from '../utils/effectsRuntime';
import { sanitizeHeaderStyle, sanitizeLayoutMode } from '../utils/effectsCatalog';
import { serializeSafeBlockCss } from '../utils/siteSettings';

export interface StageItem {
  block: SiteBlock;
  node: ReactNode;
}

interface CanvasStageProps {
  theme: SiteTheme;
  items: StageItem[];
  /** Zone de dépôt finale */
  tail: ReactNode;
  previewMode: boolean;
  /** Change quand un effet, une animation ou une image change : le moteur d'effets est alors relancé */
  fxKey: string;
  scroller: HTMLElement | null;
  /** Le visiteur regarde la version alternative (clair / sombre) du site */
  altTheme: boolean;
  onToggleTheme: () => void;
  /** Image affichée dans le panneau fixe de l'écran partagé */
  splitImage?: string;
}

const CANVAS_CSS = `
.sf-stage { position: relative; }
.sf-inline-edit { outline: none; cursor: text; border-radius: 2px; }
.sf-inline-edit:hover { box-shadow: 0 0 0 1px rgba(154, 52, 18, 0.5); }
.sf-inline-edit:focus { box-shadow: 0 0 0 2px #9A3412; background: rgba(154, 52, 18, 0.06); }
.sf-inline-edit:empty::before { content: attr(data-placeholder); opacity: 0.4; }
.sf-stage[data-header="floating-glass"] .sf-nav-slot { position: sticky; top: 10px; z-index: 40; width: min(1080px, calc(100% - 28px)); margin: 10px auto 0; border-radius: 999px; overflow: hidden; box-shadow: 0 6px 24px rgba(0,0,0,.18); }
.sf-stage[data-header="hidden"] .sf-nav-slot { opacity: .3; filter: grayscale(1); }
.sf-stage[data-header="hidden"] .sf-nav-slot::after { content: 'Navigation masquée sur le site'; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; background: rgba(255,255,255,.55); color: #1C1917; pointer-events: none; }
.sf-stage[data-header="minimal-centered"] .sf-nav-slot > * { text-align: center; }
.sf-stage[data-header="vertical-sidebar"] { display: flex; align-items: flex-start; }
.sf-stage[data-header="vertical-sidebar"] .sf-nav-slot { position: sticky; top: 0; width: 200px; flex: 0 0 200px; overflow: hidden; border-right: 1px solid rgba(0,0,0,.12); }
.sf-stage[data-header="vertical-sidebar"] .sf-stage-main { flex: 1 1 0; min-width: 0; }
[data-layout="horizontal-slides"] .sf-track { --sf-slide-h: 560px; }
`;

function ensureRuntime() {
  if (typeof (window as FxWindow).__sfFx === 'function') return;
  // Le moteur d'effets est le même script que celui du site exporté
  new Function(EFFECTS_RUNTIME_JS)();
}

type FxWindow = Window & { __sfFx?: (root: Element, opts: Record<string, unknown>) => () => void };

/**
 * Scène de la page d'édition : applique l'architecture choisie (vertical, diapositives, bento, écran partagé, récit),
 * le style de navigation, la palette et le moteur d'effets partagé avec l'export.
 */
export function CanvasStage({ theme, items, tail, previewMode, fxKey, scroller, altTheme, onToggleTheme, splitImage }: CanvasStageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const layout = sanitizeLayoutMode(theme.layoutMode);
  const header = sanitizeHeaderStyle(theme.headerStyle);
  const p = theme.palette;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    ensureRuntime();
    const cleanup = (window as FxWindow).__sfFx?.(root, { scroller, edit: !previewMode });
    return () => cleanup?.();
  }, [fxKey, previewMode, layout, scroller, altTheme]);

  const navItems = items.filter((i) => i.block.type === 'navbar');
  const footerItems = items.filter((i) => i.block.type === 'footer');
  const body = items.filter((i) => i.block.type !== 'navbar' && i.block.type !== 'footer');

  let main: ReactNode;
  if (layout === 'horizontal-slides') {
    main = (
      <div className="sf-hslides">
        <div className="sf-track">
          {[...body, ...footerItems].map((i) => (
            <div className="sf-slide" key={i.block.id}>
              {i.node}
            </div>
          ))}
        </div>
      </div>
    );
  } else if (layout === 'bento-grid') {
    const hero = body[0]?.block.type === 'hero' ? body[0] : null;
    const cells = hero ? body.slice(1) : body;
    main = (
      <>
        {hero?.node}
        <div className="sf-bento">
          {cells.map((i, n) => (
            <div className={`sf-cell ${BENTO_SPANS[n % BENTO_SPANS.length]}`} key={i.block.id}>
              {i.node}
            </div>
          ))}
        </div>
        {footerItems.map((i) => (
          <div key={i.block.id}>{i.node}</div>
        ))}
      </>
    );
  } else if (layout === 'split-screen') {
    main = (
      <>
        <div className="sf-split">
          <aside className="sf-split-visual" aria-hidden="true">
            {splitImage ? <img src={splitImage} alt="" /> : <div className="sf-split-empty">Panneau fixe : il affichera la première image de la page</div>}
          </aside>
          <div className="sf-split-content">
            {body.map((i) => (
              <div key={i.block.id}>{i.node}</div>
            ))}
          </div>
        </div>
        {footerItems.map((i) => (
          <div key={i.block.id}>{i.node}</div>
        ))}
      </>
    );
  } else {
    main = (
      <>
        {body.map((i) => (
          <div key={i.block.id}>{i.node}</div>
        ))}
        {footerItems.map((i) => (
          <div key={i.block.id}>{i.node}</div>
        ))}
      </>
    );
  }

  const vars = {
    '--sf-primary': p.primary,
    '--sf-secondary': p.secondary,
    '--sf-bg': p.background,
    '--sf-surface': p.surface,
    '--sf-text': p.text,
    '--sf-muted': p.mutedText,
    '--sf-border': theme.mode === 'dark' ? 'rgba(255,255,255,.14)' : 'rgba(17,17,17,.14)',
    '--sf-nav-bg': p.surface,
  } as CSSProperties;

  return (
    <div ref={rootRef} className="sf-stage" data-layout={layout} data-header={header} data-theme={theme.mode} style={vars}>
      <style>{EFFECTS_CSS + CANVAS_CSS + (theme.customCss ? `:root{${serializeSafeBlockCss(theme.customCss)}}` : '')}</style>
      {navItems.length > 0 && (
        <div className="sf-nav-slot">
          {navItems.map((i) => (
            <div key={i.block.id}>{i.node}</div>
          ))}
        </div>
      )}
      <div className="sf-stage-main sf-layout" data-layout={layout}>
        {main}
        {tail}
      </div>
      {theme.visitorThemeToggle && (
        <button
          type="button"
          onClick={onToggleTheme}
          aria-pressed={altTheme}
          aria-label="Basculer entre le mode clair et le mode sombre du visiteur"
          title="Aperçu du bouton clair / sombre du visiteur"
          className="sf-theme-toggle"
          style={{ position: 'sticky', float: 'right', bottom: 16, marginRight: 16 }}
        >
          {theme.mode === 'dark' !== altTheme ? <Sun className="w-5 h-5" aria-hidden="true" /> : <Moon className="w-5 h-5" aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Copy, EyeOff, GripVertical, Image as ImageIcon, Menu, Trash2, X } from 'lucide-react';
import type { ImageEffectConfig, NavbarConfig, SiteBlock, SiteTheme, ViewportMode } from '../types/site';
import { hasAnyImageEffect, sanitizeImageEffect, sanitizeSectionAnimation, clampDuration } from '../utils/effectsCatalog';
import { getBlockDefinition } from '../utils/blockCatalog';
import { computeBlockSurfaceColors, isTodoValue } from '../utils/honesty';
import { getContrastTextColor, sanitizeColor } from '../utils/validation';
import { DEFAULT_NAVBAR_CONFIG } from '../utils/siteSettings';
import { parseSafeBlockCss } from '../utils/siteSettings';

interface BlockRendererProps {
  block: SiteBlock;
  blockIndex: number;
  theme: SiteTheme;
  viewport: ViewportMode;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Poignée de glisser-déposer : absente = pas de déplacement à la souris */
  onDragStartBlock?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEndBlock?: () => void;
  /** Modification du texte directement sur la page (désactivée en mode Aperçu) */
  onCommitText?: (target: InlineTextTarget, value: string) => void;
  /** Mode Aperçu : pas de contour, de poignée ni d'édition ; les animations jouent comme sur le site */
  previewMode?: boolean;
  /** Architecture de la page : ajoute l'attribut du récit au défilement */
  layoutMode?: string;
  navbarConfig?: NavbarConfig;
  onNavigatePage?: (pageSlug: string) => void;
}

const RADIUS_PX: Record<SiteTheme['borderRadius'], string> = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '14px',
  full: '9999px',
};

const SPACING_PAD: Record<SiteTheme['spacing'], string> = {
  compact: '40px',
  normal: '64px',
  airy: '92px',
};

/** Cible d'une modification de texte directement sur la page : un champ du bloc, ou d'un de ses éléments. */
export interface InlineTextTarget {
  field: string;
  itemId?: string;
}

interface InlineEditApi {
  enabled: boolean;
  commit: (target: InlineTextTarget, value: string) => void;
}

const InlineEditContext = createContext<InlineEditApi>({ enabled: false, commit: () => {} });
export const InlineEditProvider = InlineEditContext.Provider;

/** Texte modifiable en cliquant dessus : Entrée valide, Échap annule, le collage est réduit à du texte brut. */
function EditableText({
  value,
  field,
  itemId,
  placeholder,
}: {
  value: string;
  field: string;
  itemId?: string;
  placeholder: string;
}) {
  const { commit } = useContext(InlineEditContext);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== value) el.textContent = value;
  }, [value]);

  const todo = isTodoValue(value);
  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-label={`Modifier : ${placeholder}`}
      data-inline-edit={field}
      data-placeholder={placeholder}
      className={`sf-inline-edit${todo ? ' sf-inline-todo' : ''}`}
      onFocus={(e) => {
        const range = document.createRange();
        range.selectNodeContents(e.currentTarget);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }}
      onBlur={(e) => {
        const next = (e.currentTarget.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (next !== value) commit({ field, itemId }, next);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          e.currentTarget.textContent = value;
          e.currentTarget.blur();
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain').replace(/\s+/g, ' ');
        document.execCommand('insertText', false, text);
      }}
    >
      {value}
    </span>
  );
}

const FIELD_LABELS: Record<string, string> = {
  heading: 'titre',
  subheading: 'sous-titre',
  kicker: 'surtitre',
  body: 'texte',
  brandName: 'nom de la marque',
  ctaLabel: 'texte du bouton',
  secondaryCtaLabel: 'texte du second bouton',
  title: 'titre',
  subtitle: 'sous-titre',
  description: 'description',
  price: 'prix',
  email: 'e-mail',
  phone: 'téléphone',
  address: 'adresse',
};

function TodoText({
  value,
  fallback,
  field,
  itemId,
}: {
  value?: string;
  fallback?: string;
  field?: string;
  itemId?: string;
}) {
  const edit = useContext(InlineEditContext);
  const display = value ?? fallback ?? '';

  if (edit.enabled && field) {
    return <EditableText value={value ?? ''} field={field} itemId={itemId} placeholder={FIELD_LABELS[field] ?? field} />;
  }

  if (!display) return null;
  if (isTodoValue(display)) {
    return (
      <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-[#FEF3C7] text-[#78350F] border border-[#D97706]">
        {display}
      </span>
    );
  }
  return <>{display}</>;
}

function PreviewImage({
  src,
  alt,
  aspectClass,
  radius,
  effect,
  secondary,
  secondaryAlt,
}: {
  src?: string;
  alt?: string;
  aspectClass: string;
  radius: string;
  effect?: ImageEffectConfig;
  secondary?: string;
  secondaryAlt?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src, secondary]);

  if (!src || failed) {
    return (
      <div
        className={`w-full ${aspectClass} bg-[#EFE7D8]/60 border border-[#E5DEC9] flex flex-col items-center justify-center gap-2 text-[#57534E] p-4 text-center`}
        style={{ borderRadius: radius }}
      >
        <ImageIcon className="w-7 h-7 opacity-60" aria-hidden="true" />
        <span className="text-xs font-medium">{alt || 'Emplacement d’image : ajoutez une photo'}</span>
      </div>
    );
  }

  const fx = effect ? sanitizeImageEffect(effect) : null;
  if (!fx || !hasAnyImageEffect(fx)) {
    return (
      <img
        src={src}
        alt={alt || ''}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`w-full ${aspectClass} object-cover`}
        style={{ borderRadius: radius }}
      />
    );
  }

  // Même enveloppe que dans le site exporté : le moteur d'effets partagé l'anime sur la page d'édition
  const hasAfter = fx.effect3d === 'before-after-slider' && Boolean(secondary);
  const fx3d = fx.effect3d === 'before-after-slider' && !hasAfter ? 'none' : fx.effect3d;
  return (
    <div
      className={`sf-fx w-full ${aspectClass}`}
      data-fx-scroll={fx.scroll}
      data-fx-scroll-i={fx.scrollIntensity}
      data-fx-3d={fx3d}
      data-fx-3d-i={fx.effect3dIntensity}
      style={
        {
          borderRadius: radius,
          '--k3': (fx.effect3dIntensity / 100).toFixed(2),
          '--ks': (fx.scrollIntensity / 100).toFixed(2),
        } as React.CSSProperties
      }
    >
      <div className="sf-fx-3d" style={{ borderRadius: radius }}>
        <div className="sf-fx-inner">
          <img src={src} alt={alt || ''} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
          {hasAfter &&           <img className="sf-fx-after" src={secondary} alt={secondaryAlt || ''} referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
        </div>
      </div>
    </div>
  );
}

export function BlockRenderer({
  block,
  blockIndex,
  theme,
  viewport,
  isSelected,
  isFirst,
  isLast,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  onDragStartBlock,
  onDragEndBlock,
  onCommitText,
  previewMode = false,
  layoutMode,
  navbarConfig = DEFAULT_NAVBAR_CONFIG,
  onNavigatePage,
}: BlockRendererProps) {
  const [openFaqIdx, setOpenFaqIdx] = useState<number>(0);
  const [contactSent, setContactSent] = useState<boolean>(false);
  const [navOpen, setNavOpen] = useState(false);

  const p = theme.palette;
  const primary = sanitizeColor(block.styleOverride?.accentColor || p.primary, '#1B4332');
  const surfaceTone = computeBlockSurfaceColors(block, blockIndex, theme);
  const bg = sanitizeColor(surfaceTone.bg, '#F7F6F2');
  const cardBg = sanitizeColor(surfaceTone.cardBg, '#ECEBE4');
  const text = sanitizeColor(surfaceTone.text, '#111111');
  const muted = sanitizeColor(surfaceTone.muted, '#525252');
  const onPrimary = getContrastTextColor(primary);

  const radius = RADIUS_PX[theme.borderRadius] ?? '4px';
  const btnRadius =
    theme.buttonStyle === 'pill-clean'
      ? '9999px'
      : theme.buttonStyle === 'soft'
        ? '8px'
        : theme.buttonStyle === 'editorial' || theme.buttonStyle === 'sharp' || theme.buttonStyle === 'offset-brutal'
          ? '0px'
          : radius;
  const btnShadow = theme.buttonStyle === 'offset-brutal' ? `3px 3px 0px ${text}` : 'none';
  const borderWidth = theme.borderStyle === 'strong' ? '1.5px' : '1px';
  const sectionPad = SPACING_PAD[theme.spacing] ?? '64px';
  const borderCol = theme.mode === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(17,17,17,0.15)';

  const headingFont = `'${theme.fonts.heading}', Georgia, serif`;
  const bodyFont = `'${theme.fonts.body}', system-ui, sans-serif`;

  const isMobile = viewport === 'mobile';
  const isTablet = viewport === 'tablet';

  const grid2Class = isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2';
  const grid3Class = isMobile ? 'grid-cols-1' : isTablet ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3';
  const grid4Class = isMobile ? 'grid-cols-1' : isTablet ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-4';
  const asymGridClass = isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-12';

  const c = block.content;
  const items = c.items ?? [];
  const def = getBlockDefinition(block.type);

  const renderInner = () => {
    switch (block.type) {
      case 'navbar':
        return (
          <header
            style={{
              backgroundColor: `color-mix(in srgb, ${bg} ${navbarConfig.opacity}%, transparent)`,
              borderBottom: `${borderWidth} solid color-mix(in srgb, ${borderCol} ${navbarConfig.borderOpacity}%, transparent)`,
              color: text,
              fontFamily: bodyFont,
              backdropFilter: `blur(${navbarConfig.blurPx}px) saturate(185%)`,
              WebkitBackdropFilter: `blur(${navbarConfig.blurPx}px) saturate(185%)`,
              borderRadius: navbarConfig.borderRadiusPx,
              '--nav-bg': `color-mix(in srgb, ${bg} ${navbarConfig.opacity}%, transparent)`,
              '--nav-blur': `${navbarConfig.blurPx}px`,
              '--nav-radius': `${navbarConfig.borderRadiusPx}px`,
              '--nav-border': `color-mix(in srgb, ${borderCol} ${navbarConfig.borderOpacity}%, transparent)`,
            } as React.CSSProperties}
            className={`sf-navbar-preview px-6 py-4 ${navbarConfig.variant === 'floating-pill' ? 'sf-navbar-pill' : navbarConfig.variant === 'floating-wide' ? 'sf-navbar-wide' : navbarConfig.variant === 'sidebar-drawer' ? 'sf-navbar-drawer' : ''}`}
          >
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
              {block.variant === 'centered' && !isMobile && (
                <nav className="hidden md:flex items-center gap-5 text-sm" style={{ color: muted }}>
                  {items.slice(0, 2).map((it) => (
                    <a key={it.id} href={it.linkHref || '#'} onClick={(e) => { if (it.linkHref?.startsWith('#page-')) { e.preventDefault(); onNavigatePage?.(it.linkHref.slice(6)); } else if (it.linkHref?.startsWith('#')) { e.preventDefault(); document.querySelector(it.linkHref)?.scrollIntoView({ behavior: 'smooth' }); } }} className="whitespace-nowrap text-inherit no-underline">{it.title}</a>
                  ))}
                </nav>
              )}

              <span style={{ fontFamily: headingFont }} className="font-bold text-lg whitespace-nowrap tracking-tight">
                <TodoText value={c.brandName} fallback="Mon Site" field="brandName" />
              </span>

              {block.variant !== 'minimal' && !isMobile && (
                <nav className="hidden md:flex items-center gap-6 text-sm" style={{ color: muted }}>
                  {(block.variant === 'centered' ? items.slice(2, 4) : items).map((it) => (
                    <a key={it.id} href={it.linkHref || '#'} onClick={(e) => { if (it.linkHref?.startsWith('#page-')) { e.preventDefault(); onNavigatePage?.(it.linkHref.slice(6)); } else if (it.linkHref?.startsWith('#')) { e.preventDefault(); document.querySelector(it.linkHref)?.scrollIntoView({ behavior: 'smooth' }); } }} className="whitespace-nowrap text-inherit no-underline">{it.title}</a>
                  ))}
                </nav>
              )}

              {c.ctaLabel && (
                <span
                  style={{
                    backgroundColor: primary,
                    color: onPrimary,
                    borderRadius: btnRadius,
                    boxShadow: btnShadow,
                  }}
                  className="px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0"
                >
                  <TodoText value={c.ctaLabel} field="ctaLabel" />
                </span>
              )}
              {items.length > 0 && (
                <button
                  type="button"
                  aria-expanded={navOpen}
                  aria-label={navOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                  onClick={() => setNavOpen((open) => !open)}
                  className="sf-nav-toggle-preview md:hidden p-2 rounded-sm border border-current/20"
                >
                  {navOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
                </button>
              )}
            </div>
            {navOpen && (
              <>
                <button type="button" aria-label="Fermer le menu" onClick={() => setNavOpen(false)} className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm md:hidden" />
                <nav aria-label="Navigation mobile" className="absolute z-40 left-3 right-3 top-full mt-2 p-4 space-y-3 rounded-xl border border-white/30 bg-white/80 text-[#1C1917] shadow-xl backdrop-blur-2xl md:hidden">
                  {items.map((item) => (
                    <a key={item.id} href={item.linkHref || '#'} onClick={(e) => { setNavOpen(false); if (item.linkHref?.startsWith('#page-')) { e.preventDefault(); onNavigatePage?.(item.linkHref.slice(6)); } else if (item.linkHref?.startsWith('#')) { e.preventDefault(); document.querySelector(item.linkHref)?.scrollIntoView({ behavior: 'smooth' }); } }} className="block py-2 text-sm font-medium">{item.title}</a>
                  ))}
                </nav>
              </>
            )}
          </header>
        );

      case 'hero': {
        if (block.variant === 'editorial') {
          return (
            <section
              style={{
                backgroundColor: bg,
                color: text,
                fontFamily: bodyFont,
                padding: `${sectionPad} 24px`,
                borderBottom: `1px solid ${borderCol}`,
              }}
            >
              <div className="max-w-6xl mx-auto space-y-6">
                <div className="space-y-4 max-w-4xl">
                  {c.kicker && (
                    <span style={{ color: primary }} className="block text-xs font-semibold uppercase tracking-widest">
                      <TodoText value={c.kicker} field="kicker" />
                    </span>
                  )}
                  <h1
                    style={{ fontFamily: headingFont }}
                    className={`${isMobile ? 'text-4xl' : 'text-3xl md:text-5xl lg:text-6xl'} font-semibold leading-[1.04] tracking-tight text-balance`}
                  >
                    <TodoText value={c.heading} field="heading" />
                  </h1>
                </div>
                <div className={`grid ${asymGridClass} gap-6 items-end`}>
                  <div className={isMobile ? '' : 'md:col-span-7'}>
                    {c.subheading && (
                      <p style={{ color: muted }} className="text-base md:text-lg leading-relaxed max-w-xl">
                        <TodoText value={c.subheading} field="subheading" />
                      </p>
                    )}
                  </div>
                  <div className={`${isMobile ? '' : 'md:col-span-5 md:justify-end'} flex-wrap gap-3 flex`}>
                    {c.ctaLabel && (
                      <span
                        style={{ backgroundColor: primary, color: onPrimary, borderRadius: btnRadius, boxShadow: btnShadow }}
                        className="px-5 py-2.5 text-sm font-semibold"
                      >
                        <TodoText value={c.ctaLabel} field="ctaLabel" />
                      </span>
                    )}
                    {c.secondaryCtaLabel && (
                      <span
                        style={{ border: `${borderWidth} solid ${text}`, borderRadius: btnRadius, color: text }}
                        className="px-5 py-2.5 text-sm font-semibold"
                      >
                        <TodoText value={c.secondaryCtaLabel} field="secondaryCtaLabel" />
                      </span>
                    )}
                  </div>
                </div>
                <PreviewImage src={c.image} alt={c.imageAlt || c.heading} aspectClass="aspect-[21/9]" radius={radius} effect={c.imageEffect} secondary={c.secondaryImage} secondaryAlt={c.secondaryImageAlt} />
              </div>
            </section>
          );
        }

        const isCentered = block.variant === 'centered';
        return (
          <section
            style={{
              backgroundColor: bg,
              color: text,
              fontFamily: bodyFont,
              padding: `${sectionPad} 24px`,
              borderBottom: `1px solid ${borderCol}`,
            }}
          >
            <div
              className={`max-w-6xl mx-auto ${
                isCentered ? 'text-center space-y-6' : `grid ${asymGridClass} gap-10 items-center`
              }`}
            >
              <div className={isCentered ? 'max-w-2xl mx-auto space-y-4' : `${isMobile ? '' : 'md:col-span-7'} space-y-4`}>
                {c.kicker && (
                  <span style={{ color: primary }} className="block text-xs font-semibold uppercase tracking-widest">
                    <TodoText value={c.kicker} field="kicker" />
                  </span>
                )}
                <h1
                  style={{ fontFamily: headingFont }}
                  className={`${isMobile ? 'text-3xl' : 'text-3xl md:text-4xl lg:text-6xl'} font-semibold leading-[1.06] tracking-tight text-balance`}
                >
                  <TodoText value={c.heading} field="heading" />
                </h1>
                {c.subheading && (
                  <p style={{ color: muted }} className="text-base leading-relaxed max-w-xl">
                    <TodoText value={c.subheading} field="subheading" />
                  </p>
                )}
                <div className={`flex flex-wrap gap-3 pt-2 ${isCentered ? 'justify-center' : ''}`}>
                  {c.ctaLabel && (
                    <span
                      style={{ backgroundColor: primary, color: onPrimary, borderRadius: btnRadius, boxShadow: btnShadow }}
                      className="px-5 py-2.5 text-sm font-semibold"
                    >
                      <TodoText value={c.ctaLabel} field="ctaLabel" />
                    </span>
                  )}
                  {c.secondaryCtaLabel && (
                    <span
                      style={{ border: `${borderWidth} solid ${text}`, borderRadius: btnRadius, color: text }}
                      className="px-5 py-2.5 text-sm font-semibold"
                    >
                      <TodoText value={c.secondaryCtaLabel} field="secondaryCtaLabel" />
                    </span>
                  )}
                </div>
              </div>
              <div className={isCentered ? 'max-w-4xl mx-auto w-full' : isMobile ? '' : 'md:col-span-5'}>
                <PreviewImage
                  src={c.image}
                  alt={c.imageAlt || c.heading}
                  aspectClass={isCentered ? 'aspect-video' : 'aspect-[4/3]'}
                  radius={radius}
                  effect={c.imageEffect}
                  secondary={c.secondaryImage}
                  secondaryAlt={c.secondaryImageAlt}
                />
              </div>
            </div>
          </section>
        );
      }

      case 'about': {
        const mediaCol = (
          <div className={isMobile ? '' : 'md:col-span-5'}>
            <PreviewImage src={c.image} alt={c.imageAlt || c.heading} aspectClass="aspect-[4/3]" radius={radius} effect={c.imageEffect} secondary={c.secondaryImage} secondaryAlt={c.secondaryImageAlt} />
          </div>
        );
        const textCol = (
          <div className={`${isMobile ? '' : 'md:col-span-7'} space-y-4`}>
            {c.kicker && (
              <span style={{ color: primary }} className="block text-xs font-semibold uppercase tracking-widest">
                <TodoText value={c.kicker} field="kicker" />
              </span>
            )}
            <h2 style={{ fontFamily: headingFont }} className="text-3xl md:text-4xl font-semibold leading-[1.1] text-balance">
              <TodoText value={c.heading} field="heading" />
            </h2>
            {c.body && (
              <p style={{ color: muted }} className="text-sm md:text-base leading-relaxed max-w-xl">
                <TodoText value={c.body} field="body" />
              </p>
            )}
            {c.ctaLabel && (
              <span
                style={{ border: `${borderWidth} solid ${text}`, borderRadius: btnRadius }}
                className="inline-block px-4 py-2 text-sm font-semibold"
              >
                <TodoText value={c.ctaLabel} field="ctaLabel" />
              </span>
            )}
          </div>
        );

        return (
          <section
            style={{
              backgroundColor: bg,
              color: text,
              fontFamily: bodyFont,
              padding: `${sectionPad} 24px`,
              borderBottom: `1px solid ${borderCol}`,
            }}
          >
            <div className={`max-w-6xl mx-auto grid ${asymGridClass} gap-10 items-center`}>
              {block.variant === 'media-left' ? (
                <>
                  {mediaCol}
                  {textCol}
                </>
              ) : (
                <>
                  {textCol}
                  {mediaCol}
                </>
              )}
            </div>
          </section>
        );
      }

      case 'services':
        return (
          <section
            style={{
              backgroundColor: bg,
              color: text,
              fontFamily: bodyFont,
              padding: `${sectionPad} 24px`,
              borderBottom: `1px solid ${borderCol}`,
            }}
          >
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="max-w-2xl space-y-2">
                {c.kicker && (
                  <span style={{ color: primary }} className="block text-xs font-semibold uppercase tracking-widest">
                    <TodoText value={c.kicker} field="kicker" />
                  </span>
                )}
                <h2 style={{ fontFamily: headingFont }} className="text-3xl md:text-4xl font-semibold leading-[1.1] text-balance">
                  <TodoText value={c.heading} field="heading" />
                </h2>
                {c.subheading && (
                  <p style={{ color: muted }} className="text-sm md:text-base">
                    <TodoText value={c.subheading} field="subheading" />
                  </p>
                )}
              </div>

              {block.variant === 'numbered-list' ? (
                <div style={{ borderTop: `1px solid ${borderCol}` }}>
                  {items.map((it, idx) => (
                    <div
                      key={it.id}
                      style={{ borderBottom: `1px solid ${borderCol}` }}
                      className="py-5 flex flex-wrap items-baseline justify-between gap-4"
                    >
                      <div className="space-y-1 max-w-2xl">
                        <span style={{ color: primary }} className="text-xs font-semibold tabular-nums">
                          0{idx + 1}.
                        </span>
                        <h3 style={{ fontFamily: headingFont }} className="text-xl font-semibold">
                          <TodoText value={it.title} field="title" itemId={it.id} />
                        </h3>
                        <p style={{ color: muted }} className="text-sm">
                          <TodoText value={it.description} field="description" itemId={it.id} />
                        </p>
                      </div>
                      {it.meta && (
                        <span style={{ color: muted }} className="text-xs font-medium">
                          {it.meta}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`grid ${grid3Class} gap-5`}>
                  {items.map((it, idx) => (
                    <div
                      key={it.id}
                      style={{
                        backgroundColor: cardBg,
                        border: `${borderWidth} solid ${borderCol}`,
                        borderRadius: radius,
                      }}
                      className={`p-5 space-y-2 ${block.variant === 'bento' && idx === 0 && !isMobile ? 'md:col-span-2' : ''}`}
                    >
                      {it.meta && (
                        <span style={{ color: primary }} className="block text-xs font-semibold uppercase tracking-wider">
                          {it.meta}
                        </span>
                      )}
                      <h3 style={{ fontFamily: headingFont }} className="text-lg font-semibold">
                        <TodoText value={it.title} field="title" itemId={it.id} />
                      </h3>
                      <p style={{ color: muted }} className="text-sm leading-relaxed">
                        <TodoText value={it.description} field="description" itemId={it.id} />
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        );

      case 'gallery':
        return (
          <section
            style={{
              backgroundColor: bg,
              color: text,
              fontFamily: bodyFont,
              padding: `${sectionPad} 24px`,
              borderBottom: `1px solid ${borderCol}`,
            }}
          >
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="space-y-2 max-w-2xl">
                {c.kicker && (
                  <span style={{ color: primary }} className="block text-xs font-semibold uppercase tracking-widest">
                    <TodoText value={c.kicker} field="kicker" />
                  </span>
                )}
                <h2 style={{ fontFamily: headingFont }} className="text-3xl md:text-4xl font-semibold leading-[1.1] text-balance">
                  {c.heading}
                </h2>
                {c.subheading && (
                  <p style={{ color: muted }} className="text-sm">
                    {c.subheading}
                  </p>
                )}
              </div>
              <div className={`grid ${block.variant === 'showcase-2' ? grid2Class : grid3Class} gap-5`}>
                {items.map((it, idx) => (
                  <figure
                    key={it.id}
                    className={`space-y-2 ${block.variant === 'masonry-grid' && idx === 0 && !isMobile ? 'md:col-span-2' : ''}`}
                  >
                    <PreviewImage src={it.image} alt={it.imageAlt || it.title} aspectClass="aspect-[4/3]" radius={radius} effect={it.imageEffect} />
                    <figcaption>
                      <div className="font-semibold text-sm">
                        <TodoText value={it.title} field="title" itemId={it.id} />
                      </div>
                      {it.subtitle && (
                        <div style={{ color: muted }} className="text-xs">
                          <TodoText value={it.subtitle} field="subtitle" itemId={it.id} />
                        </div>
                      )}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        );

      case 'products':
        return (
          <section
            style={{
              backgroundColor: bg,
              color: text,
              fontFamily: bodyFont,
              padding: `${sectionPad} 24px`,
              borderBottom: `1px solid ${borderCol}`,
            }}
          >
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="space-y-2 max-w-2xl">
                {c.kicker && (
                  <span style={{ color: primary }} className="block text-xs font-semibold uppercase tracking-widest">
                    <TodoText value={c.kicker} field="kicker" />
                  </span>
                )}
                <h2 style={{ fontFamily: headingFont }} className="text-3xl md:text-4xl font-semibold leading-[1.1] text-balance">
                  {c.heading}
                </h2>
                {c.subheading && (
                  <p style={{ color: muted }} className="text-sm">
                    {c.subheading}
                  </p>
                )}
              </div>
              <div
                className={`grid ${
                  block.variant === 'compact-grid'
                    ? grid2Class
                    : block.variant === 'featured-list'
                      ? 'grid-cols-1'
                      : grid3Class
                } gap-5`}
              >
                {items.map((it) => (
                  <article
                    key={it.id}
                    style={{ backgroundColor: cardBg, border: `${borderWidth} solid ${borderCol}`, borderRadius: radius }}
                    className={`p-5 flex ${
                      block.variant === 'featured-list' && !isMobile
                        ? 'flex-col md:flex-row md:items-center gap-6'
                        : 'flex-col justify-between gap-4'
                    }`}
                  >
                    <div className={block.variant === 'featured-list' && !isMobile ? 'md:w-56 shrink-0' : ''}>
                      <PreviewImage src={it.image} alt={it.imageAlt || it.title} aspectClass="aspect-[4/3]" radius={radius} effect={it.imageEffect} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 style={{ fontFamily: headingFont }} className="font-semibold text-lg">
                          <TodoText value={it.title} field="title" itemId={it.id} />
                        </h3>
                        <span className="font-bold text-sm tabular-nums">
                          <TodoText value={it.price || 'À compléter'} field="price" itemId={it.id} />
                        </span>
                      </div>
                      <p style={{ color: muted }} className="text-sm">
                        <TodoText value={it.description} field="description" itemId={it.id} />
                      </p>
                      {it.linkLabel && (
                        <span
                          style={{ border: `${borderWidth} solid ${text}`, borderRadius: btnRadius }}
                          className="inline-block px-3.5 py-1.5 text-xs font-semibold mt-2"
                        >
                          {it.linkLabel}
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        );

      case 'pricing':
        return (
          <section
            style={{
              backgroundColor: bg,
              color: text,
              fontFamily: bodyFont,
              padding: `${sectionPad} 24px`,
              borderBottom: `1px solid ${borderCol}`,
            }}
          >
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="space-y-2 max-w-2xl">
                {c.kicker && (
                  <span style={{ color: primary }} className="block text-xs font-semibold uppercase tracking-widest">
                    <TodoText value={c.kicker} field="kicker" />
                  </span>
                )}
                <h2 style={{ fontFamily: headingFont }} className="text-3xl md:text-4xl font-semibold leading-[1.1] text-balance">
                  {c.heading}
                </h2>
                {c.subheading && (
                  <p style={{ color: muted }} className="text-sm">
                    {c.subheading}
                  </p>
                )}
              </div>
              <div className={`grid ${block.variant === 'two-columns' ? grid2Class : grid3Class} gap-5 items-stretch`}>
                {items.map((it) => (
                  <article
                    key={it.id}
                    style={{
                      backgroundColor: cardBg,
                      border: `${borderWidth} solid ${it.highlighted ? primary : borderCol}`,
                      borderRadius: radius,
                    }}
                    className="p-6 flex flex-col justify-between gap-5"
                  >
                    <div className="space-y-3">
                      <div>
                        <h3 style={{ fontFamily: headingFont }} className="font-bold text-xl">
                          <TodoText value={it.title} field="title" itemId={it.id} />
                        </h3>
                        {it.meta && (
                          <div style={{ color: muted }} className="text-xs">
                            {it.meta}
                          </div>
                        )}
                      </div>
                      <div style={{ fontFamily: headingFont }} className="text-3xl font-semibold tabular-nums">
                        <TodoText value={it.price || 'À compléter'} field="price" itemId={it.id} />
                      </div>
                      <p style={{ color: muted }} className="text-sm">
                        <TodoText value={it.description} field="description" itemId={it.id} />
                      </p>
                      {it.features && it.features.length > 0 && (
                        <ul className="space-y-1.5 pt-2 text-xs">
                          {it.features.map((f, fi) => (
                            <li key={fi} className="flex items-center gap-2">
                              <Check className="w-3.5 h-3.5 shrink-0" style={{ color: primary }} aria-hidden="true" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {it.linkLabel && (
                      <span
                        style={{
                          backgroundColor: it.highlighted ? primary : 'transparent',
                          color: it.highlighted ? onPrimary : text,
                          border: it.highlighted ? 'none' : `${borderWidth} solid ${text}`,
                          borderRadius: btnRadius,
                          boxShadow: it.highlighted ? btnShadow : 'none',
                        }}
                        className="block text-center px-4 py-2.5 text-xs font-semibold"
                      >
                        {it.linkLabel}
                      </span>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </section>
        );

      case 'testimonials':
        return (
          <section
            style={{
              backgroundColor: bg,
              color: text,
              fontFamily: bodyFont,
              padding: `${sectionPad} 24px`,
              borderBottom: `1px solid ${borderCol}`,
            }}
          >
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="space-y-2">
                {c.kicker && (
                  <span style={{ color: primary }} className="block text-xs font-semibold uppercase tracking-widest">
                    <TodoText value={c.kicker} field="kicker" />
                  </span>
                )}
                <h2 style={{ fontFamily: headingFont }} className="text-3xl md:text-4xl font-semibold leading-[1.1] text-balance">
                  {c.heading}
                </h2>
              </div>
              <div
                className={`grid ${
                  block.variant === 'spotlight'
                    ? 'grid-cols-1'
                    : block.variant === 'two-column-quotes'
                      ? grid2Class
                      : grid3Class
                } gap-5`}
              >
                {(block.variant === 'spotlight' ? items.slice(0, 1) : items).map((it) => (
                  <blockquote
                    key={it.id}
                    style={{ backgroundColor: cardBg, border: `${borderWidth} solid ${borderCol}`, borderRadius: radius }}
                    className="p-6 flex flex-col justify-between gap-4"
                  >
                    <p className="text-sm md:text-base leading-relaxed">
                      <TodoText value={it.description || 'À compléter'} field="description" itemId={it.id} />
                    </p>
                    <footer>
                      <div className="font-semibold text-sm">
                        <TodoText value={it.title} field="title" itemId={it.id} />
                      </div>
                      {it.subtitle && (
                        <div style={{ color: muted }} className="text-xs">
                          <TodoText value={it.subtitle} field="subtitle" itemId={it.id} />
                        </div>
                      )}
                    </footer>
                  </blockquote>
                ))}
              </div>
            </div>
          </section>
        );

      case 'faq':
        return (
          <section
            style={{
              backgroundColor: bg,
              color: text,
              fontFamily: bodyFont,
              padding: `${sectionPad} 24px`,
              borderBottom: `1px solid ${borderCol}`,
            }}
          >
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="space-y-2">
                {c.kicker && (
                  <span style={{ color: primary }} className="block text-xs font-semibold uppercase tracking-widest">
                    <TodoText value={c.kicker} field="kicker" />
                  </span>
                )}
                <h2 style={{ fontFamily: headingFont }} className="text-3xl md:text-4xl font-semibold leading-[1.1] text-balance">
                  {c.heading}
                </h2>
              </div>
              <div
                className={block.variant === 'two-columns' ? `grid ${grid2Class} gap-6` : 'divide-y'}
                style={{ borderColor: borderCol }}
              >
                {items.map((it, idx) => {
                  const isOpen = block.variant === 'two-columns' || openFaqIdx === idx;
                  return (
                    <div key={it.id} className="py-4" style={{ borderColor: borderCol }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenFaqIdx(openFaqIdx === idx ? -1 : idx);
                        }}
                        className="w-full text-left flex items-center justify-between gap-4 font-semibold text-base cursor-pointer"
                        style={{ fontFamily: headingFont }}
                      >
                        <span>{it.title}</span>
                        {block.variant !== 'two-columns' && <span aria-hidden="true">{isOpen ? '−' : '+'}</span>}
                      </button>
                      {isOpen && (
                        <p style={{ color: muted }} className="text-sm mt-2 leading-relaxed">
                          <TodoText value={it.description} field="description" itemId={it.id} />
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );

      case 'stats':
        return (
          <section
            style={{
              backgroundColor: bg,
              color: text,
              fontFamily: bodyFont,
              padding: `${sectionPad} 24px`,
              borderBottom: `1px solid ${borderCol}`,
            }}
          >
            <div className="max-w-6xl mx-auto space-y-6">
              {c.heading && (
                <div className="space-y-1">
                  {c.kicker && (
                    <span style={{ color: primary }} className="block text-xs font-semibold uppercase tracking-widest">
                      <TodoText value={c.kicker} field="kicker" />
                    </span>
                  )}
                  <h2 style={{ fontFamily: headingFont }} className="text-3xl font-semibold leading-[1.1] text-balance">
                    {c.heading}
                  </h2>
                </div>
              )}
              <div className={`grid ${items.length >= 4 && block.variant === 'bar-4' ? grid4Class : grid3Class} gap-4`}>
                {items.map((it) => (
                  <div
                    key={it.id}
                    style={{ backgroundColor: cardBg, border: `${borderWidth} solid ${borderCol}`, borderRadius: radius }}
                    className="p-5 space-y-1"
                  >
                    <div style={{ fontFamily: headingFont, color: primary }} className="text-3xl font-semibold tabular-nums">
                      <TodoText value={it.title} field="title" itemId={it.id} />
                    </div>
                    <div className="font-semibold text-sm">{it.subtitle}</div>
                    {it.meta && (
                      <div style={{ color: muted }} className="text-xs">
                        {it.meta}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        );

      case 'team':
        return (
          <section
            style={{
              backgroundColor: bg,
              color: text,
              fontFamily: bodyFont,
              padding: `${sectionPad} 24px`,
              borderBottom: `1px solid ${borderCol}`,
            }}
          >
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="space-y-2">
                {c.kicker && (
                  <span style={{ color: primary }} className="block text-xs font-semibold uppercase tracking-widest">
                    <TodoText value={c.kicker} field="kicker" />
                  </span>
                )}
                <h2 style={{ fontFamily: headingFont }} className="text-3xl md:text-4xl font-semibold leading-[1.1] text-balance">
                  {c.heading}
                </h2>
              </div>
              <div className={`grid ${block.variant === 'list-2' ? grid2Class : grid3Class} gap-5`}>
                {items.map((it) => (
                  <article
                    key={it.id}
                    style={{ backgroundColor: cardBg, border: `${borderWidth} solid ${borderCol}`, borderRadius: radius }}
                    className="p-5 space-y-3"
                  >
                    <PreviewImage src={it.image} alt={it.imageAlt || it.title} aspectClass="aspect-square" radius={radius} effect={it.imageEffect} />
                    <div>
                      <h3 style={{ fontFamily: headingFont }} className="font-bold text-lg">
                        <TodoText value={it.title} field="title" itemId={it.id} />
                      </h3>
                      {it.subtitle && (
                        <div style={{ color: primary }} className="text-xs font-semibold">
                          <TodoText value={it.subtitle} field="subtitle" itemId={it.id} />
                        </div>
                      )}
                    </div>
                    <p style={{ color: muted }} className="text-sm">
                      <TodoText value={it.description} field="description" itemId={it.id} />
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        );

      case 'logos':
        return (
          <section
            style={{
              backgroundColor: bg,
              color: text,
              fontFamily: bodyFont,
              padding: `${sectionPad} 24px`,
              borderBottom: `1px solid ${borderCol}`,
            }}
          >
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="space-y-2 max-w-2xl">
                {c.kicker && (
                  <span style={{ color: primary }} className="block text-xs font-semibold uppercase tracking-widest">
                    <TodoText value={c.kicker} field="kicker" />
                  </span>
                )}
                <h2 style={{ fontFamily: headingFont }} className="text-3xl font-semibold leading-[1.1] text-balance">
                  {c.heading}
                </h2>
                {c.subheading && (
                  <p style={{ color: muted }} className="text-sm">
                    {c.subheading}
                  </p>
                )}
              </div>
              <div className={`grid ${block.variant === 'grid-4' ? grid4Class : grid3Class} gap-4`}>
                {items.map((it) => (
                  <div
                    key={it.id}
                    style={{ backgroundColor: cardBg, border: `${borderWidth} solid ${borderCol}`, borderRadius: radius }}
                    className="p-4 space-y-1"
                  >
                    <div style={{ fontFamily: headingFont }} className="font-semibold text-base">
                      <TodoText value={it.title} field="title" itemId={it.id} />
                    </div>
                    {it.subtitle && (
                      <div style={{ color: muted }} className="text-xs">
                        {it.subtitle}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        );

      case 'cta':
        return (
          <section
            style={{
              backgroundColor: bg,
              color: text,
              fontFamily: bodyFont,
              padding: `${sectionPad} 24px`,
              borderBottom: `1px solid ${borderCol}`,
            }}
          >
            <div
              className={`max-w-6xl mx-auto ${
                block.variant === 'minimal-center'
                  ? 'text-center space-y-4 max-w-2xl'
                  : `flex flex-wrap items-center justify-between gap-8`
              }`}
            >
              <div className="space-y-2 max-w-xl">
                {c.kicker && (
                  <span style={{ color: primary }} className="block text-xs font-semibold uppercase tracking-widest">
                    <TodoText value={c.kicker} field="kicker" />
                  </span>
                )}
                <h2 style={{ fontFamily: headingFont }} className="text-3xl md:text-4xl font-semibold leading-[1.08] text-balance">
                  {c.heading}
                </h2>
                {c.subheading && <p className="text-sm opacity-80">{c.subheading}</p>}
              </div>
              {c.ctaLabel && (
                <span
                  style={{ backgroundColor: primary, color: onPrimary, borderRadius: btnRadius, boxShadow: btnShadow }}
                  className="inline-block px-6 py-3 text-sm font-semibold whitespace-nowrap shrink-0"
                >
                  <TodoText value={c.ctaLabel} field="ctaLabel" />
                </span>
              )}
            </div>
          </section>
        );

      case 'contact':
        return (
          <section
            style={{
              backgroundColor: bg,
              color: text,
              fontFamily: bodyFont,
              padding: `${sectionPad} 24px`,
              borderBottom: `1px solid ${borderCol}`,
            }}
          >
            <div
              className={`max-w-6xl mx-auto grid ${
                block.variant === 'centered-form' ? 'grid-cols-1 max-w-xl' : asymGridClass
              } gap-10 items-start`}
            >
              <div className={`${block.variant === 'centered-form' || isMobile ? '' : 'md:col-span-5'} space-y-3`}>
                {c.kicker && (
                  <span style={{ color: primary }} className="block text-xs font-semibold uppercase tracking-widest">
                    <TodoText value={c.kicker} field="kicker" />
                  </span>
                )}
                <h2 style={{ fontFamily: headingFont }} className="text-3xl md:text-4xl font-semibold leading-[1.1] text-balance">
                  {c.heading}
                </h2>
                {c.subheading && (
                  <p style={{ color: muted }} className="text-sm">
                    {c.subheading}
                  </p>
                )}
                <div style={{ color: muted }} className="space-y-2 text-sm pt-2">
                  <div>
                    <strong>E-mail :</strong> <TodoText value={c.email || 'À compléter'} field="email" />
                  </div>
                  <div>
                    <strong>Téléphone :</strong> <TodoText value={c.phone || 'À compléter'} field="phone" />
                  </div>
                  <div>
                    <strong>Adresse :</strong> <TodoText value={c.address || 'À compléter'} field="address" />
                  </div>
                </div>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContactSent(true);
                }}
                style={{ backgroundColor: cardBg, border: `${borderWidth} solid ${borderCol}`, borderRadius: radius }}
                className={`${block.variant === 'centered-form' || isMobile ? '' : 'md:col-span-7'} p-6 space-y-4`}
              >
                <div>
                  <label className="block text-xs font-semibold mb-1">Nom complet</label>
                  <input
                    type="text"
                    placeholder="Votre nom"
                    onClick={(e) => e.stopPropagation()}
                    style={{ backgroundColor: bg, border: `1px solid ${borderCol}`, borderRadius: radius }}
                    className="w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">E-mail</label>
                  <input
                    type="email"
                    placeholder="nom@exemple.fr"
                    onClick={(e) => e.stopPropagation()}
                    style={{ backgroundColor: bg, border: `1px solid ${borderCol}`, borderRadius: radius }}
                    className="w-full px-3 py-2 text-sm"
                  />
                </div>
                {block.variant === 'devis' &&
                  ['Service ou produit concerné', 'Budget envisagé (facultatif)', 'Délai souhaité (facultatif)'].map((label) => (
                    <div key={label}>
                      <label className="block text-xs font-semibold mb-1">{label}</label>
                      <input
                        type="text"
                        onClick={(e) => e.stopPropagation()}
                        style={{ backgroundColor: bg, border: `1px solid ${borderCol}`, borderRadius: radius }}
                        className="w-full px-3 py-2 text-sm"
                      />
                    </div>
                  ))}
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    {block.variant === 'devis' ? 'Détails de votre demande' : 'Message'}
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Décrivez votre besoin..."
                    onClick={(e) => e.stopPropagation()}
                    style={{ backgroundColor: bg, border: `1px solid ${borderCol}`, borderRadius: radius }}
                    className="w-full px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  onClick={(e) => e.stopPropagation()}
                  style={{ backgroundColor: primary, color: onPrimary, borderRadius: btnRadius, boxShadow: btnShadow }}
                  className="w-full py-2.5 px-4 text-sm font-semibold cursor-pointer"
                >
                  {c.ctaLabel || 'Envoyer'}
                </button>
                {contactSent && (
                  <p style={{ color: primary }} className="text-xs font-medium">
                    Aperçu de l’éditeur : rien n’est envoyé. Cliquez sur « Tester le site » pour essayer le vrai formulaire.
                  </p>
                )}
              </form>
            </div>
          </section>
        );

      case 'footer':
        return (
          <footer
            style={{
              backgroundColor: bg,
              borderTop: `${borderWidth} solid ${borderCol}`,
              color: text,
              fontFamily: bodyFont,
            }}
            className="px-6 py-10"
          >
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                  <div style={{ fontFamily: headingFont }} className="font-bold text-lg">
                    <TodoText value={c.brandName} fallback="Mon Site" field="brandName" />
                  </div>
                  {c.subheading && (
                    <p style={{ color: muted }} className="text-xs mt-1">
                      {c.subheading}
                    </p>
                  )}
                </div>
                <nav className="flex flex-wrap gap-5 text-xs" style={{ color: muted }}>
                  {items.map((it) => (
                    <span key={it.id}>{it.title}</span>
                  ))}
                </nav>
              </div>
              <div style={{ borderTop: `1px solid ${borderCol}`, color: muted }} className="pt-4 text-xs">
                {c.copyright}
              </div>
            </div>
          </footer>
        );
    }
  };

  return (
    <div
      onClick={previewMode ? undefined : onSelect}
      data-block-id={block.id}
      data-anim={block.type !== 'navbar' && sanitizeSectionAnimation(block.animation) !== 'none' ? sanitizeSectionAnimation(block.animation) : undefined}
      data-story={layoutMode === 'scroll-story' && block.type !== 'navbar' && block.type !== 'footer' ? '' : undefined}
      style={{
        '--sf-anim-ms': `${clampDuration(block.animationDurationMs)}ms`,
        '--glass-opacity': `${(block.styleOverride?.opacity ?? 22) / 100}`,
        '--glass-blur': `${block.styleOverride?.blurPx ?? 24}px`,
        '--glass-border-opacity': `${(block.styleOverride?.opacity ?? 38) / 100}`,
        ...parseSafeBlockCss(block.styleOverride?.customCss),
        ...(block.styleOverride?.backgroundGradient ? { background: block.styleOverride.backgroundGradient } : {}),
        ...(block.styleOverride?.paddingY !== undefined ? { paddingBlock: `${block.styleOverride.paddingY}px` } : {}),
        ...(block.styleOverride?.borderRadius !== undefined ? { borderRadius: `${block.styleOverride.borderRadius}px` } : {}),
        ...(block.styleOverride?.shadowDepth !== undefined ? { boxShadow: `0 ${block.styleOverride.shadowDepth}px ${block.styleOverride.shadowDepth * 2}px rgba(15,23,42,.18)` } : {}),
      } as React.CSSProperties}
      className={`relative group transition-shadow ${
        previewMode
          ? ''
          : isSelected
            ? 'ring-2 ring-[#9A3412] ring-inset'
            : 'hover:ring-1 hover:ring-[#9A3412]/50 hover:ring-inset'
      } ${!block.visible ? 'opacity-45' : ''} ${(block.styleOverride?.glassMode || theme.liquidGlass) ? 'sf-liquid-glass' : ''}`}
    >
      <InlineEditProvider value={{ enabled: !previewMode && Boolean(onCommitText), commit: onCommitText ?? (() => {}) }}>
      {!previewMode && onDragStartBlock && (
        <div
          draggable
          onDragStart={onDragStartBlock}
          onDragEnd={onDragEndBlock}
          onClick={(e) => e.stopPropagation()}
          title="Glisser pour déplacer ce bloc"
          aria-label={`Déplacer ${def.label} : maintenir et glisser`}
          className={`absolute ${block.type === 'navbar' ? 'bottom-1 left-2' : 'top-2 left-2'} z-20 flex items-center gap-1 bg-[#1C1917] text-[#FBF8F3] rounded-sm pl-1 pr-2 py-1 text-[11px] font-medium cursor-grab active:cursor-grabbing transition-opacity ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <GripVertical className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{def.label}</span>
        </div>
      )}

      {!previewMode && isSelected && (
        <div
          className={`absolute ${block.type === 'navbar' ? 'bottom-1 right-2' : 'top-2 right-2'} z-20 flex items-center gap-1 bg-[#1C1917] text-[#FBF8F3] rounded-sm px-2 py-1 text-xs`}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="px-1.5 font-medium text-[11px] text-[#E5DEC9]">{def.label}</span>
          {!block.visible && <EyeOff className="w-3.5 h-3.5 text-amber-300" aria-label="Bloc masqué" />}
          <button
            type="button"
            onClick={() => onMove('up')}
            disabled={isFirst}
            aria-label={`Monter ${def.label}`}
            className="p-1 rounded-sm hover:bg-[#44403C] disabled:opacity-30 cursor-pointer"
          >
            <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onMove('down')}
            disabled={isLast}
            aria-label={`Descendre ${def.label}`}
            className="p-1 rounded-sm hover:bg-[#44403C] disabled:opacity-30 cursor-pointer"
          >
            <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            aria-label={`Dupliquer ${def.label}`}
            className="p-1 rounded-sm hover:bg-[#44403C] cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Supprimer ${def.label}`}
            className="p-1 rounded-sm hover:bg-red-700 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {renderInner()}
      </InlineEditProvider>
    </div>
  );
}

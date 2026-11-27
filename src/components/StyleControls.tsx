import { useEffect, useState } from 'react';
import type { HeaderNavStyle, NavbarConfig, SiteFonts, SiteLayoutMode, SitePalette, SiteTheme } from '../types/site';
import { generateAllHarmonies, normalizeHex } from '../utils/colorHarmony';
import { HEADER_STYLES, LAYOUT_MODES } from '../utils/effectsCatalog';
import { ensureGoogleFontLoaded, FONT_CATALOG, FONT_CATEGORY_LABELS, type FontCategory } from '../utils/fonts';
import { sanitizeFontName } from '../utils/validation';

const field = 'w-full px-2.5 py-1.5 text-xs bg-[#FFFFFF] border border-[#E5DEC9] rounded-sm';
const label = 'block text-xs font-semibold text-[#1C1917] mb-1';

type ColorRole = Exclude<keyof SitePalette, 'name'>;
const ROLES: Array<[ColorRole, string]> = [
  ['primary', 'Principale'],
  ['secondary', 'Secondaire'],
  ['background', 'Fond'],
  ['surface', 'Surface'],
  ['text', 'Texte'],
  ['mutedText', 'Texte atténué'],
];

function ColorRow({ role, text, value, onChange }: { role: ColorRole; text: string; value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const invalid = normalizeHex(draft) === null;
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={`${text} : sélecteur de couleur`}
        value={normalizeHex(value) ?? '#000000'}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="w-8 h-8 rounded-sm border border-[#E5DEC9] cursor-pointer p-0.5 bg-[#FFFFFF]"
      />
      <span className="text-xs w-24 shrink-0">{text}</span>
      <input
        type="text"
        aria-label={`${text} : code hexadécimal`}
        aria-invalid={invalid}
        value={draft}
        maxLength={7}
        onChange={(e) => {
          setDraft(e.target.value);
          const hex = normalizeHex(e.target.value);
          if (hex) onChange(hex);
        }}
        onBlur={() => setDraft(normalizeHex(draft) ?? value)}
        className={`${field} font-mono uppercase ${invalid ? 'border-red-400' : ''}`}
        data-role={role}
      />
    </div>
  );
}

/** Sélecteurs de couleur libres pour chaque rôle, avec générateur d'harmonies à partir de la couleur principale. */
export function ColorEditor({ theme, onChange }: { theme: SiteTheme; onChange: (theme: SiteTheme) => void }) {
  const p = theme.palette;
  const harmonies = generateAllHarmonies(p.primary, theme.mode === 'dark');
  return (
    <div className="space-y-3">
      <span className={label}>Couleurs</span>
      <div className="space-y-1.5">
        {ROLES.map(([role, text]) => (
          <ColorRow key={role} role={role} text={text} value={p[role]} onChange={(hex) => onChange({ ...theme, palette: { ...p, [role]: hex } })} />
        ))}
      </div>
      <div>
        <span className="block text-[11px] font-medium text-[#57534E] mb-1.5">Harmonies à partir de la couleur principale</span>
        <div className="grid grid-cols-1 gap-1.5">
          {harmonies.map((h) => (
            <button
              key={h.kind}
              type="button"
              onClick={() => onChange({ ...theme, palette: { ...h.palette, name: h.label } })}
              className="flex items-center justify-between gap-2 p-2 rounded-sm border border-[#E5DEC9] bg-[#FFFFFF] hover:border-[#9A3412] text-xs cursor-pointer"
            >
              <span>{h.label}</span>
              <span className="flex gap-0.5" aria-hidden="true">
                {[h.palette.background, h.palette.surface, h.palette.primary, h.palette.secondary, h.palette.text].map((c, i) => (
                  <span key={i} className="w-4 h-4 rounded-sm border border-black/10" style={{ background: c }} />
                ))}
              </span>
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-start gap-2 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={Boolean(theme.visitorThemeToggle)}
          onChange={(e) => onChange({ ...theme, visitorThemeToggle: e.target.checked })}
          className="mt-0.5 accent-[#9A3412]"
        />
        <span>
          Bouton clair / sombre pour le visiteur
          <span className="block text-[10px] text-[#57534E]">Présent sur la page et dans le site exporté ; la version alternative est calculée automatiquement.</span>
        </span>
      </label>
    </div>
  );
}

function FontOption({ name, selected, onPick }: { name: string; selected: boolean; onPick: () => void }) {
  useEffect(() => ensureGoogleFontLoaded(name), [name]);
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onPick}
      style={{ fontFamily: `'${name}', system-ui, sans-serif` }}
      className={`w-full text-left px-2.5 py-1.5 rounded-sm border text-sm cursor-pointer ${selected ? 'border-[#9A3412] bg-[#F4EFE6]' : 'border-[#E5DEC9] bg-[#FFFFFF] hover:border-[#9A3412]'}`}
    >
      {name}
      <span className="block text-[11px] text-[#57534E]" style={{ fontFamily: 'inherit' }}>
        Un texte d’exemple pour juger la forme des lettres.
      </span>
    </button>
  );
}

function FontPicker({ title, value, onPick }: { title: string; value: string; onPick: (name: string) => void }) {
  const [category, setCategory] = useState<FontCategory | 'all'>('all');
  const [custom, setCustom] = useState('');
  const list = FONT_CATALOG.filter((f) => category === 'all' || f.category === category);
  const inCatalog = FONT_CATALOG.some((f) => f.name === value);
  useEffect(() => ensureGoogleFontLoaded(value), [value]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className={label} style={{ marginBottom: 0 }}>
          {title}
        </span>
        <select aria-label={`Catégorie de police : ${title}`} value={category} onChange={(e) => setCategory(e.target.value as FontCategory | 'all')} className="px-2 py-1 text-[11px] border border-[#E5DEC9] rounded-sm bg-[#FFFFFF]">
          <option value="all">Toutes</option>
          {(Object.keys(FONT_CATEGORY_LABELS) as FontCategory[]).map((c) => (
            <option key={c} value={c}>
              {FONT_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>
      {!inCatalog && (
        <div className="text-[11px] text-[#57534E]" style={{ fontFamily: `'${value}', system-ui, sans-serif` }}>
          Police actuelle (personnalisée) : <strong>{value}</strong>
        </div>
      )}
      <div role="listbox" aria-label={title} className="max-h-52 overflow-y-auto editor-scroll space-y-1 pr-1">
        {list.map((f) => (
          <FontOption key={f.name} name={f.name} selected={f.name === value} onPick={() => onPick(f.name)} />
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && sanitizeFontName(custom, '')) {
              onPick(sanitizeFontName(custom, ''));
              setCustom('');
            }
          }}
          placeholder="Autre police Google Fonts (ex. Rubik Mono One)"
          aria-label={`Police Google Fonts personnalisée : ${title}`}
          className={field}
        />
        <button
          type="button"
          disabled={!sanitizeFontName(custom, '')}
          onClick={() => {
            onPick(sanitizeFontName(custom, ''));
            setCustom('');
          }}
          className="px-3 rounded-sm bg-[#9A3412] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
        >
          Utiliser
        </button>
      </div>
    </div>
  );
}

/** Choix des polices : chaque option est affichée dans sa vraie forme, plus un champ pour n'importe quelle police Google Fonts. */
export function FontSelector({ fonts, onChange }: { fonts: SiteFonts; onChange: (fonts: SiteFonts) => void }) {
  return (
    <div className="space-y-4">
      <FontPicker title="Police des titres" value={fonts.heading} onPick={(heading) => onChange({ ...fonts, name: `${heading} & ${fonts.body}`, heading })} />
      <FontPicker title="Police du texte" value={fonts.body} onPick={(body) => onChange({ ...fonts, name: `${fonts.heading} & ${body}`, body })} />
      <p className="text-[10px] text-[#57534E]">
        Les polices viennent de Google Fonts (vérifiez que le nom saisi existe). Une police inconnue s’affiche avec une police de secours.
      </p>
    </div>
  );
}

/** Architecture de la page et style de navigation. */
export function LayoutControls({ theme, onChange }: { theme: SiteTheme; onChange: (theme: SiteTheme) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="layout-mode" className={label}>
          Architecture de la page
        </label>
        <select id="layout-mode" value={theme.layoutMode ?? 'vertical'} onChange={(e) => onChange({ ...theme, layoutMode: e.target.value as SiteLayoutMode })} className={field}>
          {LAYOUT_MODES.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-[#57534E] mt-1">{LAYOUT_MODES.find((o) => o.id === (theme.layoutMode ?? 'vertical'))?.description}</p>
      </div>
      <div>
        <label htmlFor="header-style" className={label}>
          Style de navigation
        </label>
        <select id="header-style" value={theme.headerStyle ?? 'classic-bar'} onChange={(e) => onChange({ ...theme, headerStyle: e.target.value as HeaderNavStyle })} className={field}>
          {HEADER_STYLES.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-[#57534E] mt-1">
          {HEADER_STYLES.find((o) => o.id === (theme.headerStyle ?? 'classic-bar'))?.description} La barre latérale est simplifiée sur la page d’édition : « Tester le site » montre le rendu exact.
        </p>
      </div>
    </div>
  );
}

export function NavbarControls({
  value,
  onChange,
}: {
  value: NavbarConfig;
  onChange: (value: NavbarConfig) => void;
}) {
  const patch = (next: Partial<NavbarConfig>) => onChange({ ...value, ...next });
  return (
    <div className="space-y-3 rounded-sm border border-[#E5DEC9] bg-[#FFFFFF] p-3">
      <div>
        <label htmlFor="navbar-variant" className={label}>Style de barre</label>
        <select id="navbar-variant" value={value.variant} onChange={(e) => patch({ variant: e.target.value as NavbarConfig['variant'] })} className={field}>
          <option value="sticky-full">Pleine largeur fixe</option>
          <option value="floating-pill">Capsule flottante</option>
          <option value="floating-wide">Barre flottante large</option>
          <option value="sidebar-drawer">Menu tiroir</option>
        </select>
      </div>
      {([
        ['opacity', 'Opacité', 0, 100, '%'],
        ['blurPx', 'Flou', 0, 32, 'px'],
        ['borderRadiusPx', 'Arrondi', 0, 999, 'px'],
        ['borderOpacity', 'Opacité de bordure', 0, 100, '%'],
      ] as const).map(([key, title, min, max, unit]) => (
        <label key={key} className="block text-xs">
          <span className="flex justify-between font-semibold"><span>{title}</span><span>{value[key]}{unit}</span></span>
          <input
            type="range"
            min={min}
            max={max}
            value={value[key]}
            onChange={(e) => patch({ [key]: Number(e.target.value) })}
            className="w-full accent-[#9A3412]"
          />
        </label>
      ))}
      <div>
        <label htmlFor="navbar-indicator" className={label}>Indicateur du lien actif</label>
        <select id="navbar-indicator" value={value.activeIndicator} onChange={(e) => patch({ activeIndicator: e.target.value as NavbarConfig['activeIndicator'] })} className={field}>
          <option value="pill">Pastille</option><option value="underline">Soulignement</option>
          <option value="glow">Halo</option><option value="none">Aucun</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={value.shrinkOnScroll} onChange={(e) => patch({ shrinkOnScroll: e.target.checked })} />
        Réduire au défilement
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={value.autoHideOnScrollDown} onChange={(e) => patch({ autoHideOnScrollDown: e.target.checked })} />
        Masquer en descendant
      </label>
    </div>
  );
}

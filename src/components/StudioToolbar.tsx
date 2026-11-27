import React, { useState } from 'react';
import {
  FilePlus2,
  Image as ImageIcon,
  Palette,
  Sparkles,
  Download,
  Upload,
  Check,
  Search,
  Layers,
} from 'lucide-react';
import type {
  HeaderNavStyle,
  Image3DEffect,
  ImageScrollEffect,
  SectionAnimationType,
  SiteBlock,
  SiteLayoutMode,
  SiteProject,
} from '../types/site';
import {
  HEADER_STYLES,
  IMAGE_3D_EFFECTS,
  IMAGE_SCROLL_EFFECTS,
  SECTION_ANIMATIONS,
  LAYOUT_MODES,
} from '../utils/effectsCatalog';
import { generateHarmony } from '../utils/colorHarmony';
import { ensureGoogleFontLoaded } from '../utils/fonts';
import { downloadForgeFile, parseForgeFile } from '../utils/projectIO';
import { NewPageModal } from './NewPageModal';

const POPULAR_FONTS = [
  'Inter',
  'Plus Jakarta Sans',
  'Space Grotesk',
  'Playfair Display',
  'Syne',
  'Outfit',
  'DM Sans',
  'Cormorant Garamond',
  'JetBrains Mono',
  'Montserrat',
];

export function StudioToolbar({
  project,
  selectedBlock,
  proposals,
  activeProposalId,
  onSelectProposal,
  onChangeProject,
  onSelectBlock,
}: {
  project: SiteProject;
  selectedBlock: SiteBlock | null;
  proposals: Array<{ id: string; label: string; project: SiteProject }>;
  activeProposalId: string;
  onSelectProposal: (id: string) => void;
  onChangeProject: (next: SiteProject) => void;
  onSelectBlock: (id: string) => void;
}) {
  const [drawer, setDrawer] = useState<'none' | 'design' | 'effects' | 'stock' | 'inline'>('none');
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [stockQuery, setStockQuery] = useState('');
  const [stockResults, setStockResults] = useState<Array<{ id: string; url: string; thumbUrl: string; title: string; license: string }>>([]);
  const [searchingStock, setSearchingStock] = useState(false);
  const [customFont, setCustomFont] = useState('');

  const updateTheme = (patch: Partial<SiteProject['theme']>) => {
    onChangeProject({
      ...project,
      updatedAt: new Date().toISOString(),
      theme: { ...project.theme, ...patch },
    });
  };

  const updatePalette = (key: keyof SiteProject['theme']['palette'], val: string) => {
    updateTheme({
      palette: { ...project.theme.palette, [key]: val },
    });
  };

  const updateBlock = (blockId: string, updater: (b: SiteBlock) => SiteBlock) => {
    onChangeProject({
      ...project,
      updatedAt: new Date().toISOString(),
      blocks: project.blocks.map((b) => (b.id === blockId ? updater(b) : b)),
    });
  };

  const handleSearchStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchingStock(true);
    try {
      const resp = await fetch(`/api/images/search?q=${encodeURIComponent(stockQuery || 'modern design')}&limit=12`);
      if (!resp.ok) throw new Error('La recherche d’images est indisponible.');
      const data = await resp.json();
      setStockResults(data.images || []);
    } catch (error) {
      setStockResults([]);
      console.error('Échec de la recherche d’images libres.', error);
    } finally {
      setSearchingStock(false);
    }
  };

  const applyStockUrl = (url: string, alt: string) => {
    const target = selectedBlock ?? project.blocks[0];
    if (!target) return;
    updateBlock(target.id, (b) => ({
      ...b,
      content: { ...b.content, image: url, imageAlt: alt },
    }));
  };

  const handleImportForgeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onChangeProject(parseForgeFile(String(reader.result)));
      } catch (error) {
        console.error('Import du projet impossible.', error);
      }
    };
    reader.readAsText(file);
  };

  const currentEffect = selectedBlock?.content.imageEffect ?? {
    scroll: 'none',
    scrollIntensity: 50,
    effect3d: 'none',
    effect3dIntensity: 50,
  };

  return (
    <div className="bg-zinc-900 text-zinc-100 border-b border-zinc-800 px-4 py-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Sélecteur des 3 propositions IA si disponibles */}
        <div className="flex flex-wrap items-center gap-2">
          {proposals.length > 1 && (
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
              {proposals.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelectProposal(p.id)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    activeProposalId === p.id ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {p.label.split('—')[1]?.trim() || p.label}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setNewPageOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 font-semibold flex items-center gap-1.5"
          >
            <FilePlus2 className="w-3.5 h-3.5 text-orange-400" /> Nouvelle page
          </button>

          <button
            onClick={() => setDrawer(drawer === 'design' ? 'none' : 'design')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 ${
              drawer === 'design' ? 'bg-orange-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700'
            }`}
          >
            <Palette className="w-3.5 h-3.5" /> Structure, Couleurs & Polices
          </button>

          <button
            onClick={() => setDrawer(drawer === 'effects' ? 'none' : 'effects')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 ${
              drawer === 'effects' ? 'bg-orange-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Effets 3D, Scroll & Animations
          </button>

          <button
            onClick={() => setDrawer(drawer === 'stock' ? 'none' : 'stock')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 ${
              drawer === 'stock' ? 'bg-orange-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" /> Images libres de droits
          </button>

          <button
            onClick={() => setDrawer(drawer === 'inline' ? 'none' : 'inline')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 ${
              drawer === 'inline' ? 'bg-orange-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Édition rapide textes
          </button>
        </div>

        {/* Sauvegarde / Import .forge.json */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadForgeFile(project)}
            className="px-2.5 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 flex items-center gap-1"
            title="Sauvegarder le projet complet (.forge.json)"
          >
            <Download className="w-3.5 h-3.5" /> .forge.json
          </button>
          <label className="px-2.5 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 flex items-center gap-1 cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Importer
            <input type="file" accept=".json,.forge.json" onChange={handleImportForgeFile} className="hidden" />
          </label>
        </div>
      </div>

      {/* Tiroir 1 : Structure globale, Navigation, Palette libre & Polices avec aperçu */}
      {drawer === 'design' && (
        <div className="mt-3 pt-3 border-t border-zinc-800 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2.5">
            <div className="font-bold text-orange-400 uppercase tracking-wider text-[11px]">Structure & En-tête</div>
            <label className="block">
              <span className="text-zinc-400 block mb-1">Architecture du site</span>
              <select
                value={project.theme.layoutMode || 'vertical'}
                onChange={(e) => updateTheme({ layoutMode: e.target.value as SiteLayoutMode })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white"
              >
                {LAYOUT_MODES.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-zinc-400 block mb-1">Style de navigation</span>
              <select
                value={project.theme.headerStyle || 'classic-bar'}
                onChange={(e) => updateTheme({ headerStyle: e.target.value as HeaderNavStyle })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white"
              >
                {HEADER_STYLES.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 pt-1 text-zinc-300">
              <input
                type="checkbox"
                checked={Boolean(project.theme.visitorThemeToggle)}
                onChange={(e) => updateTheme({ visitorThemeToggle: e.target.checked })}
              />
              Bouton Clair/Sombre pour les visiteurs
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-orange-400 uppercase tracking-wider text-[11px]">Palette 100 % libre</span>
              <button
                onClick={() => {
                  const h = generateHarmony(project.theme.palette.primary, 'analogous', project.theme.mode === 'dark');
                  updateTheme({
                    palette: {
                      ...project.theme.palette,
                      primary: h.primary,
                      secondary: h.secondary,
                      background: h.background,
                      surface: h.surface,
                      text: h.text,
                      mutedText: h.mutedText,
                    },
                  });
                }}
                className="text-[11px] text-orange-400 hover:underline"
              >
                Harmonie auto
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['primary', 'Principale'],
                  ['secondary', 'Accent'],
                  ['background', 'Fond page'],
                  ['surface', 'Cartes'],
                  ['text', 'Texte'],
                  ['mutedText', 'Texte secondaire'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1">
                  <input
                    type="color"
                    value={project.theme.palette[key]}
                    onChange={(e) => updatePalette(key, e.target.value)}
                    className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="truncate text-zinc-300">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="font-bold text-orange-400 uppercase tracking-wider text-[11px]">Polices (aperçu réel)</div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {POPULAR_FONTS.map((font) => {
                ensureGoogleFontLoaded(font);
                const active = project.theme.fonts.heading === font;
                return (
                  <button
                    key={font}
                    onClick={() => updateTheme({ fonts: { ...project.theme.fonts, heading: font } })}
                    style={{ fontFamily: `'${font}', sans-serif` }}
                    className={`px-2.5 py-1 rounded-md border text-xs ${
                      active ? 'border-orange-500 bg-orange-600/20 text-white' : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600'
                    }`}
                  >
                    {font}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1.5 pt-1">
              <input
                type="text"
                value={customFont}
                onChange={(e) => setCustomFont(e.target.value)}
                placeholder="Autre Google Font (ex: Cinzel)"
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1 text-white"
              />
              <button
                onClick={() => {
                  if (!customFont.trim()) return;
                  ensureGoogleFontLoaded(customFont.trim());
                  updateTheme({ fonts: { ...project.theme.fonts, heading: customFont.trim() } });
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 font-semibold"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tiroir 2 : Effets 3D, Scroll & Animations sur le bloc sélectionné */}
      {drawer === 'effects' && (
        <div className="mt-3 pt-3 border-t border-zinc-800">
          {!selectedBlock ? (
            <p className="text-zinc-400">Cliquez d'abord sur une section de votre page pour lui appliquer des effets 3D, de défilement ou d'animation.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <span className="text-zinc-400 block mb-1">Animation de la section</span>
                <select
                  value={selectedBlock.animation || 'none'}
                  onChange={(e) => updateBlock(selectedBlock.id, (b) => ({ ...b, animation: e.target.value as SectionAnimationType }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white"
                >
                  {SECTION_ANIMATIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-zinc-400 block mb-1">Effet de défilement (Scroll)</span>
                <select
                  value={currentEffect.scroll}
                  onChange={(e) =>
                    updateBlock(selectedBlock.id, (b) => ({
                      ...b,
                      content: {
                        ...b.content,
                        imageEffect: { ...currentEffect, scroll: e.target.value as ImageScrollEffect },
                      },
                    }))
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white"
                >
                  {IMAGE_SCROLL_EFFECTS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-zinc-400 block mb-1">Effet 3D & Interactif Image</span>
                <select
                  value={currentEffect.effect3d}
                  onChange={(e) =>
                    updateBlock(selectedBlock.id, (b) => ({
                      ...b,
                      content: {
                        ...b.content,
                        imageEffect: { ...currentEffect, effect3d: e.target.value as Image3DEffect },
                      },
                    }))
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white"
                >
                  {IMAGE_3D_EFFECTS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-zinc-400 block mb-1">Intensité ({currentEffect.effect3dIntensity}%)</span>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={currentEffect.effect3dIntensity}
                  onChange={(e) =>
                    updateBlock(selectedBlock.id, (b) => ({
                      ...b,
                      content: {
                        ...b.content,
                        imageEffect: { ...currentEffect, effect3dIntensity: Number(e.target.value), scrollIntensity: Number(e.target.value) },
                      },
                    }))
                  }
                  className="w-full accent-orange-500 mt-2"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tiroir 3 : Bibliothèque d'images libres de droits intégrée (Openverse + Wikimedia) */}
      {drawer === 'stock' && (
        <div className="mt-3 pt-3 border-t border-zinc-800 space-y-3">
          <form onSubmit={handleSearchStock} className="flex gap-2">
            <input
              type="text"
              value={stockQuery}
              onChange={(e) => setStockQuery(e.target.value)}
              placeholder="Rechercher des photos libres de droits (ex: watch, architecture, coffee, studio)..."
              className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-white"
            />
            <button
              type="submit"
              disabled={searchingStock}
              className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 font-semibold flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" /> {searchingStock ? 'Recherche...' : 'Rechercher'}
            </button>
          </form>
          {stockResults.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-h-44 overflow-y-auto">
              {stockResults.map((img) => (
                <button
                  key={img.id}
                  onClick={() => applyStockUrl(img.url, img.title)}
                  className="group relative rounded-lg overflow-hidden border border-zinc-800 hover:border-orange-500 aspect-video bg-zinc-950"
                  title={`Insérer : ${img.title} (${img.license})`}
                >
                  <img src={img.thumbUrl} alt={img.title} className="w-full h-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-black/75 text-[10px] px-1.5 py-0.5 truncate opacity-0 group-hover:opacity-100">
                    Utiliser
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tiroir 4 : Édition rapide des textes du bloc sélectionné */}
      {drawer === 'inline' && (
        <div className="mt-3 pt-3 border-t border-zinc-800">
          {!selectedBlock ? (
            <p className="text-zinc-400">Sélectionnez un bloc sur la page pour éditer ses textes directement.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={selectedBlock.content.kicker || ''}
                onChange={(e) => updateBlock(selectedBlock.id, (b) => ({ ...b, content: { ...b.content, kicker: e.target.value } }))}
                placeholder="Surtitre / Badge"
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-white"
              />
              <input
                type="text"
                value={selectedBlock.content.heading || ''}
                onChange={(e) => updateBlock(selectedBlock.id, (b) => ({ ...b, content: { ...b.content, heading: e.target.value } }))}
                placeholder="Titre principal"
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-white font-semibold"
              />
              <input
                type="text"
                value={selectedBlock.content.subheading || ''}
                onChange={(e) => updateBlock(selectedBlock.id, (b) => ({ ...b, content: { ...b.content, subheading: e.target.value } }))}
                placeholder="Sous-titre / Description"
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-white"
              />
            </div>
          )}
        </div>
      )}

      <NewPageModal
        isOpen={newPageOpen}
        project={project}
        onClose={() => setNewPageOpen(false)}
        onApply={(newBlocks) => {
          onChangeProject({
            ...project,
            updatedAt: new Date().toISOString(),
            blocks: [...project.blocks.filter((b) => b.type !== 'footer'), ...newBlocks.filter((b) => b.type !== 'navbar' && b.type !== 'footer'), ...project.blocks.filter((b) => b.type === 'footer')],
          });
          if (newBlocks[0]) onSelectBlock(newBlocks[0].id);
        }}
      />
    </div>
  );
}

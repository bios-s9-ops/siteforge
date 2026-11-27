import { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Moon,
  Palette,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  ApiClientError,
  apiGenerateSeo,
  apiRegenerateBlock,
  apiRewriteText,
  apiSuggestStyles,
} from '../services/geminiClient';
import type {
  BlockItem,
  FontPairSuggestion,
  PaletteSuggestion,
  SiteBlock,
  SiteProject,
  SiteRadius,
  SiteSpacing,
} from '../types/site';
import {
  applyArtDirectionToTheme,
  ART_DIRECTIONS,
  CURATED_FONT_PAIRINGS,
} from '../utils/artDirections';
import { createBlockId, getBlockDefinition } from '../utils/blockCatalog';
import { MediaPicker } from './MediaPicker';
import { AnimationControls, ImageEffectControls } from './EffectControls';
import { DEFAULT_IMAGE_EFFECT } from '../utils/effectsCatalog';
import { collectIncompleteFields, isEmptyOrTodo, isTodoValue } from '../utils/honesty';
import { PublishPanel } from './PublishPanel';
import { AiNotice } from './AiNotice';
import { ColorEditor, FontSelector, LayoutControls, NavbarControls } from './StyleControls';
import { DEFAULT_NAVBAR_CONFIG, getSiteSettings } from '../utils/siteSettings';

export type InspectorTab = 'block' | 'style' | 'seo' | 'publish' | 'todo';

export interface FocusFieldTarget {
  blockId: string;
  itemId?: string;
  fieldKey: string;
  nonce: number;
}

interface InspectorPanelProps {
  project: SiteProject;
  selectedBlock: SiteBlock | null;
  activeTab: InspectorTab;
  onChangeTab: (tab: InspectorTab) => void;
  focusTarget: FocusFieldTarget | null;
  onJumpToField: (blockId: string, fieldKey: string, itemId?: string) => void;
  onUpdateBlock: (updated: SiteBlock) => void;
  onUpdateProject: (updated: SiteProject) => void;
  onSelectBlock: (blockId: string) => void;
}

export function InspectorPanel({
  project,
  selectedBlock,
  activeTab,
  onChangeTab,
  focusTarget,
  onJumpToField,
  onUpdateBlock,
  onUpdateProject,
  onSelectBlock,
}: InspectorPanelProps) {
  // Gemini block regeneration state
  const [regenPrompt, setRegenPrompt] = useState('');
  const [regenTone, setRegenTone] = useState<string | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState('');

  // Gemini text rewrite state
  const [rewritingField, setRewritingField] = useState<string | null>(null);


  // Gemini style suggestions state
  const [stylesLoading, setStylesLoading] = useState(false);
  const [stylesError, setStylesError] = useState('');
  const [suggestedPalettes, setSuggestedPalettes] = useState<PaletteSuggestion[]>([]);
  const [suggestedFonts, setSuggestedFonts] = useState<FontPairSuggestion[]>([]);

  // Gemini SEO state
  const [seoLoading, setSeoLoading] = useState(false);
  const [seoError, setSeoError] = useState('');

  const incompleteFields = collectIncompleteFields(project);
  const def = selectedBlock ? getBlockDefinition(selectedBlock.type) : null;

  useEffect(() => {
    if (!focusTarget || activeTab !== 'block') return;
    const targetId = `field-${focusTarget.blockId}-${focusTarget.itemId ?? 'root'}-${focusTarget.fieldKey}`;
    const timer = setTimeout(() => {
      const el = document.getElementById(targetId) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        if (typeof el.select === 'function' && isTodoValue(el.value)) {
          el.select();
        }
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [focusTarget, activeTab]);

  const updateContent = (patch: Partial<SiteBlock['content']>) => {
    if (!selectedBlock) return;
    onUpdateBlock({
      ...selectedBlock,
      content: { ...selectedBlock.content, ...patch },
    });
  };

  const updateItem = (itemId: string, patch: Partial<BlockItem>) => {
    if (!selectedBlock) return;
    const nextItems = (selectedBlock.content.items ?? []).map((it) =>
      it.id === itemId ? { ...it, ...patch } : it,
    );
    updateContent({ items: nextItems });
  };

  const addItem = () => {
    if (!selectedBlock) return;
    const isFactual =
      selectedBlock.type === 'testimonials' ||
      selectedBlock.type === 'stats' ||
      selectedBlock.type === 'team' ||
      selectedBlock.type === 'logos' ||
      selectedBlock.type === 'products' ||
      selectedBlock.type === 'pricing';
    const nextItems: BlockItem[] = [
      ...(selectedBlock.content.items ?? []),
      {
        id: createBlockId('it'),
        title: isFactual ? 'À compléter' : 'Nouvel élément',
        subtitle: selectedBlock.type === 'team' || selectedBlock.type === 'testimonials' ? 'À compléter' : undefined,
        price: selectedBlock.type === 'products' || selectedBlock.type === 'pricing' ? 'À compléter' : undefined,
        description: isFactual ? 'À compléter avec vos données réelles.' : 'Description à personnaliser.',
      },
    ];
    updateContent({ items: nextItems });
  };

  const removeItem = (itemId: string) => {
    if (!selectedBlock) return;
    updateContent({
      items: (selectedBlock.content.items ?? []).filter((it) => it.id !== itemId),
    });
  };

  const handleRegenerateBlock = async (customInstruction?: string) => {
    if (!selectedBlock) return;
    const base = (customInstruction ?? regenPrompt).trim() || 'Rends ce bloc plus clair, concret et sans superlatif';
    const instruction = regenTone ? `${base} Ton souhaité : ${regenTone.toLowerCase()}. N'invente aucun fait, chiffre ou avis.` : base;
    setRegenLoading(true);
    setRegenError('');
    try {
      const updated = await apiRegenerateBlock({
        block: selectedBlock,
        instruction,
        siteName: project.name,
        activity: project.projectInput?.activity,
      });
      onUpdateBlock(updated);
      setRegenPrompt('');
    } catch (err) {
      setRegenError(err instanceof ApiClientError ? err.message : 'Erreur lors de la régénération.');
    } finally {
      setRegenLoading(false);
    }
  };

  const handleRewriteField = async (field: 'heading' | 'subheading' | 'body', instruction: string) => {
    if (!selectedBlock) return;
    const current = selectedBlock.content[field];
    if (!current) return;
    setRewritingField(field);
    try {
      const rewritten = await apiRewriteText({
        text: current,
        instruction,
        siteName: project.name,
      });
      updateContent({ [field]: rewritten });
    } catch (err) {
      setRegenError(err instanceof ApiClientError ? err.message : 'Impossible de réécrire le texte.');
    } finally {
      setRewritingField(null);
    }
  };

  const handleSuggestStyles = async () => {
    setStylesLoading(true);
    setStylesError('');
    try {
      const res = await apiSuggestStyles({
        activity: project.projectInput?.activity || project.name,
        mood: project.projectInput?.mood || 'Sobre et professionnel',
        siteName: project.name,
      });
      setSuggestedPalettes(res.palettes ?? []);
      setSuggestedFonts(res.fontPairs ?? []);
    } catch (err) {
      setStylesError(err instanceof ApiClientError ? err.message : 'Erreur lors des suggestions Gemini.');
    } finally {
      setStylesLoading(false);
    }
  };

  const handleGenerateSeo = async () => {
    setSeoLoading(true);
    setSeoError('');
    try {
      const res = await apiGenerateSeo(project);
      const nextBlocks = project.blocks.map((b) => {
        const blockAlt = res.imageAlts?.find((a) => a.blockId === b.id && !a.itemId);
        const nextItems = b.content.items?.map((it) => {
          const itemAlt = res.imageAlts?.find((a) => a.blockId === b.id && a.itemId === it.id);
          return itemAlt ? { ...it, imageAlt: itemAlt.alt } : it;
        });
        return {
          ...b,
          content: {
            ...b.content,
            imageAlt: blockAlt ? blockAlt.alt : b.content.imageAlt,
            items: nextItems,
          },
        };
      });
      onUpdateProject({
        ...project,
        seoTitle: res.seoTitle || project.seoTitle,
        seoDescription: res.seoDescription || project.seoDescription,
        blocks: nextBlocks,
      });
    } catch (err) {
      setSeoError(err instanceof ApiClientError ? err.message : 'Erreur lors de la génération SEO.');
    } finally {
      setSeoLoading(false);
    }
  };

  const fieldInputClass = (val?: string, forceHighlightIfEmpty = false) => {
    const highlighted = isTodoValue(val) || (forceHighlightIfEmpty && isEmptyOrTodo(val));
    return `w-full px-3 py-2 text-xs rounded-sm border focus:outline-none ${
      highlighted
        ? 'border-[#D97706] bg-[#FEF3C7]/45 text-[#1C1917] focus:border-[#9A3412]'
        : 'border-[#E5DEC9] bg-[#FFFFFF] text-[#1C1917] focus:border-[#9A3412]'
    }`;
  };

  return (
    <aside className="w-full lg:w-[360px] shrink-0 bg-[#FFFFFF] border-l border-[#E5DEC9] flex flex-col h-full overflow-hidden">
      {/* Tabs */}
      <div className="p-2 border-b border-[#E5DEC9] grid grid-cols-5 gap-1 bg-[#F4EFE6]">
        <button
          type="button"
          onClick={() => onChangeTab('block')}
          className={`py-2 px-1.5 rounded-sm text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'block'
              ? 'bg-[#FFFFFF] text-[#1C1917] border border-[#E5DEC9]'
              : 'text-[#57534E] hover:text-[#1C1917]'
          }`}
        >
          Bloc
        </button>
        <button
          type="button"
          onClick={() => onChangeTab('style')}
          className={`py-2 px-1.5 rounded-sm text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'style'
              ? 'bg-[#FFFFFF] text-[#1C1917] border border-[#E5DEC9]'
              : 'text-[#57534E] hover:text-[#1C1917]'
          }`}
        >
          <Palette className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Style</span>
        </button>
        <button
          type="button"
          onClick={() => onChangeTab('seo')}
          className={`py-2 px-1.5 rounded-sm text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'seo'
              ? 'bg-[#FFFFFF] text-[#1C1917] border border-[#E5DEC9]'
              : 'text-[#57534E] hover:text-[#1C1917]'
          }`}
        >
          <Search className="w-3.5 h-3.5" aria-hidden="true" />
          <span>SEO</span>
        </button>
        <button
          type="button"
          onClick={() => onChangeTab('publish')}
          className={`py-2 px-1 rounded-sm text-[11px] font-semibold transition-colors cursor-pointer ${
            activeTab === 'publish'
              ? 'bg-[#FFFFFF] text-[#1C1917] border border-[#E5DEC9]'
              : 'text-[#57534E] hover:text-[#1C1917]'
          }`}
        >
          Publier
        </button>
        <button
          type="button"
          onClick={() => onChangeTab('todo')}
          className={`py-2 px-1 rounded-sm text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'todo'
              ? 'bg-[#FFFFFF] text-[#1C1917] border border-[#E5DEC9]'
              : incompleteFields.length > 0
                ? 'text-[#B45309] hover:text-[#1C1917]'
                : 'text-[#57534E] hover:text-[#1C1917]'
          }`}
        >
          <span>À faire</span>
          {incompleteFields.length > 0 && (
            <span className="px-1.5 py-0.2 bg-[#FEF3C7] text-[#78350F] border border-[#D97706]/50 rounded-sm font-mono-tabular text-[10px]">
              {incompleteFields.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto editor-scroll p-4 space-y-6 bg-[#FBF8F3]/40">
        {activeTab === 'todo' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-semibold text-[#1C1917]">Contenu à compléter</h2>
              <p className="text-xs text-[#57534E] leading-relaxed">
                SiteForge ne fabrique jamais de coordonnées, tarifs, statistiques ou témoignages. Cliquez sur un élément
                pour le compléter directement.
              </p>
            </div>

            {incompleteFields.length === 0 ? (
              <div className="bg-[#FFFFFF] border border-[#E5DEC9] p-5 text-center space-y-2 rounded-sm">
                <CheckCircle2 className="w-6 h-6 text-emerald-700 mx-auto" aria-hidden="true" />
                <div className="text-xs font-semibold text-[#1C1917]">Aucun champ « À compléter » restant</div>
                <p className="text-xs text-[#57534E]">
                  Toutes les coordonnées et données factuelles visibles sont renseignées.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {incompleteFields.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onJumpToField(item.blockId, item.fieldKey, item.itemId)}
                    className="w-full text-left p-3 rounded-sm bg-[#FFFFFF] border border-[#E5DEC9] hover:border-[#9A3412] transition-colors flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#B45309]">
                        {item.blockLabel}
                      </div>
                      <div className="text-xs font-semibold text-[#1C1917] truncate">{item.fieldLabel}</div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-[#9A3412] shrink-0" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'block' && (
          <>
            {!selectedBlock || !def ? (
              <div className="text-center py-12 px-4 text-sm text-[#57534E]">
                Sélectionnez un bloc dans la liste ou dans l’aperçu pour modifier son contenu.
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="text-xs font-medium text-[#57534E]">{def.category}</div>
                  <h2 className="font-display text-lg font-semibold text-[#1C1917]">{def.label}</h2>
                </div>

                {/* Variant Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#1C1917]">Variante de mise en page</label>
                  <div className="grid gap-1.5">
                    {def.variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => onUpdateBlock({ ...selectedBlock, variant: v.id })}
                        className={`text-left px-3 py-2 rounded-sm border text-xs transition-colors cursor-pointer ${
                          selectedBlock.variant === v.id
                            ? 'border-[#9A3412] bg-[#F4EFE6] text-[#1C1917] font-semibold'
                            : 'border-[#E5DEC9] bg-[#FFFFFF] hover:border-[#1C1917]/40 text-[#57534E]'
                        }`}
                      >
                        <div>{v.label}</div>
                        <div className="text-[11px] font-normal text-[#57534E]">{v.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Regenerate with Gemini Box */}
                <div className="bg-[#F4EFE6] border border-[#E5DEC9] rounded-sm p-3.5 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1C1917]">
                    <Sparkles className="w-3.5 h-3.5 text-[#9A3412]" aria-hidden="true" />
                    <span>Régénérer avec Gemini</span>
                  </div>
                  <input
                    type="text"
                    value={regenPrompt}
                    onChange={(e) => setRegenPrompt(e.target.value)}
                    placeholder="Ex. : ton plus concret, plus court..."
                    aria-label="Consigne de régénération pour Gemini"
                    className="w-full px-3 py-1.5 text-xs bg-[#FFFFFF] border border-[#E5DEC9] rounded-sm focus:outline-none focus:border-[#9A3412]"
                  />
                  <AiNotice className="mb-2" />
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ton du texte">
                    {['Concis', 'Professionnel', 'Chaleureux', 'Persuasif', 'Informatif'].map((tone) => (
                      <button
                        key={tone}
                        type="button"
                        aria-pressed={regenTone === tone}
                        onClick={() => setRegenTone(regenTone === tone ? null : tone)}
                        className={`px-2 py-1 rounded-sm border text-[11px] cursor-pointer ${
                          regenTone === tone
                            ? 'bg-[#9A3412] border-[#9A3412] text-white'
                            : 'bg-[#FFFFFF] border-[#E5DEC9] hover:border-[#9A3412] text-[#1C1917]'
                        }`}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['Ton plus chaleureux', 'Plus court', 'Plus factuel'].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleRegenerateBlock(chip)}
                        disabled={regenLoading}
                        className="px-2 py-1 rounded-sm bg-[#FFFFFF] border border-[#E5DEC9] hover:border-[#9A3412] text-[11px] text-[#1C1917] cursor-pointer"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRegenerateBlock()}
                    disabled={regenLoading}
                    className="w-full py-2 px-3 rounded-sm bg-[#1C1917] hover:bg-[#292524] disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {regenLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        <span>Réécriture en cours...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Appliquer avec Gemini</span>
                      </>
                    )}
                  </button>
                  {regenError && (
                    <div className="text-xs text-red-800 bg-red-50 border border-red-300 rounded-sm p-2 flex items-center justify-between gap-2">
                      <span>{regenError}</span>
                      <button
                        type="button"
                        onClick={() => handleRegenerateBlock()}
                        className="font-semibold underline shrink-0 cursor-pointer"
                      >
                        Réessayer
                      </button>
                    </div>
                  )}
                </div>

                {/* Text Fields */}
                <div className="space-y-3">
                  {selectedBlock.content.brandName !== undefined && (
                    <div>
                      <label className="block text-xs font-semibold text-[#1C1917] mb-1">Nom de marque</label>
                      <input
                        id={`field-${selectedBlock.id}-root-brandName`}
                        type="text"
                        value={selectedBlock.content.brandName}
                        onChange={(e) => updateContent({ brandName: e.target.value })}
                        className={fieldInputClass(selectedBlock.content.brandName)}
                      />
                    </div>
                  )}

                  {selectedBlock.content.kicker !== undefined && (
                    <div>
                      <label className="block text-xs font-semibold text-[#1C1917] mb-1">Sur-titre</label>
                      <input
                        id={`field-${selectedBlock.id}-root-kicker`}
                        type="text"
                        value={selectedBlock.content.kicker}
                        onChange={(e) => updateContent({ kicker: e.target.value })}
                        className={fieldInputClass(selectedBlock.content.kicker)}
                      />
                    </div>
                  )}

                  {selectedBlock.content.heading !== undefined && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-[#1C1917]">Titre principal</label>
                        <button
                          type="button"
                          disabled={rewritingField === 'heading'}
                          onClick={() => handleRewriteField('heading', 'Rends ce titre plus concret et sobre')}
                          className="text-[11px] text-[#9A3412] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {rewritingField === 'heading' ? 'Réécriture...' : 'Réécrire'}
                        </button>
                      </div>
                      <textarea
                        id={`field-${selectedBlock.id}-root-heading`}
                        rows={2}
                        value={selectedBlock.content.heading}
                        onChange={(e) => updateContent({ heading: e.target.value })}
                        className={fieldInputClass(selectedBlock.content.heading)}
                      />
                    </div>
                  )}

                  {selectedBlock.content.subheading !== undefined && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-[#1C1917]">Sous-titre</label>
                        <button
                          type="button"
                          disabled={rewritingField === 'subheading'}
                          onClick={() => handleRewriteField('subheading', 'Clarifie et allège ce sous-titre')}
                          className="text-[11px] text-[#9A3412] hover:underline cursor-pointer"
                        >
                          {rewritingField === 'subheading' ? 'Réécriture...' : 'Réécrire'}
                        </button>
                      </div>
                      <textarea
                        id={`field-${selectedBlock.id}-root-subheading`}
                        rows={3}
                        value={selectedBlock.content.subheading}
                        onChange={(e) => updateContent({ subheading: e.target.value })}
                        className={fieldInputClass(selectedBlock.content.subheading)}
                      />
                    </div>
                  )}

                  {selectedBlock.content.body !== undefined && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-[#1C1917]">Texte</label>
                        <button
                          type="button"
                          disabled={rewritingField === 'body'}
                          onClick={() => handleRewriteField('body', 'Rends ce paragraphe plus fluide et naturel')}
                          className="text-[11px] text-[#9A3412] hover:underline cursor-pointer"
                        >
                          {rewritingField === 'body' ? 'Réécriture...' : 'Réécrire'}
                        </button>
                      </div>
                      <textarea
                        id={`field-${selectedBlock.id}-root-body`}
                        rows={4}
                        value={selectedBlock.content.body}
                        onChange={(e) => updateContent({ body: e.target.value })}
                        className={fieldInputClass(selectedBlock.content.body)}
                      />
                    </div>
                  )}

                  {selectedBlock.content.ctaLabel !== undefined && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-[#1C1917] mb-1">Bouton principal</label>
                        <input
                          type="text"
                          value={selectedBlock.content.ctaLabel}
                          onChange={(e) => updateContent({ ctaLabel: e.target.value })}
                          className={fieldInputClass(selectedBlock.content.ctaLabel)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#1C1917] mb-1">Lien (#ancre / URL)</label>
                        <input
                          type="text"
                          value={selectedBlock.content.ctaHref || '#contact'}
                          onChange={(e) => updateContent({ ctaHref: e.target.value })}
                          className={fieldInputClass(selectedBlock.content.ctaHref)}
                        />
                      </div>
                    </div>
                  )}

                  {selectedBlock.type === 'hero' && selectedBlock.content.secondaryCtaLabel !== undefined && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-[#1C1917] mb-1">Bouton secondaire</label>
                        <input
                          type="text"
                          value={selectedBlock.content.secondaryCtaLabel}
                          onChange={(e) => updateContent({ secondaryCtaLabel: e.target.value })}
                          className={fieldInputClass(selectedBlock.content.secondaryCtaLabel)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#1C1917] mb-1">Lien secondaire</label>
                        <input
                          type="text"
                          value={selectedBlock.content.secondaryCtaHref || '#contact'}
                          onChange={(e) => updateContent({ secondaryCtaHref: e.target.value })}
                          className={fieldInputClass(selectedBlock.content.secondaryCtaHref)}
                        />
                      </div>
                    </div>
                  )}

                  {selectedBlock.type === 'contact' && (
                    <div className="space-y-2 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-[#1C1917] mb-1">E-mail affiché</label>
                        <input
                          id={`field-${selectedBlock.id}-root-email`}
                          type="text"
                          value={selectedBlock.content.email || ''}
                          onChange={(e) => updateContent({ email: e.target.value })}
                          className={fieldInputClass(selectedBlock.content.email, true)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#1C1917] mb-1">Téléphone</label>
                        <input
                          id={`field-${selectedBlock.id}-root-phone`}
                          type="text"
                          value={selectedBlock.content.phone || ''}
                          onChange={(e) => updateContent({ phone: e.target.value })}
                          className={fieldInputClass(selectedBlock.content.phone, true)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#1C1917] mb-1">Adresse</label>
                        <input
                          id={`field-${selectedBlock.id}-root-address`}
                          type="text"
                          value={selectedBlock.content.address || ''}
                          onChange={(e) => updateContent({ address: e.target.value })}
                          className={fieldInputClass(selectedBlock.content.address, true)}
                        />
                      </div>
                    </div>
                  )}

                  {selectedBlock.content.copyright !== undefined && (
                    <div>
                      <label className="block text-xs font-semibold text-[#1C1917] mb-1">Mention légale / Copyright</label>
                      <input
                        type="text"
                        value={selectedBlock.content.copyright}
                        onChange={(e) => updateContent({ copyright: e.target.value })}
                        className={fieldInputClass(selectedBlock.content.copyright)}
                      />
                    </div>
                  )}
                </div>

                {/* Image principale du bloc : import, photos libres de droits, lien, effets */}
                {selectedBlock.content.image !== undefined && (
                  <div className="space-y-3 pt-2 border-t border-[#E5DEC9]">
                    <MediaPicker
                      label="Image du bloc"
                      value={selectedBlock.content.image}
                      alt={selectedBlock.content.imageAlt || ''}
                      credit={selectedBlock.content.imageCredit}
                      suggestedQuery={selectedBlock.content.heading}
                      onChange={(patch) =>
                        updateContent({
                          image: patch.image,
                          ...(patch.imageAlt !== undefined ? { imageAlt: patch.imageAlt } : {}),
                          ...(patch.imageCredit !== undefined ? { imageCredit: patch.imageCredit } : {}),
                        })
                      }
                    />
                    <ImageEffectControls
                      idPrefix={`fx-${selectedBlock.id}`}
                      value={selectedBlock.content.imageEffect ?? DEFAULT_IMAGE_EFFECT}
                      hasSecondaryImage={Boolean(selectedBlock.content.secondaryImage)}
                      onChange={(effect) => updateContent({ imageEffect: effect })}
                    />
                    {selectedBlock.content.imageEffect?.effect3d === 'before-after-slider' && (
                      <MediaPicker
                        label="Seconde image (après)"
                        value={selectedBlock.content.secondaryImage ?? ''}
                        alt={selectedBlock.content.secondaryImageAlt || ''}
                        credit={selectedBlock.content.secondaryImageCredit}
                        suggestedQuery={selectedBlock.content.heading}
                        onChange={(patch) =>
                          updateContent({
                            secondaryImage: patch.image,
                            ...(patch.imageAlt !== undefined ? { secondaryImageAlt: patch.imageAlt } : {}),
                            ...(patch.imageCredit !== undefined ? { secondaryImageCredit: patch.imageCredit } : {}),
                          })
                        }
                      />
                    )}
                  </div>
                )}

                {/* Animation d'apparition de la section */}
                {selectedBlock.type !== 'navbar' && (
                  <div className="space-y-2.5 pt-2 border-t border-[#E5DEC9]">
                    <div className="text-xs font-semibold text-[#1C1917]">Animation de la section</div>
                    <AnimationControls
                      animation={selectedBlock.animation}
                      durationMs={selectedBlock.animationDurationMs}
                      onChange={(patch) => onUpdateBlock({ ...selectedBlock, ...patch })}
                      onReplay={() => {
                        const el = document.querySelector(`[data-block-id="${selectedBlock.id}"] [data-anim], [data-block-id="${selectedBlock.id}"][data-anim]`);
                        (window as unknown as { __sfFxReplay?: (el: Element | null) => void }).__sfFxReplay?.(el);
                      }}
                    />
                  </div>
                )}

                {/* Items List Editor */}
                {selectedBlock.content.items && (
                  <div className="space-y-3 pt-2 border-t border-[#E5DEC9]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#1C1917]">
                        Éléments ({selectedBlock.content.items.length})
                      </span>
                      <button
                        type="button"
                        onClick={addItem}
                        className="text-xs font-semibold text-[#9A3412] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Ajouter</span>
                      </button>
                    </div>

                    {(selectedBlock.type === 'testimonials' || selectedBlock.type === 'team') && (
                      <div className="text-[11px] text-[#78350F] bg-[#FEF3C7] border border-[#D97706]/50 rounded-sm p-2.5 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                        <span>Assurez-vous d’avoir l’accord de chaque personne citée ou photographiée.</span>
                      </div>
                    )}

                    <div className="space-y-2.5">
                      {selectedBlock.content.items.map((it, idx) => (
                        <div key={it.id} className="p-3 rounded-sm border border-[#E5DEC9] bg-[#FFFFFF] space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-[#57534E] font-mono-tabular">#{idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeItem(it.id)}
                              aria-label={`Supprimer l’élément ${it.title}`}
                              className="text-[#57534E] hover:text-red-700 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                          <input
                            id={`field-${selectedBlock.id}-${it.id}-title`}
                            type="text"
                            value={it.title}
                            onChange={(e) => updateItem(it.id, { title: e.target.value })}
                            placeholder="Titre"
                            className={fieldInputClass(it.title)}
                          />
                          {it.subtitle !== undefined && (
                            <input
                              id={`field-${selectedBlock.id}-${it.id}-subtitle`}
                              type="text"
                              value={it.subtitle}
                              onChange={(e) => updateItem(it.id, { subtitle: e.target.value })}
                              placeholder="Sous-titre / Rôle"
                              className={fieldInputClass(it.subtitle)}
                            />
                          )}
                          {it.price !== undefined && (
                            <input
                              id={`field-${selectedBlock.id}-${it.id}-price`}
                              type="text"
                              value={it.price}
                              onChange={(e) => updateItem(it.id, { price: e.target.value })}
                              placeholder="Tarif réel"
                              className={fieldInputClass(
                                it.price,
                                selectedBlock.type === 'products' || selectedBlock.type === 'pricing',
                              )}
                            />
                          )}
                          {it.description !== undefined && (
                            <textarea
                              id={`field-${selectedBlock.id}-${it.id}-description`}
                              rows={2}
                              value={it.description}
                              onChange={(e) => updateItem(it.id, { description: e.target.value })}
                              placeholder="Description"
                              className={fieldInputClass(it.description)}
                            />
                          )}
                          {it.image !== undefined && (
                            <details className="rounded-sm border border-[#E5DEC9] bg-[#FBF8F3]">
                              <summary className="px-2 py-1.5 text-[11px] font-medium cursor-pointer select-none">
                                {it.image ? 'Photo et effets' : 'Ajouter une photo'}
                              </summary>
                              <div className="p-2 space-y-3 border-t border-[#E5DEC9]">
                                <MediaPicker
                                  label="Photo de l’élément"
                                  value={it.image}
                                  alt={it.imageAlt || ''}
                                  credit={it.imageCredit}
                                  suggestedQuery={it.title}
                                  onChange={(patch) =>
                                    updateItem(it.id, {
                                      image: patch.image,
                                      ...(patch.imageAlt !== undefined ? { imageAlt: patch.imageAlt } : {}),
                                      ...(patch.imageCredit !== undefined ? { imageCredit: patch.imageCredit } : {}),
                                    })
                                  }
                                />
                                <ImageEffectControls
                                  idPrefix={`fx-${it.id}`}
                                  value={it.imageEffect ?? DEFAULT_IMAGE_EFFECT}
                                  onChange={(effect) => updateItem(it.id, { imageEffect: effect })}
                                />
                              </div>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Block Color Overrides */}
                <div className="space-y-2.5 pt-2 border-t border-[#E5DEC9]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#1C1917]">Couleurs propres au bloc</span>
                    {selectedBlock.styleOverride && (
                      <button
                        type="button"
                        onClick={() => onUpdateBlock({ ...selectedBlock, styleOverride: undefined })}
                        className="text-[11px] text-[#57534E] hover:text-[#1C1917] underline cursor-pointer"
                      >
                        Réinitialiser
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center justify-between p-2 rounded-sm border border-[#E5DEC9] bg-[#FFFFFF] text-xs">
                      <span>Fond</span>
                      <input
                        type="color"
                        value={selectedBlock.styleOverride?.backgroundColor || project.theme.palette.background}
                        onChange={(e) =>
                          onUpdateBlock({
                            ...selectedBlock,
                            styleOverride: { ...selectedBlock.styleOverride, backgroundColor: e.target.value },
                          })
                        }
                        className="w-6 h-6 rounded-sm cursor-pointer border-0"
                      />
                    </label>
                    <label className="flex items-center justify-between p-2 rounded-sm border border-[#E5DEC9] bg-[#FFFFFF] text-xs">
                      <span>Texte</span>
                      <input
                        type="color"
                        value={selectedBlock.styleOverride?.textColor || project.theme.palette.text}
                        onChange={(e) =>
                          onUpdateBlock({
                            ...selectedBlock,
                            styleOverride: { ...selectedBlock.styleOverride, textColor: e.target.value },
                          })
                        }
                        className="w-6 h-6 rounded-sm cursor-pointer border-0"
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedBlock.styleOverride?.glassMode)}
                      onChange={(e) => onUpdateBlock({
                        ...selectedBlock,
                        styleOverride: { ...selectedBlock.styleOverride, glassMode: e.target.checked },
                      })}
                      className="accent-[#9A3412]"
                    />
                    Liquid Glass pour ce bloc
                  </label>
                  {([
                    ['opacity', 'Transparence du verre', 0, 100],
                    ['blurPx', 'Flou', 0, 32],
                    ['paddingY', 'Espacement vertical', 0, 160],
                    ['borderRadius', 'Arrondi', 0, 999],
                    ['shadowDepth', 'Profondeur de l’ombre', 0, 48],
                  ] as const).map(([key, title, min, max]) => (
                    <label key={key} className="block text-xs">
                      <span className="flex justify-between"><span>{title}</span><span>{selectedBlock.styleOverride?.[key] ?? (key === 'opacity' ? 22 : key === 'blurPx' ? 24 : 0)}</span></span>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        value={selectedBlock.styleOverride?.[key] ?? (key === 'opacity' ? 22 : key === 'blurPx' ? 24 : 0)}
                        onChange={(e) => onUpdateBlock({
                          ...selectedBlock,
                          styleOverride: { ...selectedBlock.styleOverride, [key]: Number(e.target.value) },
                        })}
                        className="w-full accent-[#9A3412]"
                      />
                    </label>
                  ))}
                  <label className="block text-xs">
                    <span className="block font-semibold mb-1">Dégradé de fond</span>
                    <input
                      type="text"
                      maxLength={180}
                      placeholder="linear-gradient(135deg, #fff, #f3e8ff)"
                      value={selectedBlock.styleOverride?.backgroundGradient ?? ''}
                      onChange={(e) => onUpdateBlock({
                        ...selectedBlock,
                        styleOverride: {
                          ...selectedBlock.styleOverride,
                          backgroundGradient: /^linear-gradient\([\w\s,#.%()-]+\)$/i.test(e.target.value) ? e.target.value : '',
                        },
                      })}
                      className={fieldInputClass('')}
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="block font-semibold mb-1">CSS visuel (déclarations sûres)</span>
                    <textarea
                      rows={3}
                      maxLength={2000}
                      placeholder="border-radius: 20px; text-align: center"
                      value={selectedBlock.styleOverride?.customCss ?? ''}
                      onChange={(e) => onUpdateBlock({
                        ...selectedBlock,
                        styleOverride: { ...selectedBlock.styleOverride, customCss: e.target.value },
                      })}
                      className={fieldInputClass('')}
                    />
                    <span className="text-[10px] text-[#57534E]">Propriétés décoratives autorisées uniquement; les URLs et règles CSS sont bloquées.</span>
                  </label>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'style' && (
          <div className="space-y-6">
            {/* 1-Click 8 Artistic Directions Selector */}
            <div className="space-y-2.5">
              <div>
                <span className="block text-xs font-semibold text-[#1C1917]">
                  Direction artistique (changement en 1 clic)
                </span>
                <p className="text-[11px] text-[#57534E]">
                  Transforme typographies, palette, bordures et style des boutons.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ART_DIRECTIONS.map((dir) => {
                  const isActive = project.theme.artDirection === dir.id;
                  return (
                    <button
                      key={dir.id}
                      type="button"
                      onClick={() =>
                        onUpdateProject({
                          ...project,
                          theme: applyArtDirectionToTheme(dir.id),
                        })
                      }
                      className={`text-left p-2.5 rounded-sm border transition-colors cursor-pointer space-y-1.5 ${
                        isActive
                          ? 'border-[#9A3412] bg-[#F4EFE6]'
                          : 'border-[#E5DEC9] bg-[#FFFFFF] hover:border-[#1C1917]/40'
                      }`}
                    >
                      <div className="text-xs font-semibold text-[#1C1917] leading-tight">{dir.label}</div>
                      <div className="flex items-center gap-1">
                        {[dir.palette.background, dir.palette.surface, dir.palette.text, dir.palette.primary].map(
                          (hex, hi) => (
                            <span
                              key={hi}
                              className="w-3 h-3 rounded-full border border-[#1C1917]/15"
                              style={{ backgroundColor: hex }}
                              aria-hidden="true"
                            />
                          ),
                        )}
                      </div>
                      <div className="text-[10px] font-mono-tabular text-[#57534E] truncate">
                        {dir.fonts.heading}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mode Clair / Sombre */}
            <div className="space-y-2 pt-2 border-t border-[#E5DEC9]">
              <span className="block text-xs font-semibold text-[#1C1917]">Mode d’éclairage</span>
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#F4EFE6] border border-[#E5DEC9] rounded-sm">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateProject({
                      ...project,
                      theme: {
                        ...project.theme,
                        mode: 'light',
                        palette: {
                          ...project.theme.palette,
                          background: '#FAF8F4',
                          surface: '#F3EFE7',
                          text: '#171717',
                          mutedText: '#57534E',
                        },
                      },
                    })
                  }
                  className={`py-2 px-3 rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                    project.theme.mode === 'light'
                      ? 'bg-[#FFFFFF] text-[#1C1917] border border-[#E5DEC9]'
                      : 'text-[#57534E]'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Clair</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateProject({
                      ...project,
                      theme: {
                        ...project.theme,
                        mode: 'dark',
                        palette: {
                          ...project.theme.palette,
                          background: '#0F1419',
                          surface: '#161E27',
                          text: '#F1F5F9',
                          mutedText: '#94A3B8',
                        },
                      },
                    })
                  }
                  className={`py-2 px-3 rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                    project.theme.mode === 'dark' ? 'bg-[#1C1917] text-white' : 'text-[#57534E]'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Sombre</span>
                </button>
              </div>
            </div>

            {/* Gemini Suggest Palettes & Fonts */}
            <div className="bg-[#F4EFE6] border border-[#E5DEC9] rounded-sm p-3.5 space-y-3">
              <button
                type="button"
                onClick={handleSuggestStyles}
                disabled={stylesLoading}
                className="w-full py-2 px-3 rounded-sm bg-[#9A3412] hover:bg-[#7C2D12] disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {stylesLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    <span>Recherche de styles...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Proposer 3 palettes & 3 polices</span>
                  </>
                )}
              </button>

              {stylesError && (
                <div className="text-xs text-red-800 flex items-center justify-between gap-2">
                  <span>{stylesError}</span>
                  <button type="button" onClick={handleSuggestStyles} className="underline font-semibold cursor-pointer">
                    Réessayer
                  </button>
                </div>
              )}

              {suggestedPalettes.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-[#57534E]">Palettes proposées par Gemini :</div>
                  {suggestedPalettes.map((pal, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        onUpdateProject({
                          ...project,
                          theme: { ...project.theme, mode: pal.mode, palette: pal },
                        })
                      }
                      className="w-full text-left p-2.5 rounded-sm bg-[#FFFFFF] border border-[#E5DEC9] hover:border-[#9A3412] space-y-1 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#1C1917]">{pal.name}</span>
                        <div className="flex items-center gap-1">
                          {[pal.primary, pal.secondary, pal.background, pal.text].map((hex, hi) => (
                            <span
                              key={hi}
                              className="w-3.5 h-3.5 rounded-full border border-[#E5DEC9]"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-[11px] text-[#57534E]">{pal.rationale}</p>
                    </button>
                  ))}
                </div>
              )}

              {suggestedFonts.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-[#57534E]">Duos de polices proposés :</div>
                  {suggestedFonts.map((f, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        onUpdateProject({
                          ...project,
                          theme: { ...project.theme, fonts: { name: f.name, heading: f.heading, body: f.body } },
                        })
                      }
                      className="w-full text-left p-2.5 rounded-sm bg-[#FFFFFF] border border-[#E5DEC9] hover:border-[#9A3412] cursor-pointer"
                    >
                      <div className="text-xs font-semibold text-[#1C1917]">
                        {f.heading} + {f.body}
                      </div>
                      <div className="text-[11px] text-[#57534E]">{f.rationale}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <LayoutControls theme={project.theme} onChange={(theme) => onUpdateProject({ ...project, theme })} />

            <div className="space-y-2">
              <span className="block text-xs font-semibold text-[#1C1917]">Navigation interactive</span>
              <NavbarControls
                value={getSiteSettings(project).navbar ?? DEFAULT_NAVBAR_CONFIG}
                onChange={(navbar) => onUpdateProject({ ...project, settings: { ...getSiteSettings(project), navbar } })}
              />
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(project.theme.liquidGlass)}
                onChange={(e) => onUpdateProject({ ...project, theme: { ...project.theme, liquidGlass: e.target.checked } })}
                className="accent-[#9A3412]"
              />
              Appliquer le thème Liquid Glass
            </label>
            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-[#1C1917]">CSS global visuel (déclarations sûres)</span>
              <textarea
                rows={3}
                maxLength={2000}
                value={project.theme.customCss ?? ''}
                onChange={(e) => onUpdateProject({ ...project, theme: { ...project.theme, customCss: e.target.value } })}
                placeholder="letter-spacing: .01em; color: #24201c"
                className="w-full rounded-sm border border-[#E5DEC9] bg-white p-2 text-xs"
              />
              <span className="text-[10px] text-[#57534E]">Propriétés décoratives seulement; les règles imbriquées et les URLs sont refusées.</span>
            </label>

            <ColorEditor theme={project.theme} onChange={(theme) => onUpdateProject({ ...project, theme })} />

            <FontSelector
              fonts={project.theme.fonts}
              onChange={(fonts) => onUpdateProject({ ...project, theme: { ...project.theme, fonts } })}
            />

            {/* Radius & Spacing */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="radius-select" className="block text-xs font-semibold text-[#1C1917] mb-1">
                  Arrondis
                </label>
                <select
                  id="radius-select"
                  value={project.theme.borderRadius}
                  onChange={(e) =>
                    onUpdateProject({
                      ...project,
                      theme: { ...project.theme, borderRadius: e.target.value as SiteRadius },
                    })
                  }
                  className="w-full px-2.5 py-2 text-xs border border-[#E5DEC9] rounded-sm bg-[#FFFFFF]"
                >
                  <option value="none">Strict (0px)</option>
                  <option value="sm">Léger</option>
                  <option value="md">Équilibré</option>
                  <option value="lg">Arrondi</option>
                  <option value="full">Doux</option>
                </select>
              </div>
              <div>
                <label htmlFor="spacing-select" className="block text-xs font-semibold text-[#1C1917] mb-1">
                  Espacement
                </label>
                <select
                  id="spacing-select"
                  value={project.theme.spacing}
                  onChange={(e) =>
                    onUpdateProject({
                      ...project,
                      theme: { ...project.theme, spacing: e.target.value as SiteSpacing },
                    })
                  }
                  className="w-full px-2.5 py-2 text-xs border border-[#E5DEC9] rounded-sm bg-[#FFFFFF]"
                >
                  <option value="compact">Compact</option>
                  <option value="normal">Normal</option>
                  <option value="airy">Aéré</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'publish' && (
          <PublishPanel
            project={project}
            onUpdateProject={onUpdateProject}
            onJumpToBlock={(blockId) => onSelectBlock(blockId)}
          />
        )}

        {activeTab === 'seo' && (
          <div className="space-y-5">
            <button
              type="button"
              onClick={handleGenerateSeo}
              disabled={seoLoading}
              className="w-full py-2.5 px-3 rounded-sm bg-[#9A3412] hover:bg-[#7C2D12] disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {seoLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  <span>Génération SEO en cours...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Générer SEO et textes alt (Gemini)</span>
                </>
              )}
            </button>

            {seoError && (
              <div className="text-xs text-red-800 bg-red-50 border border-red-300 rounded-sm p-2.5 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {seoError}
                </span>
                <button type="button" onClick={handleGenerateSeo} className="font-semibold underline cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="seo-title-input" className="text-xs font-semibold text-[#1C1917]">
                    Titre de la page (SEO)
                  </label>
                  <span className="text-[11px] text-[#57534E] font-mono-tabular">{project.seoTitle.length}/60</span>
                </div>
                <input
                  id="seo-title-input"
                  type="text"
                  value={project.seoTitle}
                  onChange={(e) => onUpdateProject({ ...project, seoTitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-[#FFFFFF] border border-[#E5DEC9] rounded-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="seo-desc-input" className="text-xs font-semibold text-[#1C1917]">
                    Méta-description
                  </label>
                  <span className="text-[11px] text-[#57534E] font-mono-tabular">
                    {project.seoDescription.length}/155
                  </span>
                </div>
                <textarea
                  id="seo-desc-input"
                  rows={3}
                  value={project.seoDescription}
                  onChange={(e) => onUpdateProject({ ...project, seoDescription: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-[#FFFFFF] border border-[#E5DEC9] rounded-sm"
                />
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-[#E5DEC9]">
              <div className="text-xs font-semibold text-[#1C1917]">Textes alternatifs des images (accessibilité)</div>
              {project.blocks.map((b) => {
                const slots: Array<{ key: string; label: string; value: string; onChange: (v: string) => void }> = [];
                if (b.content.image) {
                  slots.push({
                    key: b.id,
                    label: `${getBlockDefinition(b.type).label} — image principale`,
                    value: b.content.imageAlt || '',
                    onChange: (val) => {
                      const next = project.blocks.map((blk) =>
                        blk.id === b.id ? { ...blk, content: { ...blk.content, imageAlt: val } } : blk,
                      );
                      onUpdateProject({ ...project, blocks: next });
                    },
                  });
                }
                for (const it of b.content.items ?? []) {
                  if (it.image) {
                    slots.push({
                      key: `${b.id}_${it.id}`,
                      label: `${getBlockDefinition(b.type).label} — ${it.title}`,
                      value: it.imageAlt || '',
                      onChange: (val) => {
                        const next = project.blocks.map((blk) =>
                          blk.id === b.id
                            ? {
                                ...blk,
                                content: {
                                  ...blk.content,
                                  items: blk.content.items?.map((x) => (x.id === it.id ? { ...x, imageAlt: val } : x)),
                                },
                              }
                            : blk,
                        );
                        onUpdateProject({ ...project, blocks: next });
                      },
                    });
                  }
                }
                return slots.map((s) => (
                  <div key={s.key} className="space-y-1">
                    <label className="block text-[11px] text-[#57534E]">{s.label}</label>
                    <input
                      type="text"
                      value={s.value}
                      onChange={(e) => s.onChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#FFFFFF] border border-[#E5DEC9] rounded-sm"
                    />
                  </div>
                ));
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

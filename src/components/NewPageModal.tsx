import { useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { SiteBlock, SiteProject } from '../types/site';
import { ApiClientError, apiRegenerateBlock } from '../services/geminiClient';
import { getBlockDefinition } from '../utils/blockCatalog';
import { FACTUAL_EXCLUDABLE_BLOCKS } from '../utils/honesty';
import { applyTemplate, PAGE_TEMPLATES, TEMPLATE_CATEGORIES, type PageTemplate } from '../utils/pageTemplates';
import { AiNotice } from './AiNotice';
import { ProposalsFlow } from './ProposalsFlow';

interface NewPageModalProps {
  isOpen: boolean;
  project: SiteProject;
  onClose: () => void;
  /** Reçoit la nouvelle liste de blocs (et éventuellement un thème si une proposition IA est choisie en entier) */
  onApply: (blocks: SiteBlock[], theme?: SiteProject['theme']) => void;
}

const TONES = ['Concis', 'Professionnel', 'Chaleureux', 'Persuasif', 'Informatif'];

/** Fenêtre « Nouvelle page » : modèles par catégorie avec aperçu de structure, ou création avec l'IA (trois propositions). */
export function NewPageModal({ isOpen, project, onClose, onApply }: NewPageModalProps) {
  const [tab, setTab] = useState<'templates' | 'ai'>('templates');
  const [category, setCategory] = useState<(typeof TEMPLATE_CATEGORIES)[number] | 'Tous'>('Tous');
  const [selectedId, setSelectedId] = useState(PAGE_TEMPLATES[0].id);
  const [mode, setMode] = useState<'replace' | 'append'>(project.blocks.length > 0 ? 'append' : 'replace');
  const [useAi, setUseAi] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [tone, setTone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const templates = useMemo(() => PAGE_TEMPLATES.filter((t) => category === 'Tous' || t.category === category), [category]);
  const selected: PageTemplate = PAGE_TEMPLATES.find((t) => t.id === selectedId) ?? PAGE_TEMPLATES[0];

  if (!isOpen) return null;

  const create = async () => {
    setError('');
    let blocks = applyTemplate(project.blocks, selected, mode, project.name);
    if (useAi) {
      setBusy(true);
      try {
        const existingIds = new Set(project.blocks.map((b) => b.id));
        const instruction = `${instructions.trim() || 'Rédige un texte clair, concret et sans superlatif.'}${tone ? ` Ton souhaité : ${tone.toLowerCase()}.` : ''} N'invente aucun fait, chiffre, prix ou avis.`;
        blocks = await Promise.all(
          blocks.map(async (block) => {
            if (existingIds.has(block.id) || FACTUAL_EXCLUDABLE_BLOCKS.includes(block.type) || block.type === 'navbar' || block.type === 'footer') return block;
            try {
              const rewritten = await apiRegenerateBlock({ block, instruction, siteName: project.name, activity: project.projectInput?.activity });
              return { ...block, content: { ...block.content, ...rewritten.content, image: block.content.image, secondaryImage: block.content.secondaryImage } };
            } catch {
              return block; // un bloc qui échoue garde son texte d'origine
            }
          }),
        );
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : 'La rédaction a échoué.');
      } finally {
        setBusy(false);
      }
    }
    onApply(blocks);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1C1917]/65 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-labelledby="new-page-title">
      <div className="bg-[#FFFFFF] border border-[#E5DEC9] rounded-sm w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E5DEC9] bg-[#FBF8F3] flex items-center justify-between gap-3">
          <h2 id="new-page-title" className="font-display text-lg font-semibold">Nouvelle page</h2>
          <div className="flex gap-1 p-1 bg-[#F4EFE6] rounded-sm" role="tablist">
            {([['templates', 'Modèles'], ['ai', 'Créer avec l’IA']] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`px-3 py-1.5 rounded-sm text-xs font-semibold cursor-pointer ${tab === id ? 'bg-[#FFFFFF] border border-[#E5DEC9]' : 'text-[#57534E]'}`}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="p-2 rounded-sm hover:bg-[#F4EFE6] cursor-pointer"><X className="w-5 h-5" aria-hidden="true" /></button>
        </div>

        {tab === 'templates' ? (
          <div className="flex-1 min-h-0 flex flex-col md:flex-row">
            <nav className="md:w-44 border-b md:border-b-0 md:border-r border-[#E5DEC9] p-2 flex md:flex-col gap-1 overflow-x-auto" aria-label="Catégories">
              {(['Tous', ...TEMPLATE_CATEGORIES] as const).map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={category === c} className={`text-left px-3 py-2 text-sm rounded-sm whitespace-nowrap cursor-pointer ${category === c ? 'bg-[#9A3412] text-white' : 'hover:bg-[#F4EFE6]'}`}>
                  {c}
                </button>
              ))}
            </nav>
            <div className="flex-1 overflow-y-auto p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 content-start editor-scroll">
              {templates.map((t) => (
                <button key={t.id} type="button" onClick={() => setSelectedId(t.id)} aria-pressed={selectedId === t.id} className={`text-left border rounded-sm p-3 space-y-2 cursor-pointer ${selectedId === t.id ? 'border-[#9A3412] ring-1 ring-[#9A3412]' : 'border-[#E5DEC9] hover:border-[#1C1917]/40'}`}>
                  <div className="space-y-1 bg-[#F4EFE6] p-2 rounded-[2px]" aria-hidden="true">
                    {t.blocks.map((b, i) => (
                      <div key={i} className="text-[9px] leading-none px-1.5 py-1.5 bg-white border border-[#E5DEC9] text-[#57534E]">{getBlockDefinition(b.type).label}</div>
                    ))}
                  </div>
                  <div className="font-semibold text-sm">{t.label}</div>
                  <div className="text-xs text-[#57534E]">{t.description}</div>
                </button>
              ))}
            </div>
            <aside className="md:w-72 border-t md:border-t-0 md:border-l border-[#E5DEC9] p-4 space-y-4 overflow-y-auto bg-[#FBF8F3]">
              <fieldset className="space-y-1.5">
                <legend className="text-xs font-semibold mb-1">Où l’ajouter ?</legend>
                {([['append', 'À la suite de la page actuelle'], ['replace', 'Remplacer la page actuelle']] as const).map(([id, label]) => (
                  <label key={id} className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="apply-mode" checked={mode === id} onChange={() => setMode(id)} className="accent-[#9A3412]" />{label}</label>
                ))}
              </fieldset>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer"><input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} className="accent-[#9A3412]" />Rédiger les textes avec l’IA</label>
                {useAi && (
                  <>
                    <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} placeholder="Consignes : activité, public, mots à employer…" aria-label="Consignes pour l’IA" className="w-full px-2.5 py-2 text-xs bg-white border border-[#E5DEC9] rounded-sm" />
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ton du texte">
                      {TONES.map((t) => (
                        <button key={t} type="button" aria-pressed={tone === t} onClick={() => setTone(tone === t ? null : t)} className={`px-2 py-1 rounded-sm border text-[11px] cursor-pointer ${tone === t ? 'bg-[#9A3412] border-[#9A3412] text-white' : 'bg-white border-[#E5DEC9]'}`}>{t}</button>
                      ))}
                    </div>
                    <AiNotice />
                  </>
                )}
              </div>
              {error && <p role="alert" className="text-xs text-red-800">{error}</p>}
              <button type="button" onClick={create} disabled={busy} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm bg-[#9A3412] hover:bg-[#7C2D12] text-white text-sm font-semibold disabled:opacity-60 cursor-pointer">
                {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {busy ? 'Rédaction…' : 'Créer la page'}
              </button>
            </aside>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 editor-scroll">
            <ProposalsFlow
              embedded
              onCancel={() => setTab('templates')}
              onChoose={(proposal) => {
                onApply(mode === 'replace' || project.blocks.length === 0 ? proposal.blocks : [...project.blocks.filter((b) => b.type !== 'footer'), ...proposal.blocks.filter((b) => b.type !== 'navbar' && b.type !== 'footer'), ...project.blocks.filter((b) => b.type === 'footer')], mode === 'replace' ? proposal.theme : undefined);
                onClose();
              }}
            />
            <fieldset className="mt-4 space-y-1.5">
              <legend className="text-xs font-semibold">Où ajouter la proposition choisie ?</legend>
              {([['append', 'À la suite de la page actuelle (garde votre style)'], ['replace', 'Remplacer la page et reprendre le style de la proposition']] as const).map(([id, label]) => (
                <label key={id} className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name="apply-mode-ai" checked={mode === id} onChange={() => setMode(id)} className="accent-[#9A3412]" />{label}</label>
              ))}
            </fieldset>
          </div>
        )}
      </div>
    </div>
  );
}

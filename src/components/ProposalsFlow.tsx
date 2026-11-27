import { useState } from 'react';
import { ArrowLeft, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import type { SiteProject } from '../types/site';
import { ApiClientError, apiGenerateProposals, type SiteProposal } from '../services/geminiClient';
import { HEADER_STYLES, LAYOUT_MODES } from '../utils/effectsCatalog';
import { AiNotice } from './AiNotice';

interface ProposalsFlowProps {
  /** Appelé avec le projet choisi */
  onChoose: (project: SiteProject) => void;
  onCancel: () => void;
  /** Dans la fenêtre « Nouvelle page » : titre et libellés adaptés */
  embedded?: boolean;
}

const field = 'w-full px-3 py-2 text-sm bg-[#FFFFFF] border border-[#E5DEC9] rounded-sm focus:border-[#9A3412] focus:outline-none';

const labelOf = <T extends string>(list: Array<{ id: T; label: string }>, id?: T) => list.find((o) => o.id === id)?.label ?? '';

/**
 * Mode « Générer avec l'IA » : trois champs (description, vision, éléments indispensables),
 * puis trois propositions différentes (mise en page, palette, polices, effets, photos libres de droits).
 */
export function ProposalsFlow({ onChoose, onCancel, embedded = false }: ProposalsFlowProps) {
  const [description, setDescription] = useState('');
  const [vision, setVision] = useState('');
  const [mustHave, setMustHave] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [proposals, setProposals] = useState<SiteProposal[] | null>(null);

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      setProposals(await apiGenerateProposals({ description, vision, mustHave }));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'La génération a échoué. Réessayez dans un instant.');
    } finally {
      setLoading(false);
    }
  };

  const heroImage = (p: SiteProject) =>
    p.blocks.map((b) => b.content.image || b.content.items?.find((i) => i.image)?.image).find(Boolean);

  return (
    <div className={embedded ? '' : 'min-h-screen bg-[#FBF8F3] text-[#1C1917]'}>
      <div className={`${embedded ? '' : 'max-w-5xl mx-auto px-5 py-8'} space-y-6`}>
        {!embedded && (
          <button type="button" onClick={onCancel} className="flex items-center gap-1.5 text-sm text-[#57534E] hover:text-[#1C1917] cursor-pointer">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Retour
          </button>
        )}

        {!proposals && (
          <form
            className="space-y-4 max-w-2xl"
            onSubmit={(e) => {
              e.preventDefault();
              if (description.trim() && !loading) void generate();
            }}
          >
            <div>
              <h2 className="font-display text-2xl font-semibold">Décrivez votre site, l’IA en propose trois</h2>
              <p className="text-sm text-[#57534E] mt-1">Trois mises en page, trois palettes, trois ambiances. Les photos viennent de banques libres de droits.</p>
            </div>
            <div>
              <label htmlFor="ai-description" className="block text-sm font-semibold mb-1">1. De quoi parle votre site ?</label>
              <textarea id="ai-description" required rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex. : une boulangerie artisanale de quartier qui vend du pain au levain et des viennoiseries" className={field} />
            </div>
            <div>
              <label htmlFor="ai-vision" className="block text-sm font-semibold mb-1">2. Quelle ambiance, quels effets ?</label>
              <textarea id="ai-vision" rows={3} value={vision} onChange={(e) => setVision(e.target.value)} placeholder="Ex. : chaleureux, tons crème et brun, images qui bougent au défilement, un peu de 3D sur les photos de pain" className={field} />
            </div>
            <div>
              <label htmlFor="ai-must" className="block text-sm font-semibold mb-1">3. Qu’est-ce qui doit absolument y figurer ?</label>
              <textarea id="ai-must" rows={3} value={mustHave} onChange={(e) => setMustHave(e.target.value)} placeholder="Ex. : la carte, les horaires, un formulaire de commande, une galerie" className={field} />
            </div>
            {error && (
              <div role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-sm p-3">
                {error}
              </div>
            )}
            <button type="submit" disabled={loading || !description.trim()} className="flex items-center gap-2 px-5 py-2.5 rounded-sm bg-[#9A3412] hover:bg-[#7C2D12] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Sparkles className="w-4 h-4" aria-hidden="true" />}
              {loading ? 'Création des trois propositions…' : error ? 'Réessayer' : 'Générer trois propositions'}
            </button>
            {loading && <p className="text-xs text-[#57534E]" role="status">Cela peut prendre une demi-minute : l’IA rédige, puis cherche des photos libres de droits.</p>}
            <AiNotice />
          </form>
        )}

        {proposals && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold">Choisissez une proposition</h2>
              <div className="flex gap-2">
                <button type="button" onClick={() => setProposals(null)} className="px-3 py-2 rounded-sm border border-[#E5DEC9] bg-[#FFFFFF] hover:bg-[#F4EFE6] text-sm cursor-pointer">Modifier le brief</button>
                <button type="button" onClick={generate} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-sm border border-[#E5DEC9] bg-[#FFFFFF] hover:bg-[#F4EFE6] text-sm cursor-pointer disabled:opacity-50">
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Trois autres
                </button>
              </div>
            </div>
            {error && <div role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-sm p-3">{error}</div>}
            <ul className="grid gap-4 md:grid-cols-3">
              {proposals.map((prop) => {
                const t = prop.project.theme;
                const img = heroImage(prop.project);
                return (
                  <li key={prop.id} className="border border-[#E5DEC9] bg-[#FFFFFF] rounded-sm overflow-hidden flex flex-col">
                    <div className="h-36 flex items-end p-3" style={{ background: img ? `center / cover url("${img}")` : t.palette.surface, color: t.palette.text }}>
                      <span className="px-2 py-1 text-xs font-semibold rounded-sm" style={{ background: t.palette.background, color: t.palette.text, fontFamily: `'${t.fonts.heading}', serif` }}>
                        {prop.project.name}
                      </span>
                    </div>
                    <div className="p-4 space-y-3 flex-1 flex flex-col">
                      <div>
                        <h3 className="font-semibold">{prop.name}</h3>
                        <p className="text-xs text-[#57534E] mt-1">{prop.concept}</p>
                      </div>
                      <div className="flex gap-1" aria-label="Palette">
                        {[t.palette.background, t.palette.surface, t.palette.primary, t.palette.secondary, t.palette.text].map((c, i) => (
                          <span key={i} className="w-5 h-5 rounded-sm border border-black/10" style={{ background: c }} />
                        ))}
                      </div>
                      <dl className="text-xs text-[#57534E] space-y-0.5">
                        <div><dt className="inline font-semibold">Architecture : </dt><dd className="inline">{labelOf(LAYOUT_MODES, t.layoutMode)}</dd></div>
                        <div><dt className="inline font-semibold">Navigation : </dt><dd className="inline">{labelOf(HEADER_STYLES, t.headerStyle)}</dd></div>
                        <div><dt className="inline font-semibold">Polices : </dt><dd className="inline">{t.fonts.heading} et {t.fonts.body}</dd></div>
                        <div><dt className="inline font-semibold">Sections : </dt><dd className="inline">{prop.project.blocks.length}</dd></div>
                      </dl>
                      <button type="button" onClick={() => onChoose(prop.project)} className="mt-auto px-4 py-2 rounded-sm bg-[#9A3412] hover:bg-[#7C2D12] text-white text-sm font-semibold cursor-pointer">
                        Choisir cette proposition
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <AiNotice />
          </div>
        )}
      </div>
    </div>
  );
}

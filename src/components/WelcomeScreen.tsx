import { ArrowRight, Copy, FolderOpen, Layers, Plus, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import type { SiteProject } from '../types/site';
import { getArtDirectionPreset } from '../utils/artDirections';

interface WelcomeScreenProps {
  savedProjects: SiteProject[];
  onStartMode: (mode: 'inspiration' | 'scratch') => void;
  onOpenProject: (project: SiteProject) => void;
  onOpenStarter: (preset: 'kora' | 'seve') => void;
  onDuplicateProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
}

export function WelcomeScreen({
  savedProjects,
  onStartMode,
  onOpenProject,
  onOpenStarter,
  onDuplicateProject,
  onDeleteProject,
}: WelcomeScreenProps) {
  return (
    <div className="min-h-screen bg-[#FBF8F3] text-[#1C1917] flex flex-col">
      {/* Top Bar */}
      <header className="bg-[#FFFFFF] border-b border-[#E5DEC9]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <div className="w-8 h-8 rounded-sm bg-[#9A3412] text-white flex items-center justify-center">
              <Layers className="w-4 h-4" aria-hidden="true" />
            </div>
            <span className="font-display font-semibold text-xl tracking-tight text-[#1C1917]">SiteForge</span>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#57534E]">
            <a href="#modes" className="hover:text-[#1C1917] transition-colors whitespace-nowrap shrink-0">
              Méthodes
            </a>
            <a href="#exemples" className="hover:text-[#1C1917] transition-colors whitespace-nowrap shrink-0">
              Exemples
            </a>
            {savedProjects.length > 0 && (
              <a href="#projets" className="hover:text-[#1C1917] transition-colors whitespace-nowrap shrink-0">
                Mes projets
              </a>
            )}
          </nav>

          <button
            type="button"
            onClick={() => onStartMode('scratch')}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Nouveau site
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 md:py-16 space-y-14">
        {/* Editorial Hero Intro */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end border-b border-[#E5DEC9] pb-10">
          <div className="lg:col-span-8 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9A3412]">
              Atelier de composition web assisté par Gemini
            </p>
            <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-[#1C1917] leading-[1.06] text-balance">
              Des sites singuliers, écrits avec vos vrais faits, bloc par bloc
            </h1>
          </div>
          <div className="lg:col-span-4">
            <p className="text-sm md:text-base text-[#57534E] leading-relaxed">
              Partez de l’architecture d’un site inspirant ou décrivez votre activité. SiteForge choisit une direction
              artistique dédiée, rédige un contenu sobre sans chiffres inventés et exporte un code autonome.
            </p>
          </div>
        </section>

        {/* Mandatory Anti-Plagiarism & Honesty Banner */}
        <aside
          aria-label="Avertissement anti-plagiat et honnêteté"
          className="bg-[#F4EFE6] border border-[#E5DEC9] border-l-4 border-l-[#B45309] p-4 md:p-5 flex items-start gap-3.5"
        >
          <ShieldCheck className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-[#1C1917] leading-relaxed">
            <strong className="font-semibold">Engagement d’originalité et d’honnêteté :</strong>{' '}
            Le modèle sert d’inspiration structurelle uniquement. Ne reproduis pas le logo, les images, les textes ou
            l’identité d’une autre marque. Aucune fausse statistique, aucun avis inventé ni aucun faux tarif n’est jamais généré.
          </div>
        </aside>

        {/* Two Main Creation Modes — Asymmetric Editorial Split */}
        <section id="modes" className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-6 bg-[#FFFFFF] border border-[#E5DEC9] p-7 flex flex-col justify-between gap-6 hover:border-[#9A3412]/50 transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono-tabular uppercase tracking-wider text-[#57534E]">01 · Structure</span>
                <Layers className="w-5 h-5 text-[#1C1917]" aria-hidden="true" />
              </div>
              <h2 className="font-display text-2xl font-semibold text-[#1C1917]">M’inspirer d’un modèle</h2>
              <p className="text-sm text-[#57534E] leading-relaxed">
                Importez une capture d’écran, indiquez une URL ou décrivez une mise en page. Gemini extrait uniquement
                les types de sections puis rédige un site original à partir de vos informations réelles.
              </p>
              <ul className="text-xs text-[#57534E] space-y-1.5 pt-2 border-t border-[#E5DEC9]/70">
                <li>1. Analyse structurelle seule (zéro texte ni chiffre repris)</li>
                <li>2. Direction artistique, palette et polices créées de zéro</li>
                <li>3. Contrôle d’originalité automatique en étape 3</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => onStartMode('inspiration')}
              className="w-full py-3 px-5 bg-[#1C1917] hover:bg-[#292524] text-white text-sm font-semibold rounded-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Partir d’une structure modèle</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="md:col-span-6 bg-[#F4EFE6] border border-[#E5DEC9] p-7 flex flex-col justify-between gap-6 hover:border-[#9A3412] transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono-tabular uppercase tracking-wider text-[#9A3412]">02 · Sur mesure</span>
                <Sparkles className="w-5 h-5 text-[#9A3412]" aria-hidden="true" />
              </div>
              <h2 className="font-display text-2xl font-semibold text-[#1C1917]">Créer de A à Z</h2>
              <p className="text-sm text-[#57534E] leading-relaxed">
                Décrivez votre métier, choisissez l’une des 8 directions artistiques, puis renseignez ce que vous avez
                de réel (produits, tarifs, coordonnées, photos). Les champs manquants restent clairement à compléter.
              </p>
              <ul className="text-xs text-[#57534E] space-y-1.5 pt-2 border-t border-[#E5DEC9]">
                <li>1. Étape guidée « Ce que tu peux me donner de vrai »</li>
                <li>2. Blocs modulaires réorganisables et alternance visuelle</li>
                <li>3. Export HTML autonome ou ZIP avec vérification des oublis</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => onStartMode('scratch')}
              className="w-full py-3 px-5 bg-[#9A3412] hover:bg-[#7C2D12] text-white text-sm font-semibold rounded-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Créer mon site de zéro</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </section>

        {/* Saved Projects in localStorage */}
        {savedProjects.length > 0 && (
          <section id="projets" className="space-y-4">
            <div className="flex items-baseline justify-between gap-4 border-b border-[#E5DEC9] pb-2">
              <h2 className="font-display text-xl font-semibold text-[#1C1917]">
                Vos projets enregistrés ({savedProjects.length})
              </h2>
              <span className="text-xs text-[#57534E]">Sauvegarde locale dans votre navigateur</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedProjects.map((prj) => {
                const preset = getArtDirectionPreset(prj.theme.artDirection);
                return (
                  <article
                    key={prj.id}
                    className="bg-[#FFFFFF] border border-[#E5DEC9] p-5 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display font-semibold text-base text-[#1C1917] truncate">{prj.name}</h3>
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-[#E5DEC9] shrink-0"
                          style={{ backgroundColor: prj.theme.palette.primary }}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {prj.isDemo && (
                          <span className="px-2 py-0.5 text-[11px] font-semibold bg-[#FEF3C7] text-[#78350F] border border-[#D97706]/40">
                            Exemple fictif
                          </span>
                        )}
                        <span className="text-xs text-[#57534E] font-mono-tabular">
                          {preset.label} · {prj.blocks.length} blocs
                        </span>
                      </div>
                      <p className="text-[11px] text-[#57534E] mt-1 font-mono-tabular">
                        Modifié le {new Date(prj.updatedAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenProject(prj)}
                        className="flex-1 py-2 px-3 rounded-sm bg-[#1C1917] hover:bg-[#292524] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Ouvrir</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicateProject(prj.id)}
                        aria-label={`Dupliquer ${prj.name}`}
                        className="p-2 rounded-sm border border-[#E5DEC9] hover:bg-[#F4EFE6] text-[#57534E] cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteProject(prj.id)}
                        aria-label={`Supprimer ${prj.name}`}
                        className="p-2 rounded-sm border border-[#E5DEC9] hover:bg-red-50 hover:text-red-800 hover:border-red-300 text-[#57534E] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* Quick-Start Demo Starters */}
        <section id="exemples" className="space-y-4">
          <div className="flex items-baseline justify-between gap-4 border-b border-[#E5DEC9] pb-2">
            <h2 className="font-display text-xl font-semibold text-[#1C1917]">
              Explorer l’éditeur avec un exemple fictif
            </h2>
            <span className="text-xs text-[#57534E]">Bandeau « Exemple fictif » inclus automatiquement</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#FFFFFF] border border-[#E5DEC9] p-5 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display font-semibold text-base text-[#1C1917]">
                    Atelier Kora — Architecture intérieure
                  </h3>
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-[#FEF3C7] text-[#78350F] border border-[#D97706]/40">
                    Exemple fictif
                  </span>
                </div>
                <p className="text-xs text-[#57534E]">
                  Direction Minimal luxe (vert bouteille) · 9 blocs sans fausses statistiques ni faux avis
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenStarter('kora')}
                className="px-3.5 py-2 rounded-sm border border-[#1C1917] hover:bg-[#1C1917] hover:text-white text-xs font-semibold text-[#1C1917] whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Ouvrir l’exemple</span>
              </button>
            </div>

            <div className="bg-[#FFFFFF] border border-[#E5DEC9] p-5 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display font-semibold text-base text-[#1C1917]">
                    Maison Sève — Céramique utilitaire
                  </h3>
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-[#FEF3C7] text-[#78350F] border border-[#D97706]/40">
                    Exemple fictif
                  </span>
                </div>
                <p className="text-xs text-[#57534E]">
                  Direction Artisanal chaleureux (ocre miel) · Catalogue et champs à compléter
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenStarter('seve')}
                className="px-3.5 py-2 rounded-sm border border-[#1C1917] hover:bg-[#1C1917] hover:text-white text-xs font-semibold text-[#1C1917] whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Ouvrir l’exemple</span>
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

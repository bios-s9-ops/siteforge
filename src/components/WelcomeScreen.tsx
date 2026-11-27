import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Copy, FolderOpen, PenLine, Sparkles, Trash2, Upload, Wand2 } from 'lucide-react';
import type { SiteProject } from '../types/site';
import { AiNotice } from './AiNotice';
import { ForgeLogo } from './ForgeLogo';

type StartMode = 'inspiration' | 'scratch' | 'ai';

interface WelcomeScreenProps {
  savedProjects: SiteProject[];
  onStartMode: (mode: StartMode) => void;
  onOpenProject: (project: SiteProject) => void;
  onOpenStarter: (preset: 'kora' | 'seve') => void;
  onDuplicateProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onImportFile: (file: File) => void;
  importError?: string;
}

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Progression d'une scène : 0 avant son début, 1 après sa fin */
const seg = (p: number, from: number, to: number) => smooth(clamp((p - from) / (to - from)));

/** Progression de défilement (0 à 1) à travers un bloc haut, utilisée pour chorégraphier les écrans de démonstration. */
function useScrollProgress(ref: React.RefObject<HTMLElement | null>): number {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = Math.max(1, r.height - window.innerHeight);
      setProgress(clamp(-r.top / total));
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [ref]);
  return progress;
}

const bar = (w: string, h = 'h-2', tone = 'bg-[#1C1917]/80') => <div className={`${h} ${tone} rounded-[1px]`} style={{ width: w }} />;

/** Maquette de l'éditeur : palette, page, réglages. Dessinée en formes simples, sans image. */
function EditorMock() {
  return (
    <div className="w-full h-full bg-[#FBF8F3] border border-[#C9BFA6] rounded-sm shadow-xl overflow-hidden flex text-[#1C1917]">
      <div className="w-[22%] border-r border-[#E5DEC9] p-2 space-y-1.5 bg-[#F4EFE6]">
        {['Intro', 'Contenu', 'Images', 'Contact'].map((t) => (
          <div key={t} className="text-[8px] font-semibold px-1.5 py-1 bg-white border border-[#E5DEC9] rounded-[1px]">{t}</div>
        ))}
        <div className="grid grid-cols-2 gap-1 pt-1">{[0, 1, 2, 3].map((i) => <div key={i} className="h-5 border border-[#E5DEC9] bg-white rounded-[1px]" />)}</div>
      </div>
      <div className="flex-1 p-2.5 space-y-2 bg-[#E9E2D0]">
        <div className="bg-white p-2.5 space-y-1.5 border border-[#9A3412]">{bar('62%', 'h-3')}{bar('85%')}{bar('40%', 'h-4', 'bg-[#9A3412]')}</div>
        <div className="grid grid-cols-3 gap-1.5">{[0, 1, 2].map((i) => <div key={i} className="bg-white h-12 p-1.5 space-y-1">{bar('70%')}{bar('90%', 'h-1.5', 'bg-[#1C1917]/30')}</div>)}</div>
        <div className="border-2 border-dashed border-[#9A3412]/60 text-[8px] text-[#9A3412] text-center py-1.5 font-semibold">Déposer ici</div>
      </div>
      <div className="w-[24%] border-l border-[#E5DEC9] p-2 space-y-2 bg-white">
        {bar('80%', 'h-2.5')}{bar('100%', 'h-5', 'bg-[#F4EFE6]')}{bar('60%', 'h-2.5')}
        <div className="flex gap-1">{['#7C2D12', '#14532D', '#1E3A5F', '#FBF8F3'].map((c) => <span key={c} className="w-3.5 h-3.5 border border-black/10" style={{ background: c }} />)}</div>
      </div>
    </div>
  );
}

/** Maquette de site éditorial : grand titre, image, sections alternées. */
function EditorialMock() {
  return (
    <div className="w-full h-full bg-[#F3EDE2] border border-[#C9BFA6] rounded-sm shadow-xl overflow-hidden text-[#1F1B18]">
      <div className="flex justify-between items-center px-4 py-2 border-b border-black/15">{bar('20%', 'h-2.5')}<div className="flex gap-2">{bar('18px', 'h-1.5')}{bar('18px', 'h-1.5')}{bar('18px', 'h-1.5')}</div></div>
      <div className="grid grid-cols-5 gap-3 p-4">
        <div className="col-span-3 space-y-2 pt-2">{bar('95%', 'h-5')}{bar('70%', 'h-5')}{bar('85%', 'h-1.5', 'bg-black/35')}{bar('60%', 'h-1.5', 'bg-black/35')}<div className="w-16 h-5 bg-[#991B1B] mt-2" /></div>
        <div className="col-span-2 h-28 bg-[#CFC3A8] border border-black/10" />
      </div>
      <div className="bg-[#1F1B18] px-4 py-3 flex gap-3">{[0, 1, 2].map((i) => <div key={i} className="flex-1 space-y-1">{bar('70%', 'h-2', 'bg-[#F3EDE2]')}{bar('90%', 'h-1.5', 'bg-[#F3EDE2]/40')}</div>)}</div>
    </div>
  );
}

/** Maquette de site en grille bento. */
function BentoMock() {
  return (
    <div className="w-full h-full bg-[#F4F4F0] border border-[#C9BFA6] rounded-sm shadow-xl overflow-hidden p-3 text-[#111]">
      <div className="grid grid-cols-6 grid-rows-4 gap-2 h-full">
        <div className="col-span-4 row-span-2 bg-[#111] p-3 space-y-2">{bar('70%', 'h-4', 'bg-[#F4F4F0]')}{bar('50%', 'h-4', 'bg-[#F4F4F0]')}<div className="w-14 h-5 bg-[#C2410C] mt-2" /></div>
        <div className="col-span-2 row-span-1 bg-white border border-black/15 p-2 space-y-1">{bar('60%')}{bar('85%', 'h-1.5', 'bg-black/30')}</div>
        <div className="col-span-2 row-span-1 bg-[#C2410C]" />
        <div className="col-span-2 row-span-2 bg-[#CFCFC6]" />
        <div className="col-span-2 row-span-2 bg-white border border-black/15 p-2 space-y-1.5">{bar('70%')}{bar('90%', 'h-1.5', 'bg-black/30')}{bar('80%', 'h-1.5', 'bg-black/30')}</div>
        <div className="col-span-2 row-span-2 bg-white border border-black/15 p-2 space-y-1.5">{bar('55%')}{bar('90%', 'h-1.5', 'bg-black/30')}</div>
      </div>
    </div>
  );
}

const SCENES = [
  { title: 'Un éditeur par blocs', text: 'Faites glisser des sections sur la page, modifiez les textes en cliquant dessus, réglez les couleurs et les polices.' },
  { title: 'Des mises en page assumées', text: 'Vertical, diapositives horizontales, grille bento, écran partagé ou récit au défilement : l’architecture change tout le rythme du site.' },
  { title: 'Des effets qui servent le contenu', text: 'Parallaxe, zoom, inclinaison 3D, avant / après. Chaque effet se règle, et se coupe, image par image.' },
];

export function WelcomeScreen({
  savedProjects,
  onStartMode,
  onOpenProject,
  onOpenStarter,
  onDuplicateProject,
  onDeleteProject,
  onImportFile,
  importError,
}: WelcomeScreenProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const p = useScrollProgress(stageRef);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Chorégraphie : l'éditeur entre, recule ; le site éditorial entre, recule ; le bento arrive
  const a = seg(p, 0.0, 0.18);
  const aOut = seg(p, 0.3, 0.45);
  const b = seg(p, 0.33, 0.52);
  const bOut = seg(p, 0.64, 0.78);
  const c = seg(p, 0.66, 0.85);

  const layer = (inP: number, outP: number, depth: number): CSSProperties => ({
    opacity: inP * (1 - outP),
    transform: `translate3d(${(1 - inP) * 8}%, ${(1 - inP) * 14 + outP * -6}%, 0) scale(${0.82 + inP * 0.18 - outP * 0.1}) rotateX(${(1 - inP) * 10}deg)`,
    zIndex: depth,
  });
  const sceneIndex = p < 0.33 ? 0 : p < 0.66 ? 1 : 2;

  const start =
    'flex flex-col items-start gap-1 text-left p-5 border border-[#E5DEC9] bg-[#FFFFFF] hover:border-[#9A3412] rounded-sm transition-colors cursor-pointer';

  return (
    <div className="min-h-screen bg-[#FBF8F3] text-[#1C1917]">
      <header className="max-w-6xl mx-auto px-5 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ForgeLogo size={36} title="SiteForge" />
          <span className="font-display text-xl font-semibold tracking-tight">SiteForge</span>
        </div>
        <button type="button" onClick={() => importRef.current?.click()} className="flex items-center gap-1.5 text-sm text-[#57534E] hover:text-[#1C1917] cursor-pointer">
          <Upload className="w-4 h-4" aria-hidden="true" /> Ouvrir un fichier .forge.json
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImportFile(f);
            e.target.value = '';
          }}
        />
      </header>

      <section className="max-w-6xl mx-auto px-5 pt-10 pb-14">
        <h1 className="font-display text-4xl md:text-6xl font-semibold leading-[1.05] max-w-3xl">Construisez le site que vous imaginez, bloc par bloc.</h1>
        <p className="mt-5 text-lg text-[#57534E] max-w-2xl">
          SiteForge assemble des sites sobres, rapides et prêts à publier. Vous choisissez les sections, les images et les effets ; l’IA aide à rédiger quand vous le demandez.
        </p>
        {importError && <p role="alert" className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded-sm p-3 max-w-xl">{importError}</p>}
        <div className="mt-8 grid gap-3 md:grid-cols-3 max-w-4xl">
          <button type="button" onClick={() => onStartMode('scratch')} className={start}>
            <PenLine className="w-5 h-5 text-[#9A3412]" aria-hidden="true" />
            <span className="font-semibold">Partir de zéro</span>
            <span className="text-sm text-[#57534E]">Une page vierge : vous ajoutez les blocs et les images.</span>
          </button>
          <button type="button" onClick={() => onStartMode('inspiration')} className={start}>
            <Wand2 className="w-5 h-5 text-[#9A3412]" aria-hidden="true" />
            <span className="font-semibold">S’inspirer d’un modèle</span>
            <span className="text-sm text-[#57534E]">Reprend la structure et les effets d’une référence. Les images restent vides.</span>
          </button>
          <button type="button" onClick={() => onStartMode('ai')} className={start}>
            <Sparkles className="w-5 h-5 text-[#9A3412]" aria-hidden="true" />
            <span className="font-semibold">Générer avec l’IA</span>
            <span className="text-sm text-[#57534E]">Trois propositions différentes à partir de votre description.</span>
          </button>
        </div>
      </section>

      {/* Démonstration chorégraphiée par le défilement */}
      <section ref={stageRef} aria-label="Démonstration" className="relative" style={{ height: reduce ? 'auto' : '380vh' }}>
        {reduce ? (
          <div className="max-w-5xl mx-auto px-5 py-10 grid gap-8 md:grid-cols-3">
            {[<EditorMock key="e" />, <EditorialMock key="s" />, <BentoMock key="b" />].map((m, i) => (
              <div key={i} className="space-y-3"><div className="aspect-[4/3]">{m}</div><h3 className="font-semibold">{SCENES[i].title}</h3><p className="text-sm text-[#57534E]">{SCENES[i].text}</p></div>
            ))}
          </div>
        ) : (
          <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden px-5" style={{ perspective: '1400px' }}>
            <div className="relative w-full max-w-3xl aspect-[16/10]">
              <div className="absolute inset-0" style={layer(a, aOut, 1)}><EditorMock /></div>
              <div className="absolute inset-0" style={layer(b, bOut, 2)}><EditorialMock /></div>
              <div className="absolute inset-0" style={layer(c, 0, 3)}><BentoMock /></div>
            </div>
            <div className="mt-8 max-w-xl text-center min-h-[96px]" aria-live="polite">
              <h2 className="font-display text-2xl font-semibold">{SCENES[sceneIndex].title}</h2>
              <p className="mt-2 text-[#57534E]">{SCENES[sceneIndex].text}</p>
            </div>
            <div className="flex gap-1.5 mt-3" aria-hidden="true">
              {SCENES.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === sceneIndex ? 'w-8 bg-[#9A3412]' : 'w-3 bg-[#C9BFA6]'}`} />)}
            </div>
          </div>
        )}
      </section>

      <section className="max-w-6xl mx-auto px-5 py-14 space-y-10">
        <div className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">Vos projets</h2>
          {savedProjects.length === 0 ? (
            <p className="text-sm text-[#57534E]">Aucun projet enregistré pour le moment. Ils sont gardés dans ce navigateur ; exportez en .forge.json pour les sauvegarder ailleurs.</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-3">
              {savedProjects.map((project) => (
                <li key={project.id} className="border border-[#E5DEC9] bg-[#FFFFFF] rounded-sm p-4 space-y-3">
                  <div>
                    <div className="font-semibold truncate">{project.name}</div>
                    <div className="text-xs text-[#57534E]">{project.blocks.length} bloc{project.blocks.length > 1 ? 's' : ''} · modifié le {new Date(project.updatedAt).toLocaleDateString('fr-FR')}</div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => onOpenProject(project)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#1C1917] text-white text-xs font-semibold cursor-pointer"><FolderOpen className="w-3.5 h-3.5" aria-hidden="true" /> Ouvrir</button>
                    <button type="button" onClick={() => onDuplicateProject(project.id)} aria-label={`Dupliquer ${project.name}`} className="px-2.5 rounded-sm border border-[#E5DEC9] hover:bg-[#F4EFE6] cursor-pointer"><Copy className="w-3.5 h-3.5" aria-hidden="true" /></button>
                    <button type="button" onClick={() => onDeleteProject(project.id)} aria-label={`Supprimer ${project.name}`} className="px-2.5 rounded-sm border border-[#E5DEC9] hover:bg-red-50 cursor-pointer"><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Exemples fictifs pour explorer l’éditeur</h2>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => onOpenStarter('kora')} className="px-4 py-2 rounded-sm border border-[#E5DEC9] bg-[#FFFFFF] hover:border-[#9A3412] text-sm cursor-pointer">Atelier Kora, architecture intérieure</button>
            <button type="button" onClick={() => onOpenStarter('seve')} className="px-4 py-2 rounded-sm border border-[#E5DEC9] bg-[#FFFFFF] hover:border-[#9A3412] text-sm cursor-pointer">Maison Sève, céramique utilitaire</button>
          </div>
        </div>
        <AiNotice />
      </section>
    </div>
  );
}

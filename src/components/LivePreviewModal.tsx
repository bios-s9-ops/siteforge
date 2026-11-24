import { useEffect, useState } from 'react';
import { Info, Monitor, Smartphone, Tablet, X } from 'lucide-react';
import type { SiteProject, ViewportMode } from '../types/site';
import { generateStandaloneHtml, inlineLocalAssets } from '../utils/exporter';
import { describeFormDelivery } from '../utils/forms';

interface LivePreviewModalProps {
  isOpen: boolean;
  project: SiteProject;
  onClose: () => void;
}

const WIDTHS: Record<ViewportMode, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '390px',
};

/**
 * Affiche exactement le HTML qui sera exporté : navigation, menu mobile, liens et formulaires fonctionnent.
 * Par défaut, les formulaires sont en mode test : ils montrent ce qui serait envoyé, sans rien transmettre.
 */
export function LivePreviewModal({ isOpen, project, onClose }: LivePreviewModalProps) {
  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  const [realSend, setRealSend] = useState(false);
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    inlineLocalAssets(project).then((ready) => {
      if (!cancelled) setHtml(generateStandaloneHtml(ready, { dryRun: !realSend }));
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, project, realSend]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const delivery = describeFormDelivery(project);
  const tabs: Array<{ id: ViewportMode; label: string; Icon: typeof Monitor }> = [
    { id: 'desktop', label: 'Ordinateur', Icon: Monitor },
    { id: 'tablet', label: 'Tablette', Icon: Tablet },
    { id: 'mobile', label: 'Mobile', Icon: Smartphone },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1C1917]/65 flex items-center justify-center p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-preview-title"
    >
      <div className="bg-[#FFFFFF] border border-[#E5DEC9] rounded-sm w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5DEC9] bg-[#FBF8F3] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="live-preview-title" className="font-display text-lg font-semibold text-[#1C1917]">
              Tester le site
            </h2>
            <p className="text-xs text-[#57534E]">
              Menu, liens et formulaire fonctionnent comme sur le site publié.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#F4EFE6] rounded-sm" role="group" aria-label="Taille de l’écran">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setViewport(id)}
                aria-pressed={viewport === id}
                className={`px-3 py-1.5 rounded-sm text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                  viewport === id ? 'bg-[#FFFFFF] text-[#1C1917] border border-[#E5DEC9]' : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le test"
            className="p-2 rounded-sm text-[#57534E] hover:bg-[#F4EFE6] hover:text-[#1C1917] cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="px-4 py-2.5 border-b border-[#E5DEC9] bg-[#F4EFE6] flex flex-wrap items-start gap-x-4 gap-y-2 text-xs text-[#1C1917]">
          <label className="flex items-center gap-2 font-semibold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={realSend}
              onChange={(e) => setRealSend(e.target.checked)}
              className="w-4 h-4 accent-[#9A3412]"
            />
            <span>Envoyer pour de vrai depuis ce test</span>
          </label>
          <span className="flex items-start gap-1.5 text-[#57534E] flex-1 min-w-[240px]">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              {realSend
                ? `Attention : un envoi sera réellement transmis. ${delivery.text}`
                : 'Mode test : le formulaire affiche ce qui serait envoyé, sans rien transmettre.'}
            </span>
          </span>
        </div>

        <div className="flex-1 overflow-auto bg-[#D6CEBA] p-3 flex justify-center">
          {html ? (
            <iframe
              title="Aperçu interactif du site"
              srcDoc={html}
              sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
              style={{ width: WIDTHS[viewport], maxWidth: '100%' }}
              className="h-full bg-white border border-[#C9BFA6] rounded-sm transition-all duration-200"
            />
          ) : (
            <p className="text-sm text-[#57534E] self-center">Préparation de l’aperçu…</p>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Copy, Download, FileArchive, FileCode2, Info, X } from 'lucide-react';
import type { SiteProject } from '../types/site';
import {
  exportProjectAsZipBlob,
  generateSeparateHtmlAndCss,
  generateStandaloneHtml,
  inlineLocalAssets,
} from '../utils/exporter';
import { collectIncompleteFields } from '../utils/honesty';
import { collectPublishIssues } from '../utils/publish';
import { AiNotice } from './AiNotice';
import { getSiteSettings, normalizeSiteUrl } from '../utils/siteSettings';

interface ExportModalProps {
  isOpen: boolean;
  project: SiteProject;
  onClose: () => void;
  onOpenPublishSettings?: () => void;
  onSelectBlock?: (blockId: string) => void;
}

export function ExportModal({ isOpen, project, onClose, onOpenPublishSettings, onSelectBlock }: ExportModalProps) {
  const [tab, setTab] = useState<'single' | 'zip'>('single');
  const [copied, setCopied] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [confirmIncomplete, setConfirmIncomplete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfirmIncomplete(false);
      setCopied(false);
    }
  }, [isOpen, project.id]);

  const incompleteFields = useMemo(() => (isOpen ? collectIncompleteFields(project) : []), [isOpen, project]);
  const publishIssues = useMemo(() => (isOpen ? collectPublishIssues(project) : []), [isOpen, project]);
  const [standaloneHtml, setStandaloneHtml] = useState('');

  // Le fichier HTML unique embarque les images locales de l'application pour rester autonome.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    inlineLocalAssets(project).then((ready) => {
      if (!cancelled) setStandaloneHtml(generateStandaloneHtml(ready));
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, project]);
  const separate = useMemo(() => (isOpen ? generateSeparateHtmlAndCss(project) : null), [isOpen, project]);

  if (!isOpen) return null;

  const slug =
    project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'mon-site';

  const warnings = publishIssues.filter((i) => i.severity === 'warning');
  const reminders = publishIssues.filter((i) => i.severity === 'info');
  const needsConfirmation = incompleteFields.length > 0 || warnings.length > 0;
  const exportBlocked = needsConfirmation && !confirmIncomplete;
  const hasSiteUrl = Boolean(normalizeSiteUrl(getSiteSettings(project).siteUrl));

  const handleCopy = async () => {
    if (exportBlocked) return;
    const code = tab === 'single' ? standaloneHtml : separate?.indexHtml ?? '';
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingleHtml = () => {
    if (exportBlocked) return;
    const blob = new Blob([standaloneHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    if (exportBlocked) return;
    setDownloadingZip(true);
    try {
      const blob = await exportProjectAsZipBlob(project);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1C1917]/55 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div className="bg-[#FFFFFF] border border-[#E5DEC9] rounded-sm w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5DEC9] bg-[#FBF8F3] flex items-center justify-between gap-4">
          <div>
            <h2 id="export-modal-title" className="font-display text-xl font-semibold text-[#1C1917]">
              Exporter « {project.name} »
            </h2>
            <p className="text-xs text-[#57534E]">
              Code HTML5/CSS3 sémantique, responsive, accessible et 100 % indépendant de SiteForge
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre d’export"
            className="p-2 rounded-sm text-[#57534E] hover:bg-[#F4EFE6] hover:text-[#1C1917] cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Demo mandatory mention notice */}
        {project.isDemo && (
          <div className="px-6 py-3 bg-[#FEF3C7] border-b border-[#D97706]/50 flex items-start gap-2.5 text-xs text-[#78350F]">
            <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              <strong>Projet de démonstration :</strong> la mention « Exemple fictif » reste obligatoirement intégrée en
              tête des fichiers exportés pour éviter toute confusion avec un site réel.
            </span>
          </div>
        )}

        {/* Points à régler avant la mise en ligne + confirmation obligatoire */}
        {(incompleteFields.length > 0 || publishIssues.length > 0) && (
          <div className="px-6 py-4 bg-[#F4EFE6] border-b border-[#E5DEC9] space-y-3 max-h-[34vh] overflow-y-auto editor-scroll">
            {warnings.length > 0 && (
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1.5 text-xs text-[#1C1917] flex-1">
                  <div className="font-semibold">
                    {warnings.length} point{warnings.length > 1 ? 's' : ''} à régler pour que le site fonctionne vraiment :
                  </div>
                  <ul className="space-y-1.5">
                    {warnings.map((w) => (
                      <li key={w.id} className="text-[#57534E]">
                        <strong className="text-[#1C1917]">{w.title}.</strong> {w.detail}{' '}
                        {w.fix?.kind === 'publish-settings' && onOpenPublishSettings && (
                          <button type="button" onClick={onOpenPublishSettings} className="font-semibold text-[#9A3412] underline cursor-pointer">
                            Régler
                          </button>
                        )}
                        {w.fix?.kind === 'block' && onSelectBlock && (
                          <button
                            type="button"
                            onClick={() => w.fix?.kind === 'block' && onSelectBlock(w.fix.blockId)}
                            className="font-semibold text-[#9A3412] underline cursor-pointer"
                          >
                            Aller au bloc
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {incompleteFields.length > 0 && (
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1 text-xs text-[#1C1917]">
                  <div className="font-semibold">
                    Il reste {incompleteFields.length} champ{incompleteFields.length > 1 ? 's' : ''} « À compléter » dans ce projet :
                  </div>
                  <ul className="list-disc pl-4 text-[#57534E] space-y-0.5 max-h-24 overflow-y-auto editor-scroll">
                    {incompleteFields.slice(0, 8).map((f) => (
                      <li key={f.id}>
                        <strong>{f.blockLabel}</strong> — {f.fieldLabel}
                      </li>
                    ))}
                    {incompleteFields.length > 8 && <li>… et {incompleteFields.length - 8} autre(s) champ(s)</li>}
                  </ul>
                </div>
              </div>
            )}

            {reminders.length > 0 && (
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#57534E] shrink-0 mt-0.5" aria-hidden="true" />
                <ul className="space-y-1 text-xs text-[#57534E]">
                  {reminders.map((r) => (
                    <li key={r.id}>
                      <strong className="text-[#1C1917]">{r.title}.</strong> {r.detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <AiNotice />

            {needsConfirmation && (
              <label className="flex items-center gap-2.5 text-xs font-semibold text-[#1C1917] cursor-pointer select-none bg-[#FFFFFF] border border-[#E5DEC9] px-3 py-2 rounded-sm">
                <input
                  type="checkbox"
                  checked={confirmIncomplete}
                  onChange={(e) => setConfirmIncomplete(e.target.checked)}
                  className="w-4 h-4 accent-[#9A3412]"
                />
                <span>Je confirme vouloir exporter le site malgré ces points encore à régler.</span>
              </label>
            )}
          </div>
        )}

        <div className="px-6 py-3 border-b border-[#E5DEC9] flex flex-wrap items-center justify-between gap-3 bg-[#FFFFFF]">
          <div className="flex items-center gap-1 p-1 bg-[#F4EFE6] rounded-sm">
            <button
              type="button"
              onClick={() => setTab('single')}
              className={`px-3.5 py-1.5 rounded-sm text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                tab === 'single' ? 'bg-[#FFFFFF] text-[#1C1917] border border-[#E5DEC9]' : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>HTML unique (CSS inclus)</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('zip')}
              className={`px-3.5 py-1.5 rounded-sm text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                tab === 'zip' ? 'bg-[#FFFFFF] text-[#1C1917] border border-[#E5DEC9]' : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              <FileArchive className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Archive ZIP (index.html + style.css + assets)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={exportBlocked}
              className="px-3.5 py-2 rounded-sm border border-[#E5DEC9] hover:bg-[#F4EFE6] disabled:opacity-45 disabled:cursor-not-allowed text-xs font-semibold text-[#1C1917] flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
              <span>{copied ? 'Copié' : 'Copier le code'}</span>
            </button>
            {tab === 'single' ? (
              <button
                type="button"
                onClick={handleDownloadSingleHtml}
                disabled={exportBlocked}
                className="px-4 py-2 rounded-sm bg-[#9A3412] hover:bg-[#7C2D12] disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Télécharger {slug}.html</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={downloadingZip || exportBlocked}
                className="px-4 py-2 rounded-sm bg-[#9A3412] hover:bg-[#7C2D12] disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{downloadingZip ? 'Création du ZIP...' : `Télécharger ${slug}.zip`}</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 bg-[#1C1917] text-[#FBF8F3] editor-scroll space-y-4">
          {tab === 'zip' && separate && (
            <div className="text-xs text-[#E5DEC9] bg-[#292524] border border-[#44403C] rounded-sm p-3.5 space-y-1">
              <div className="font-semibold text-white">Contenu de l’archive {slug}.zip :</div>
              <div>• index.html</div>
              <div>• style.css</div>
              <div>• favicon.svg, robots.txt{hasSiteUrl ? ', sitemap.xml' : ''}</div>
              <div>• LISEZMOI.md (guide de mise en ligne : adresse gratuite, nom de domaine, réception des messages)</div>
              <div>• assets/ ({separate.assetSources.length} média{separate.assetSources.length > 1 ? 's' : ''})</div>
            </div>
          )}
          <pre className="text-xs font-mono-tabular leading-relaxed whitespace-pre-wrap break-words">
            {tab === 'single' ? standaloneHtml : separate?.indexHtml}
          </pre>
        </div>
      </div>
    </div>
  );
}

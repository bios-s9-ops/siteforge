import { useState, type FormEvent } from 'react';
import { Loader2, Send, Sparkles, Undo2, X } from 'lucide-react';
import type { SiteMutation, SiteProject } from '../types/site';
import { ApiClientError, apiMutateSite } from '../services/geminiClient';

interface AICopilotDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project: SiteProject;
  onApply: (prompt: string, mutations: SiteMutation[]) => void;
  onUndo: () => void;
  canUndo: boolean;
}

export function AICopilotDrawer({ isOpen, onOpenChange, project, onApply, onUndo, canUndo }: AICopilotDrawerProps) {
  const [prompt, setPrompt] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const userPrompt = prompt.trim();
    if (!userPrompt || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await apiMutateSite({
        userPrompt,
        activePageId: project.activePageId,
        projectSnapshot: project,
      });
      if (result.mutations.length) onApply(userPrompt, result.mutations);
      setMessage(result.assistantMessage);
      setPrompt('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'La modification a échoué. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Fermer le copilote IA' : 'Ouvrir le copilote IA'}
        className="fixed bottom-5 right-5 z-[79] flex items-center gap-2 rounded-full bg-[#1C1917] px-4 py-3 text-sm font-semibold text-white shadow-xl hover:bg-[#292524]"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        Copilote IA
      </button>
      {isOpen && (
        <aside
          aria-label="Copilote IA SiteForge"
          className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-md flex-col border-l border-[#E5DEC9] bg-[#FBF8F3] text-[#1C1917] shadow-2xl"
        >
          <header className="flex items-center justify-between border-b border-[#E5DEC9] bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#9A3412]" aria-hidden="true" />
              <h2 className="font-semibold">Co-créateur SiteForge</h2>
            </div>
            <button type="button" onClick={() => onOpenChange(false)} aria-label="Fermer le copilote" className="rounded-sm p-2 text-[#57534E] hover:bg-[#F4EFE6]">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <p className="text-sm text-[#57534E]">
              Décrivez un changement à appliquer au projet. Les informations factuelles non fournies restent « À compléter ».
            </p>
            {message && <div className="rounded-sm border border-[#E5DEC9] bg-white p-3 text-sm" role="status">{message}</div>}
            {error && <div className="rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</div>}
            {canUndo && (
              <button type="button" onClick={onUndo} className="flex items-center gap-2 rounded-sm border border-[#E5DEC9] bg-white px-3 py-2 text-sm font-semibold hover:bg-[#F4EFE6]">
                <Undo2 className="h-4 w-4" aria-hidden="true" /> Annuler la modification IA
              </button>
            )}
          </div>
          <form onSubmit={submit} className="border-t border-[#E5DEC9] bg-white p-4">
            <label htmlFor="ai-copilot-prompt" className="mb-1 block text-xs font-semibold">Votre demande</label>
            <textarea
              id="ai-copilot-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={2400}
              rows={4}
              placeholder="Ex. : passe la navigation en capsule flottante avec un verre dépoli"
              className="w-full resize-y rounded-sm border border-[#E5DEC9] bg-white p-3 text-sm outline-none focus:border-[#9A3412]"
            />
            <button type="submit" disabled={busy || !prompt.trim()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-sm bg-[#9A3412] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              {busy ? 'Application…' : 'Appliquer'}
            </button>
          </form>
        </aside>
      )}
    </>
  );
}

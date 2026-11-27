import { useCallback, useEffect, useState } from 'react';
import type { SiteProject } from '../types/site';
import { canRedo, canUndo, createHistory, pushHistory, redoHistory, undoHistory, type HistoryState } from '../utils/history';

/** Historique du projet : retour arrière, rétablissement et instantanés à chaque modification. */
export function useProjectHistory(initial: () => SiteProject) {
  const [history, setHistory] = useState<HistoryState<SiteProject>>(() => createHistory(initial()));

  const push = useCallback((project: SiteProject) => setHistory((h) => pushHistory(h, project)), []);
  const undo = useCallback(() => setHistory((h) => undoHistory(h)), []);
  const redo = useCallback(() => setHistory((h) => redoHistory(h)), []);
  const reset = useCallback((project: SiteProject) => setHistory(createHistory(project)), []);

  return {
    present: history.present,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    push,
    undo,
    redo,
    reset,
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

/**
 * Raccourcis Ctrl/Cmd + Z (annuler), Ctrl + Y ou Ctrl/Cmd + Maj + Z (rétablir).
 * Ignorés pendant la saisie dans un champ : le navigateur annule alors le texte en cours.
 */
export function useHistoryShortcuts(enabled: boolean, onUndo: () => void, onRedo: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        onRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, onUndo, onRedo]);
}

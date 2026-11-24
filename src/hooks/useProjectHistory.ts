import { useState, useCallback, useEffect } from 'react';

export interface ProjectSnapshot<T> {
  id: string;
  label: string;
  timestamp: string;
  state: T;
}

export function useProjectHistory<T>(initialState: T, maxEntries = 50) {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initialState);
  const [future, setFuture] = useState<T[]>([]);
  const [snapshots, setSnapshots] = useState<ProjectSnapshot<T>[]>([]);

  const setState = useCallback(
    (next: T | ((prev: T) => T), recordHistory = true) => {
      setPresent((curr) => {
        const resolved = typeof next === 'function' ? (next as (prev: T) => T)(curr) : next;
        if (JSON.stringify(resolved) === JSON.stringify(curr)) return curr;
        if (recordHistory) {
          setPast((p) => [...p.slice(-(maxEntries - 1)), curr]);
          setFuture([]);
        }
        return resolved;
      });
    },
    [maxEntries],
  );

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];
      setPresent((curr) => {
        setFuture((f) => [curr, ...f]);
        return previous;
      });
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setPresent((curr) => {
        setPast((p) => [...p, curr]);
        return next;
      });
      return f.slice(1);
    });
  }, []);

  const saveSnapshot = useCallback(
    (label: string, stateToSave?: T) => {
      const target = stateToSave ?? present;
      setSnapshots((prev) => [
        {
          id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          label,
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          state: structuredClone(target),
        },
        ...prev.slice(0, 19),
      ]);
    },
    [present],
  );

  const restoreSnapshot = useCallback(
    (snapshotId: string) => {
      const found = snapshots.find((s) => s.id === snapshotId);
      if (found) setState(structuredClone(found.state), true);
    },
    [snapshots, setState],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  return {
    state: present,
    setState,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    snapshots,
    saveSnapshot,
    restoreSnapshot,
  };
}

export function downloadForgeFile(project: unknown, filename = 'projet.forge.json') {
  const blob = new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), project }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

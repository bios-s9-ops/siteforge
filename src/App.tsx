import { useEffect, useRef, useState } from 'react';
import { EditorWorkspace } from './components/EditorWorkspace';
import { WelcomeScreen } from './components/WelcomeScreen';
import { WizardFlow } from './components/WizardFlow';
import type { SiteProject } from './types/site';
import {
  createStarterProject,
  createMultiPageTemplate,
  loadSavedProjects,
  saveAllProjects,
  upsertProjectInList,
} from './utils/demoSites';
import { ProposalsFlow } from './components/ProposalsFlow';
import { useHistoryShortcuts, useProjectHistory } from './hooks/useProjectHistory';
import { clearAllImages, createBlankProject, ForgeFileError, normalizeProjectPages, parseForgeFile } from './utils/projectIO';
import { AICopilotDrawer } from './components/AICopilotDrawer';
import { applySiteMutations } from './utils/aiMutations';

type AppScreen = 'welcome' | 'wizard' | 'ai' | 'editor';

export default function App() {
  const [savedProjects, setSavedProjects] = useState<SiteProject[]>(() => loadSavedProjects());
  const [screen, setScreen] = useState<AppScreen>(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('autostart') === '1') {
      return 'editor';
    }
    return 'welcome';
  });
  const [wizardMode, setWizardMode] = useState<'inspiration' | 'scratch'>('scratch');
  const [importError, setImportError] = useState('');
  const history = useProjectHistory(() => loadSavedProjects()[0] ?? createStarterProject('kora'));
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTargetProject, setAiTargetProject] = useState<SiteProject | null>(null);
  const [blankDraft] = useState(() => createBlankProject());
  const aiTargetChangeRef = useRef<((project: SiteProject) => void) | null>(null);
  const aiUndoStack = useRef<Array<{ project: SiteProject; onChange: ((project: SiteProject) => void) | null }>>([]);
  useHistoryShortcuts(screen === 'editor', history.undo, history.redo);

  // Réinitialise le défilement de la fenêtre lors des changements d'écran
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  // Sauvegarde automatique dans localStorage à chaque changement dans l'éditeur
  useEffect(() => {
    if (screen !== 'editor') return;
    setSavedProjects((prev) => {
      const next = upsertProjectInList(prev, history.present);
      saveAllProjects(next);
      return next;
    });
  }, [history.present, screen]);

  const openProjectInEditor = (project: SiteProject) => {
    setAiTargetProject(null);
    aiTargetChangeRef.current = null;
    aiUndoStack.current = [];
    history.reset(normalizeProjectPages(project));
    setScreen('editor');
  };

  const saveAndOpen = (project: SiteProject) => {
    const ready = normalizeProjectPages(project);
    const nextList = upsertProjectInList(savedProjects, ready);
    setSavedProjects(nextList);
    saveAllProjects(nextList);
    openProjectInEditor(ready);
  };

  const handleAiChange = (_prompt: string, mutations: Parameters<typeof applySiteMutations>[1]) => {
    const target = aiTargetProject ?? (screen === 'editor' ? history.present : blankDraft);
    aiUndoStack.current.push({ project: target, onChange: aiTargetChangeRef.current });
    const updated = applySiteMutations(target, mutations);
    if (aiTargetProject) {
      setAiTargetProject(updated);
      aiTargetChangeRef.current?.(updated);
    } else if (screen === 'editor') {
      history.push(updated);
    } else {
      const ready = normalizeProjectPages(updated);
      const nextList = upsertProjectInList(savedProjects, ready);
      setSavedProjects(nextList);
      saveAllProjects(nextList);
      history.reset(ready);
      setScreen('editor');
    }
  };

  const handleAiUndo = () => {
    const previous = aiUndoStack.current.pop();
    if (!previous) return;
    if (previous.onChange) {
      setAiTargetProject(previous.project);
      previous.onChange(previous.project);
    } else {
      history.push(previous.project);
    }
  };

  useEffect(() => {
    const open = (event: Event) => {
      const detail = (event as CustomEvent<{
        project?: SiteProject;
        onProjectChange?: (project: SiteProject) => void;
      }>).detail;
      aiUndoStack.current = [];
      if (detail?.project) {
        setAiTargetProject(detail.project);
        aiTargetChangeRef.current = detail.onProjectChange ?? null;
      } else {
        setAiTargetProject(null);
        aiTargetChangeRef.current = null;
      }
      setAiOpen(true);
    };
    window.addEventListener('siteforge:open-ai', open);
    return () => window.removeEventListener('siteforge:open-ai', open);
  }, []);

  const handleStartMode = (mode: 'inspiration' | 'scratch' | 'ai') => {
    setImportError('');
    if (mode === 'scratch') {
      // Canevas vierge : aucune section, aucune image, aucun texte imposé
      saveAndOpen(createBlankProject());
      setAiOpen(true);
      return;
    }
    if (mode === 'ai') {
      setScreen('ai');
      return;
    }
    setWizardMode('inspiration');
    setScreen('wizard');
  };

  const handleImportFile = async (file: File) => {
    try {
      saveAndOpen(parseForgeFile(await file.text()));
      setImportError('');
    } catch (err) {
      setImportError(err instanceof ForgeFileError ? err.message : 'Impossible de lire ce fichier.');
    }
  };

  const handleOpenStarter = (preset: 'kora' | 'seve' | 'apparel' | 'portfolio' | 'agency') => {
    const starter = preset === 'kora' || preset === 'seve'
      ? createStarterProject(preset)
      : createMultiPageTemplate(preset);
    const nextList = upsertProjectInList(savedProjects, starter);
    setSavedProjects(nextList);
    saveAllProjects(nextList);
    openProjectInEditor(starter);
  };

  const handleDuplicateProject = (projectId: string) => {
    const target = savedProjects.find((p) => p.id === projectId);
    if (!target) return;
    const now = new Date().toISOString();
    const clone: SiteProject = {
      ...JSON.parse(JSON.stringify(target)),
      id: `prj_${Math.random().toString(36).slice(2, 9)}`,
      name: `${target.name} (copie)`,
      createdAt: now,
      updatedAt: now,
    };
    const nextList = upsertProjectInList(savedProjects, clone);
    setSavedProjects(nextList);
    saveAllProjects(nextList);
  };

  const handleDeleteProject = (projectId: string) => {
    const nextList = savedProjects.filter((p) => p.id !== projectId);
    setSavedProjects(nextList);
    saveAllProjects(nextList);
  };

  let content;
  if (screen === 'wizard') {
    content = (
      <WizardFlow
        mode={wizardMode}
        onCancel={() => setScreen('welcome')}
        onComplete={(generatedProject) => {
          // Mode inspiration : jamais d'image reprise, tous les emplacements restent vides
          saveAndOpen(wizardMode === 'inspiration' ? clearAllImages(generatedProject) : generatedProject);
        }}
      />
    );
  } else if (screen === 'ai') {
    content = <ProposalsFlow onCancel={() => setScreen('welcome')} onChoose={saveAndOpen} />;
  } else if (screen === 'editor') {
    content = (
      <EditorWorkspace
        project={history.present}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={history.undo}
        onRedo={history.redo}
        onChangeProject={(next) => history.push(normalizeProjectPages(next))}
        onBackHome={() => setScreen('welcome')}
      />
    );
  } else {
    content = (
    <WelcomeScreen
      savedProjects={savedProjects}
      onStartMode={handleStartMode}
      onImportFile={handleImportFile}
      importError={importError}
      onOpenProject={openProjectInEditor}
      onOpenStarter={handleOpenStarter}
      onDuplicateProject={handleDuplicateProject}
      onDeleteProject={handleDeleteProject}
    />
  );
  }
  return (
    <>
      {content}
      <AICopilotDrawer
        isOpen={aiOpen}
        onOpenChange={(open) => {
          if (open) {
            aiUndoStack.current = [];
            setAiTargetProject(null);
            aiTargetChangeRef.current = null;
          }
          setAiOpen(open);
        }}
        project={aiTargetProject ?? (screen === 'editor' ? history.present : blankDraft)}
        onApply={handleAiChange}
        onUndo={handleAiUndo}
        canUndo={aiUndoStack.current.length > 0}
      />
    </>
  );
}

import { useEffect, useState } from 'react';
import { EditorWorkspace } from './components/EditorWorkspace';
import { WelcomeScreen } from './components/WelcomeScreen';
import { WizardFlow } from './components/WizardFlow';
import type { SiteProject } from './types/site';
import {
  createStarterProject,
  loadSavedProjects,
  saveAllProjects,
  upsertProjectInList,
} from './utils/demoSites';
import {
  canRedo,
  canUndo,
  createHistory,
  type HistoryState,
  pushHistory,
  redoHistory,
  undoHistory,
} from './utils/history';

type AppScreen = 'welcome' | 'wizard' | 'editor';

export default function App() {
  const [savedProjects, setSavedProjects] = useState<SiteProject[]>(() => loadSavedProjects());
  const [screen, setScreen] = useState<AppScreen>(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('autostart') === '1') {
      return 'editor';
    }
    return 'welcome';
  });
  const [wizardMode, setWizardMode] = useState<'inspiration' | 'scratch'>('scratch');
  const [history, setHistory] = useState<HistoryState<SiteProject>>(() => {
    const initialList = loadSavedProjects();
    const initialProject = initialList[0] ?? createStarterProject('kora');
    return createHistory(initialProject);
  });

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
    setHistory(createHistory(project));
    setScreen('editor');
  };

  const handleOpenStarter = (preset: 'kora' | 'seve') => {
    const starter = createStarterProject(preset);
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

  if (screen === 'wizard') {
    return (
      <WizardFlow
        mode={wizardMode}
        onCancel={() => setScreen('welcome')}
        onComplete={(generatedProject) => {
          const nextList = upsertProjectInList(savedProjects, generatedProject);
          setSavedProjects(nextList);
          saveAllProjects(nextList);
          openProjectInEditor(generatedProject);
        }}
      />
    );
  }

  if (screen === 'editor') {
    return (
      <EditorWorkspace
        project={history.present}
        canUndo={canUndo(history)}
        canRedo={canRedo(history)}
        onUndo={() => setHistory((h) => undoHistory(h))}
        onRedo={() => setHistory((h) => redoHistory(h))}
        onChangeProject={(nextProject) => setHistory((h) => pushHistory(h, nextProject))}
        onBackHome={() => setScreen('welcome')}
      />
    );
  }

  return (
    <WelcomeScreen
      savedProjects={savedProjects}
      onStartMode={(mode) => {
        setWizardMode(mode);
        setScreen('wizard');
      }}
      onOpenProject={openProjectInEditor}
      onOpenStarter={handleOpenStarter}
      onDuplicateProject={handleDuplicateProject}
      onDeleteProject={handleDeleteProject}
    />
  );
}

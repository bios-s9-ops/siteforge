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
import { ProposalsFlow } from './components/ProposalsFlow';
import { useHistoryShortcuts, useProjectHistory } from './hooks/useProjectHistory';
import { clearAllImages, createBlankProject, ForgeFileError, parseForgeFile } from './utils/projectIO';

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
    history.reset(project);
    setScreen('editor');
  };

  const saveAndOpen = (project: SiteProject) => {
    const nextList = upsertProjectInList(savedProjects, project);
    setSavedProjects(nextList);
    saveAllProjects(nextList);
    openProjectInEditor(project);
  };

  const handleStartMode = (mode: 'inspiration' | 'scratch' | 'ai') => {
    setImportError('');
    if (mode === 'scratch') {
      // Canevas vierge : aucune section, aucune image, aucun texte imposé
      saveAndOpen(createBlankProject());
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
          // Mode inspiration : jamais d'image reprise, tous les emplacements restent vides
          saveAndOpen(wizardMode === 'inspiration' ? clearAllImages(generatedProject) : generatedProject);
        }}
      />
    );
  }

  if (screen === 'ai') {
    return <ProposalsFlow onCancel={() => setScreen('welcome')} onChoose={saveAndOpen} />;
  }

  if (screen === 'editor') {
    return (
      <EditorWorkspace
        project={history.present}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={history.undo}
        onRedo={history.redo}
        onChangeProject={history.push}
        onBackHome={() => setScreen('welcome')}
      />
    );
  }

  return (
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

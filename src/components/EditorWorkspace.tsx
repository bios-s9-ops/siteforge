import { Fragment, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  GripVertical,
  Info,
  Laptop,
  Layers,
  LayoutTemplate,
  MousePointerClick,
  Pencil,
  Plus,
  Redo2,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import type { BlockType, SiteBlock, SiteProject, ViewportMode } from '../types/site';
import { getBlockDefinition } from '../utils/blockCatalog';
import {
  duplicateBlockInList,
  insertBlockInList,
  moveBlockInList,
} from '../utils/demoSites';
import {
  applyDrop,
  decodePayload,
  DND_MIME,
  encodePayload,
  insertBlockAtSlot,
  isNoopSlot,
  slotFromPointer,
  visualSlotFor,
  type DragPayload,
} from '../utils/blockOps';
import { collectIncompleteFields, DEMO_FICTION_BANNER_TEXT } from '../utils/honesty';
import { BlockLibraryModal } from './BlockLibraryModal';
import { BlockPalette } from './BlockPalette';
import { DropZone } from './DropZone';
import { CanvasStage, type StageItem } from './CanvasStage';
import { deriveAlternatePalette } from '../utils/colorHarmony';
import { sanitizeLayoutMode } from '../utils/effectsCatalog';
import { BlockRenderer, type InlineTextTarget } from './BlockRenderer';
import { ExportModal } from './ExportModal';
import { LivePreviewModal } from './LivePreviewModal';
import { NewPageModal } from './NewPageModal';
import { downloadForgeFile } from '../utils/projectIO';
import { type FocusFieldTarget, InspectorPanel, type InspectorTab } from './InspectorPanel';

interface EditorWorkspaceProps {
  project: SiteProject;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onChangeProject: (next: SiteProject) => void;
  onBackHome: () => void;
}

export function EditorWorkspace({
  project,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onChangeProject,
  onBackHome,
}: EditorWorkspaceProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    project.blocks[1]?.id ?? project.blocks[0]?.id ?? null,
  );
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('block');
  const [focusTarget, setFocusTarget] = useState<FocusFieldTarget | null>(null);
  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [altTheme, setAltTheme] = useState(false);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const [originalityModalOpen, setOriginalityModalOpen] = useState(false);
  const [leftTab, setLeftTab] = useState<'blocks' | 'structure'>('blocks');
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const [insertSlot, setInsertSlot] = useState<number | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'blocks' | 'preview' | 'inspector'>('preview');

  const selectedBlock = project.blocks.find((b) => b.id === selectedBlockId) ?? null;
  const incompleteFields = useMemo(() => collectIncompleteFields(project), [project]);

  const updateBlocks = (nextBlocks: SiteBlock[]) => {
    onChangeProject({ ...project, blocks: nextBlocks });
  };

  const handleMove = (blockId: string, direction: 'up' | 'down') => {
    updateBlocks(moveBlockInList(project.blocks, blockId, direction));
  };

  const handleDuplicate = (blockId: string) => {
    const { blocks, newBlockId } = duplicateBlockInList(project.blocks, blockId);
    updateBlocks(blocks);
    if (newBlockId) setSelectedBlockId(newBlockId);
  };

  const handleToggleVisible = (blockId: string) => {
    updateBlocks(
      project.blocks.map((b) => (b.id === blockId ? { ...b, visible: !b.visible } : b)),
    );
  };

  const handleDelete = (blockId: string) => {
    const next = project.blocks.filter((b) => b.id !== blockId);
    updateBlocks(next);
    if (selectedBlockId === blockId) {
      setSelectedBlockId(next[0]?.id ?? null);
    }
  };

  const handleAddBlock = (type: BlockType) => {
    const { blocks, newBlock } =
      insertSlot !== null
        ? insertBlockAtSlot(project.blocks, type, insertSlot, project.name)
        : insertBlockInList(project.blocks, type, selectedBlockId, project.name);
    setInsertSlot(null);
    updateBlocks(blocks);
    setSelectedBlockId(newBlock.id);
    setInspectorTab('block');
    setMobilePanel('preview');
  };

  // --- Glisser-déposer façon Odoo : palette → page, et déplacement des blocs existants ---
  const startDrag = (payload: DragPayload) => {
    setDragPayload(payload);
    setHoverSlot(null);
  };

  const endDrag = () => {
    setDragPayload(null);
    setHoverSlot(null);
  };

  const handleDropAt = (slot: number, raw?: string) => {
    const payload = decodePayload(raw) ?? dragPayload;
    endDrag();
    if (!payload) return;
    const result = applyDrop(project.blocks, payload, slot, project.name);
    if (!result.changed) return;
    updateBlocks(result.blocks);
    setSelectedBlockId(result.selectedId);
    if (payload.kind === 'new') {
      setInspectorTab('block');
    }
  };

  const handleBlockDragStart = (e: React.DragEvent<HTMLElement>, block: SiteBlock) => {
    e.dataTransfer.setData(DND_MIME, encodePayload({ kind: 'move', id: block.id }));
    e.dataTransfer.effectAllowed = 'move';
    // Petite étiquette comme image de glissement, plutôt que toute la section
    const ghost = document.createElement('div');
    ghost.textContent = getBlockDefinition(block.type).label;
    ghost.style.cssText =
      'position:fixed;top:-100px;left:-100px;padding:6px 12px;background:#1C1917;color:#FBF8F3;font:600 12px sans-serif;border-radius:2px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 12, 12);
    setTimeout(() => ghost.remove(), 0);
    setTimeout(() => startDrag({ kind: 'move', id: block.id }), 0);
  };

  /** Défilement automatique de la page quand on glisse près du haut ou du bas */
  const handleCanvasDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!dragPayload) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const edge = 72;
    if (e.clientY < rect.top + edge) el.scrollTop -= 16;
    else if (e.clientY > rect.bottom - edge) el.scrollTop += 16;
  };

  /** Version claire / sombre alternative vue par le visiteur (bouton de bascule) */
  const displayTheme = useMemo(() => {
    if (!altTheme || !project.theme.visitorThemeToggle) return project.theme;
    const toDark = project.theme.mode !== 'dark';
    return { ...project.theme, mode: toDark ? ('dark' as const) : ('light' as const), palette: deriveAlternatePalette(project.theme.palette, toDark) };
  }, [altTheme, project.theme]);

  const fxKey = useMemo(
    () =>
      JSON.stringify([
        sanitizeLayoutMode(project.theme.layoutMode),
        project.blocks.map((b) => [
          b.id,
          b.animation,
          b.animationDurationMs,
          b.content.imageEffect,
          Boolean(b.content.image),
          Boolean(b.content.secondaryImage),
          b.content.items?.map((i) => [i.imageEffect, Boolean(i.image)]),
        ]),
      ]),
    [project.blocks, project.theme.layoutMode],
  );

  const handleCommitText = (blockId: string, target: InlineTextTarget, value: string) => {
    const blocks = project.blocks.map((b) => {
      if (b.id !== blockId) return b;
      if (target.itemId) {
        return {
          ...b,
          content: {
            ...b.content,
            items: b.content.items?.map((it) => (it.id === target.itemId ? { ...it, [target.field]: value } : it)),
          },
        };
      }
      return { ...b, content: { ...b.content, [target.field]: value } };
    });
    updateBlocks(blocks);
  };

  const activeSlot = dragPayload && hoverSlot !== null ? visualSlotFor(project.blocks, dragPayload, hoverSlot) : null;

  const handleUpdateBlock = (updated: SiteBlock) => {
    updateBlocks(project.blocks.map((b) => (b.id === updated.id ? updated : b)));
  };

  const handleJumpToField = (blockId: string, fieldKey: string, itemId?: string) => {
    setSelectedBlockId(blockId);
    setInspectorTab('block');
    setMobilePanel('inspector');
    setFocusTarget({
      blockId,
      itemId,
      fieldKey,
      nonce: Date.now(),
    });
  };

  const previewWidthClass =
    viewport === 'mobile'
      ? 'w-[390px]'
      : viewport === 'tablet'
        ? 'w-[768px]'
        : 'w-full max-w-[1220px]';

  return (
    <div className="fixed inset-0 h-dvh flex flex-col bg-[#F4EFE6] text-[#1C1917] overflow-hidden">
      {/* Top Editor Bar */}
      <header className="h-14 shrink-0 bg-[#FFFFFF] border-b border-[#E5DEC9] px-3 md:px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBackHome}
            aria-label="Retour à l’accueil"
            className="p-2 rounded-sm text-[#57534E] hover:bg-[#F4EFE6] hover:text-[#1C1917] shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <div className="hidden sm:flex items-center gap-1.5 text-[#57534E] shrink-0">
            <Layers className="w-4 h-4 text-[#9A3412]" aria-hidden="true" />
            <span className="font-display font-semibold text-base text-[#1C1917]">SiteForge</span>
            <span>/</span>
          </div>
          <input
            type="text"
            value={project.name}
            aria-label="Nom du projet"
            onChange={(e) => onChangeProject({ ...project, name: e.target.value })}
            className="font-display font-semibold text-sm text-[#1C1917] bg-transparent border border-transparent hover:border-[#E5DEC9] focus:border-[#9A3412] focus:bg-[#FFFFFF] rounded-sm px-2 py-1 min-w-0 w-36 sm:w-52 truncate focus:outline-none"
          />
          {project.isDemo && (
            <span className="hidden xl:inline-block px-2 py-0.5 text-[11px] font-semibold bg-[#FEF3C7] text-[#78350F] border border-[#D97706]/50 shrink-0">
              Exemple fictif
            </span>
          )}
        </div>

        {/* Center Viewport Switcher */}
        <div className="hidden md:flex items-center gap-1 p-1 bg-[#F4EFE6] border border-[#E5DEC9] rounded-sm">
          <button
            type="button"
            onClick={() => setViewport('desktop')}
            aria-label="Aperçu Ordinateur"
            className={`px-2.5 py-1 rounded-sm text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
              viewport === 'desktop'
                ? 'bg-[#FFFFFF] text-[#1C1917] border border-[#E5DEC9]'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Ordinateur</span>
          </button>
          <button
            type="button"
            onClick={() => setViewport('tablet')}
            aria-label="Aperçu Tablette"
            className={`px-2.5 py-1 rounded-sm text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
              viewport === 'tablet'
                ? 'bg-[#FFFFFF] text-[#1C1917] border border-[#E5DEC9]'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Tablette</span>
          </button>
          <button
            type="button"
            onClick={() => setViewport('mobile')}
            aria-label="Aperçu Mobile"
            className={`px-2.5 py-1 rounded-sm text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
              viewport === 'mobile'
                ? 'bg-[#FFFFFF] text-[#1C1917] border border-[#E5DEC9]'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Mobile</span>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Annuler"
            title="Annuler"
            className="p-2 rounded-sm border border-[#E5DEC9] hover:bg-[#F4EFE6] disabled:opacity-40 text-[#1C1917] cursor-pointer"
          >
            <Undo2 className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Rétablir"
            title="Rétablir"
            className="p-2 rounded-sm border border-[#E5DEC9] hover:bg-[#F4EFE6] disabled:opacity-40 text-[#1C1917] cursor-pointer"
          >
            <Redo2 className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              setInspectorTab('todo');
              setMobilePanel('inspector');
            }}
            aria-label="Voir les champs à compléter"
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-2 rounded-sm border text-xs font-semibold cursor-pointer ${
              incompleteFields.length > 0
                ? 'border-[#D97706] bg-[#FEF3C7] text-[#78350F] hover:bg-[#FDE68A]'
                : 'border-[#E5DEC9] bg-[#FBF8F3] text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="font-mono-tabular">À compléter ({incompleteFields.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setOriginalityModalOpen(true)}
            aria-label="Contrôle d’originalité"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-2 rounded-sm border border-[#E5DEC9] bg-[#F4EFE6] hover:bg-[#E5DEC9]/60 text-[#1C1917] text-xs font-semibold cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#B45309]" aria-hidden="true" />
            <span>Originalité</span>
          </button>
          <button
            type="button"
            onClick={() => setNewPageOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-sm border border-[#E5DEC9] bg-[#FFFFFF] hover:bg-[#F4EFE6] text-[#1C1917] text-xs font-semibold whitespace-nowrap cursor-pointer"
          >
            <LayoutTemplate className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Nouvelle page</span>
          </button>
          <button
            type="button"
            onClick={() => downloadForgeFile(project)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-sm border border-[#E5DEC9] bg-[#FFFFFF] hover:bg-[#F4EFE6] text-[#1C1917] text-xs font-semibold whitespace-nowrap cursor-pointer"
            title="Enregistrer le projet pour le rouvrir plus tard ou le partager"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>.forge.json</span>
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode((v) => !v)}
            aria-pressed={previewMode}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-sm border text-xs font-semibold whitespace-nowrap cursor-pointer ${
              previewMode ? 'border-[#9A3412] bg-[#9A3412] text-white' : 'border-[#E5DEC9] bg-[#FFFFFF] hover:bg-[#F4EFE6] text-[#1C1917]'
            }`}
            title={previewMode ? 'Revenir à la modification' : 'Voir la page sans les outils d’édition'}
          >
            {previewMode ? <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> : <Eye className="w-3.5 h-3.5" aria-hidden="true" />}
            <span>{previewMode ? 'Modifier' : 'Aperçu'}</span>
          </button>
          <button
            type="button"
            onClick={() => setLiveOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-sm border border-[#E5DEC9] bg-[#FFFFFF] hover:bg-[#F4EFE6] text-[#1C1917] text-xs font-semibold whitespace-nowrap cursor-pointer"
          >
            <MousePointerClick className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Tester le site</span>
          </button>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="px-3.5 py-2 rounded-sm bg-[#9A3412] hover:bg-[#7C2D12] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Exporter</span>
          </button>
        </div>
      </header>

      {/* Mobile/Tablet Editor Sub-navigation */}
      <div className="lg:hidden bg-[#FFFFFF] border-b border-[#E5DEC9] px-3 py-1.5 grid grid-cols-3 gap-1">
        <button
          type="button"
          onClick={() => setMobilePanel('blocks')}
          className={`py-1.5 rounded-sm text-xs font-semibold cursor-pointer ${
            mobilePanel === 'blocks' ? 'bg-[#1C1917] text-white' : 'text-[#57534E]'
          }`}
        >
          Blocs ({project.blocks.length})
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel('preview')}
          className={`py-1.5 rounded-sm text-xs font-semibold cursor-pointer ${
            mobilePanel === 'preview' ? 'bg-[#1C1917] text-white' : 'text-[#57534E]'
          }`}
        >
          Aperçu
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel('inspector')}
          className={`py-1.5 rounded-sm text-xs font-semibold cursor-pointer ${
            mobilePanel === 'inspector' ? 'bg-[#1C1917] text-white' : 'text-[#57534E]'
          }`}
        >
          Inspecteur {incompleteFields.length > 0 ? `(${incompleteFields.length})` : ''}
        </button>
      </div>

      {/* 3-Zone Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Zone: Block List & Add Block */}
        <aside
          aria-label="Liste des blocs"
          className={`${
            mobilePanel === 'blocks' ? 'flex w-full' : 'hidden'
          } lg:flex lg:w-[270px] shrink-0 bg-[#FFFFFF] border-r border-[#E5DEC9] flex-col h-full overflow-hidden`}
        >
          <div className="p-2 border-b border-[#E5DEC9] bg-[#FBF8F3]">
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#F4EFE6] rounded-sm" role="tablist" aria-label="Panneau de gauche">
              {(
                [
                  { id: 'blocks', label: 'Blocs' },
                  { id: 'structure', label: `Structure (${project.blocks.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={leftTab === tab.id}
                  onClick={() => setLeftTab(tab.id)}
                  className={`py-1.5 rounded-sm text-xs font-semibold cursor-pointer ${
                    leftTab === tab.id
                      ? 'bg-[#FFFFFF] text-[#1C1917] border border-[#E5DEC9]'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {leftTab === 'blocks' && (
            <BlockPalette
              onInsert={(type) => {
                setInsertSlot(null);
                handleAddBlock(type);
              }}
              onDragStartBlock={(type) => startDrag({ kind: 'new', type })}
              onDragEndBlock={endDrag}
            />
          )}

          <div
            className={`${leftTab === 'structure' ? '' : 'hidden'} flex-1 overflow-y-auto editor-scroll p-2.5 space-y-1.5 bg-[#FBF8F3]/40`}
          >
            {project.blocks.map((block, index) => {
              const def = getBlockDefinition(block.type);
              const isSelected = block.id === selectedBlockId;
              return (
                <div
                  key={block.id}
                  draggable
                  onDragStart={(e) => handleBlockDragStart(e, block)}
                  onDragEnd={endDrag}
                  onDragOver={(e) => {
                    if (!dragPayload) return;
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoverSlot(slotFromPointer(index, e.clientY, rect.top, rect.height));
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    handleDropAt(slotFromPointer(index, e.clientY, rect.top, rect.height), e.dataTransfer.getData(DND_MIME));
                  }}
                  className={`relative rounded-sm border p-2.5 transition-colors ${
                    activeSlot === index ? 'border-t-[3px] border-t-[#9A3412] ' : ''
                  }${
                    activeSlot === project.blocks.length && index === project.blocks.length - 1
                      ? 'border-b-[3px] border-b-[#9A3412] '
                      : ''
                  }${dragPayload?.kind === 'move' && dragPayload.id === block.id ? 'opacity-40 ' : ''}${
                    isSelected
                      ? 'border-[#9A3412] bg-[#F4EFE6]'
                      : 'border-[#E5DEC9] bg-[#FFFFFF] hover:border-[#1C1917]/40'
                  } ${!block.visible ? 'opacity-55' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[#57534E] cursor-grab shrink-0" aria-hidden="true">
                      <GripVertical className="w-3.5 h-3.5" />
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBlockId(block.id);
                        setInspectorTab('block');
                        setMobilePanel('inspector');
                      }}
                      className="flex-1 text-left min-w-0 cursor-pointer"
                    >
                      <div className="text-xs font-semibold text-[#1C1917] truncate">{def.label}</div>
                      <div className="text-[11px] text-[#57534E] truncate">
                        {block.content.heading || block.content.brandName || block.variant}
                      </div>
                    </button>
                  </div>

                  <div className="flex items-center justify-end gap-1 mt-2 pt-1.5 border-t border-[#E5DEC9]/70">
                    <button
                      type="button"
                      onClick={() => handleMove(block.id, 'up')}
                      disabled={index === 0}
                      aria-label={`Monter ${def.label}`}
                      className="p-1 rounded-sm hover:bg-[#F4EFE6] disabled:opacity-30 text-[#57534E] cursor-pointer"
                    >
                      <ArrowUp className="w-3 h-3" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(block.id, 'down')}
                      disabled={index === project.blocks.length - 1}
                      aria-label={`Descendre ${def.label}`}
                      className="p-1 rounded-sm hover:bg-[#F4EFE6] disabled:opacity-30 text-[#57534E] cursor-pointer"
                    >
                      <ArrowDown className="w-3 h-3" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(block.id)}
                      aria-label={`Dupliquer ${def.label}`}
                      className="p-1 rounded-sm hover:bg-[#F4EFE6] text-[#57534E] cursor-pointer"
                    >
                      <Copy className="w-3 h-3" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleVisible(block.id)}
                      aria-label={block.visible ? `Masquer ${def.label}` : `Afficher ${def.label}`}
                      className="p-1 rounded-sm hover:bg-[#F4EFE6] text-[#57534E] cursor-pointer"
                    >
                      {block.visible ? (
                        <Eye className="w-3 h-3" aria-hidden="true" />
                      ) : (
                        <EyeOff className="w-3 h-3 text-[#B45309]" aria-hidden="true" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(block.id)}
                      aria-label={`Supprimer ${def.label}`}
                      className="p-1 rounded-sm hover:bg-red-50 hover:text-red-700 text-[#57534E] cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-[#E5DEC9] bg-[#FFFFFF]">
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="w-full py-2.5 px-3 rounded-sm bg-[#1C1917] hover:bg-[#292524] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Ajouter un bloc</span>
            </button>
          </div>
        </aside>

        {/* Center Zone: Live Preview Canvas */}
        <main
          className={`${
            mobilePanel === 'preview' ? 'flex' : 'hidden'
          } lg:flex flex-1 min-w-0 flex-col overflow-hidden bg-[#EBE4D6]`}
        >
          {/* Anti-plagiarism & Originality Notice Strip */}
          <div className="px-4 py-2 bg-[#F4EFE6] border-b border-[#E5DEC9] flex items-center justify-between gap-3 text-xs text-[#1C1917]">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 text-[#B45309] shrink-0" aria-hidden="true" />
              <span className="truncate">
                Le modèle sert d’inspiration structurelle uniquement. Ne reproduis pas le logo, les images, les textes ou
                l’identité d’une autre marque.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOriginalityModalOpen(true)}
              className="text-xs font-semibold text-[#9A3412] underline shrink-0 cursor-pointer"
            >
              Voir le contrôle
            </button>
          </div>

          {/* Scrollable Preview Frame */}
          <div
            ref={setScrollEl}
            className="flex-1 overflow-auto p-4 md:p-6 flex justify-center items-start editor-scroll"
            onDragOver={handleCanvasDragOver}
            onDragEnd={endDrag}
          >
            <div
              data-testid="preview-frame"
              className={`${previewWidthClass} bg-[#FFFFFF] rounded-sm border border-[#D6CEBA] overflow-hidden transition-all duration-200`}
            >
              {/* Permanent Demo Fiction Banner */}
              {project.isDemo && (
                <aside
                  role="note"
                  data-testid="demo-fiction-banner"
                  className="bg-[#FEF3C7] border-b border-[#D97706] px-4 py-2 text-xs font-semibold text-[#78350F] flex items-center justify-center gap-2 text-center"
                >
                  <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{DEMO_FICTION_BANNER_TEXT}</span>
                </aside>
              )}

              {project.blocks.length === 0 ? (
                <div className="p-16 text-center space-y-3">
                  <p className="text-sm text-[#57534E]">Votre page ne contient aucun bloc pour le moment.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setInsertSlot(null);
                      setLibraryOpen(true);
                    }}
                    className="px-4 py-2 rounded-sm bg-[#9A3412] text-white text-xs font-semibold cursor-pointer"
                  >
                    Ajouter un premier bloc
                  </button>
                </div>
              ) : (
                <CanvasStage
                  theme={displayTheme}
                  fxKey={fxKey}
                  scroller={scrollEl}
                  previewMode={previewMode}
                  altTheme={altTheme}
                  onToggleTheme={() => setAltTheme((v) => !v)}
                  splitImage={project.blocks.map((b) => b.content.image || b.content.items?.find((it) => it.image)?.image).find(Boolean)}
                  items={project.blocks.map((block, index): StageItem => {
                    const slotHidden = dragPayload?.kind === 'move' && isNoopSlot(project.blocks, dragPayload.id, index);
                    const isDragged = dragPayload?.kind === 'move' && dragPayload.id === block.id;
                    return {
                      block,
                      node: (
                        <Fragment>
                          {!previewMode && (
                            <DropZone
                              slot={index}
                              isFirst={index === 0}
                              dragging={dragPayload !== null}
                              hovered={activeSlot === index}
                              hidden={slotHidden}
                              onHover={setHoverSlot}
                              onDropHere={handleDropAt}
                              onInsertClick={(slot) => {
                                setInsertSlot(slot);
                                setLibraryOpen(true);
                              }}
                            />
                          )}
                          <div
                            className={isDragged ? 'opacity-40' : ''}
                            onDragOver={(e) => {
                              if (!dragPayload) return;
                              e.preventDefault();
                              e.dataTransfer.dropEffect = dragPayload.kind === 'new' ? 'copy' : 'move';
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoverSlot(slotFromPointer(index, e.clientY, rect.top, rect.height));
                            }}
                            onDrop={(e) => {
                              if (!dragPayload) return;
                              e.preventDefault();
                              const rect = e.currentTarget.getBoundingClientRect();
                              handleDropAt(slotFromPointer(index, e.clientY, rect.top, rect.height), e.dataTransfer.getData(DND_MIME));
                            }}
                          >
                            <BlockRenderer
                              block={block}
                              blockIndex={index}
                              theme={displayTheme}
                              viewport={viewport}
                              isSelected={block.id === selectedBlockId}
                              isFirst={index === 0}
                              isLast={index === project.blocks.length - 1}
                              previewMode={previewMode}
                              layoutMode={project.theme.layoutMode}
                              onSelect={() => {
                                setSelectedBlockId(block.id);
                                if (inspectorTab === 'todo') setInspectorTab('block');
                              }}
                              onMove={(dir) => handleMove(block.id, dir)}
                              onDuplicate={() => handleDuplicate(block.id)}
                              onDelete={() => handleDelete(block.id)}
                              onDragStartBlock={(e) => handleBlockDragStart(e, block)}
                              onDragEndBlock={endDrag}
                              onCommitText={(target, value) => handleCommitText(block.id, target, value)}
                            />
                          </div>
                        </Fragment>
                      ),
                    };
                  })}
                  tail={
                    previewMode ? null : (
                      <DropZone
                        slot={project.blocks.length}
                        dragging={dragPayload !== null}
                        hovered={activeSlot === project.blocks.length}
                        hidden={dragPayload?.kind === 'move' && isNoopSlot(project.blocks, dragPayload.id, project.blocks.length)}
                        onHover={setHoverSlot}
                        onDropHere={handleDropAt}
                        onInsertClick={(slot) => {
                          setInsertSlot(slot);
                          setLibraryOpen(true);
                        }}
                      />
                    )
                  }
                />
              )}
            </div>
          </div>
        </main>

        {/* Right Zone: Properties Inspector */}
        <div
          className={`${
            mobilePanel === 'inspector' ? 'flex w-full' : 'hidden'
          } lg:flex lg:w-[360px] shrink-0 h-full overflow-hidden`}
        >
          <InspectorPanel
            project={project}
            selectedBlock={selectedBlock}
            activeTab={inspectorTab}
            onChangeTab={setInspectorTab}
            focusTarget={focusTarget}
            onJumpToField={handleJumpToField}
            onUpdateBlock={handleUpdateBlock}
            onUpdateProject={onChangeProject}
            onSelectBlock={(blockId) => {
              setSelectedBlockId(blockId);
              setInspectorTab('block');
              setMobilePanel('inspector');
            }}
          />
        </div>
      </div>

      {/* Modals */}
      <BlockLibraryModal
        isOpen={libraryOpen}
        onClose={() => {
          setLibraryOpen(false);
          setInsertSlot(null);
        }}
        onSelectBlock={handleAddBlock}
      />

      <NewPageModal
        isOpen={newPageOpen}
        project={project}
        onClose={() => setNewPageOpen(false)}
        onApply={(blocks, theme) => {
          onChangeProject({ ...project, blocks, ...(theme ? { theme } : {}), updatedAt: new Date().toISOString() });
          setSelectedBlockId(blocks[0]?.id ?? null);
        }}
      />

      <LivePreviewModal isOpen={liveOpen} project={project} onClose={() => setLiveOpen(false)} />

      <ExportModal
        isOpen={exportOpen}
        project={project}
        onClose={() => setExportOpen(false)}
        onOpenPublishSettings={() => {
          setExportOpen(false);
          setInspectorTab('publish');
          setMobilePanel('inspector');
        }}
        onSelectBlock={(blockId) => {
          setExportOpen(false);
          setSelectedBlockId(blockId);
          setInspectorTab('block');
          setMobilePanel('inspector');
        }}
      />

      {originalityModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#1C1917]/55 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="originality-modal-title"
        >
          <div className="bg-[#FFFFFF] border border-[#E5DEC9] rounded-sm w-full max-w-lg p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#B45309]" aria-hidden="true" />
                <h2 id="originality-modal-title" className="font-display text-xl font-semibold text-[#1C1917]">
                  Contrôle d’originalité et rapport anti-plagiat
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOriginalityModalOpen(false)}
                aria-label="Fermer le rapport d’originalité"
                className="p-1.5 rounded-sm text-[#57534E] hover:bg-[#F4EFE6] cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="bg-[#F4EFE6] border border-[#E5DEC9] border-l-4 border-l-[#B45309] p-3.5 text-xs text-[#1C1917] leading-relaxed">
              Le modèle sert d’inspiration structurelle uniquement. Ne reproduis pas le logo, les images, les textes ou
              l’identité d’une autre marque.
            </div>

            <div className="space-y-2 text-sm text-[#1C1917]">
              <div className="font-semibold">
                Statut (étape 3) :{' '}
                {project.originalityReport?.status === 'corrected'
                  ? 'Éléments ajustés automatiquement pour garantir l’originalité'
                  : 'Contenu original et honnête validé'}
              </div>
              <p className="text-xs text-[#57534E] leading-relaxed">
                {project.originalityReport?.summary ||
                  'Les textes, la palette et les polices ont été générés indépendamment pour votre projet.'}
              </p>
              {project.originalityReport?.adjustments && project.originalityReport.adjustments.length > 0 && (
                <ul className="text-xs text-[#57534E] list-disc pl-5 space-y-1 pt-1">
                  {project.originalityReport.adjustments.map((adj, i) => (
                    <li key={i}>{adj}</li>
                  ))}
                </ul>
              )}
            </div>

            {project.structureAnalysis && (
              <div className="border-t border-[#E5DEC9] pt-3 space-y-1.5">
                <div className="text-xs font-semibold text-[#1C1917]">Architecture structurelle extraite :</div>
                <p className="text-xs text-[#57534E]">
                  {project.structureAnalysis.pageGoal} · {project.structureAnalysis.layoutRhythm}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setOriginalityModalOpen(false)}
                className="px-4 py-2 rounded-sm bg-[#1C1917] text-white text-xs font-semibold cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

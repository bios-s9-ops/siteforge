import { Plus } from 'lucide-react';
import { DND_MIME } from '../utils/blockOps';

interface DropZoneProps {
  slot: number;
  /** Un bloc est en cours de glissement : la zone devient une bande de dépôt visible */
  dragging: boolean;
  /** Le curseur (ou l'emplacement résolu) est sur cette zone */
  hovered: boolean;
  /** Pas de zone pour ce glissement (déposer ici ne changerait rien) */
  hidden?: boolean;
  isFirst?: boolean;
  onHover: (slot: number) => void;
  onDropHere: (slot: number, raw: string) => void;
  onInsertClick: (slot: number) => void;
}

/**
 * Emplacement entre deux sections. Au repos : un petit bouton « + » apparaît au survol.
 * Pendant un glissement : une bande pointillée apparaît et s'illumine sous le curseur, comme dans l'éditeur Odoo.
 */
export function DropZone({ slot, dragging, hovered, hidden, isFirst, onHover, onDropHere, onInsertClick }: DropZoneProps) {
  if (dragging) {
    if (hidden) return null;
    return (
      <div
        data-drop-slot={slot}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = e.dataTransfer.effectAllowed === 'copy' ? 'copy' : 'move';
          onHover(slot);
        }}
        onDrop={(e) => {
          e.preventDefault();
          onDropHere(slot, e.dataTransfer.getData(DND_MIME));
        }}
        className={`flex items-center justify-center text-xs font-semibold transition-all duration-100 border-y-2 ${
          hovered
            ? 'h-14 bg-[#9A3412] border-[#9A3412] text-white'
            : 'h-9 bg-[#9A3412]/5 border-dashed border-[#9A3412]/50 text-[#9A3412]'
        }`}
        role="presentation"
      >
        {hovered ? 'Déposer ici' : '·  ·  ·'}
      </div>
    );
  }

  return (
    <div className="relative h-0 z-10">
      <div
        className={`absolute inset-x-0 ${isFirst ? 'top-0' : '-top-3'} h-6 flex items-center justify-center opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity`}
      >
        <span className="absolute inset-x-0 h-px bg-[#9A3412]/70" aria-hidden="true" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInsertClick(slot);
          }}
          aria-label="Ajouter un bloc ici"
          className="relative w-6 h-6 rounded-full bg-[#9A3412] hover:bg-[#7C2D12] text-white flex items-center justify-center cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

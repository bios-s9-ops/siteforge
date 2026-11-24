import { useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Building2,
  CreditCard,
  HelpCircle,
  Image as ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  Mail,
  Megaphone,
  PanelBottom,
  PanelTop,
  Quote,
  Search,
  ShoppingBag,
  Users,
} from 'lucide-react';
import type { BlockType } from '../types/site';
import { BLOCK_CATALOG } from '../utils/blockCatalog';
import { DND_MIME, encodePayload } from '../utils/blockOps';
import { FACTUAL_EXCLUDABLE_BLOCKS } from '../utils/honesty';

const ICONS: Record<BlockType, typeof Mail> = {
  navbar: PanelTop,
  hero: LayoutTemplate,
  about: BookOpen,
  services: LayoutGrid,
  gallery: ImageIcon,
  products: ShoppingBag,
  pricing: CreditCard,
  testimonials: Quote,
  faq: HelpCircle,
  stats: BarChart3,
  team: Users,
  logos: Building2,
  cta: Megaphone,
  contact: Mail,
  footer: PanelBottom,
};

const CATEGORY_ORDER = ['Navigation', 'Contenu', 'Preuve sociale', 'Conversion'] as const;

interface BlockPaletteProps {
  /** Clic sur une tuile : insère le bloc (après la sélection) pour les écrans sans glisser-déposer */
  onInsert: (type: BlockType) => void;
  onDragStartBlock: (type: BlockType) => void;
  onDragEndBlock: () => void;
}

/**
 * Palette de blocs : on fait glisser une tuile sur la page, une zone de dépôt s'illumine entre deux sections.
 * Un clic fonctionne aussi (écrans tactiles, clavier).
 */
export function BlockPalette({ onInsert, onDragStartBlock, onDragEndBlock }: BlockPaletteProps) {
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATEGORY_ORDER.map((category) => ({
      category,
      blocks: BLOCK_CATALOG.filter(
        (b) =>
          b.category === category &&
          (!q || b.label.toLowerCase().includes(q) || b.description.toLowerCase().includes(q)),
      ),
    })).filter((g) => g.blocks.length > 0);
  }, [query]);

  return (
    <div className="flex-1 overflow-y-auto editor-scroll p-3 space-y-4 bg-[#FBF8F3]/40">
      <p className="text-[11px] leading-snug text-[#57534E]">
        Faites glisser un bloc sur la page, ou cliquez dessus pour l’ajouter après le bloc sélectionné.
      </p>

      <div className="relative">
        <Search className="w-3.5 h-3.5 text-[#57534E] absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un bloc"
          aria-label="Rechercher un bloc"
          className="w-full pl-8 pr-2 py-1.5 text-xs bg-[#FFFFFF] border border-[#E5DEC9] rounded-sm focus:outline-none focus:border-[#9A3412]"
        />
      </div>

      {groups.length === 0 && <p className="text-xs text-[#57534E]">Aucun bloc ne correspond à cette recherche.</p>}

      {groups.map((group) => (
        <section key={group.category} aria-label={group.category}>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#57534E] mb-2">{group.category}</h3>
          <div className="grid grid-cols-2 gap-2">
            {group.blocks.map((def) => {
              const Icon = ICONS[def.type];
              const factual = FACTUAL_EXCLUDABLE_BLOCKS.includes(def.type);
              return (
                <button
                  key={def.type}
                  type="button"
                  draggable
                  title={`${def.description}${factual ? ' Contenu factuel : les champs sont à compléter avec vos vraies informations.' : ''}`}
                  onClick={() => onInsert(def.type)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DND_MIME, encodePayload({ kind: 'new', type: def.type }));
                    e.dataTransfer.effectAllowed = 'copy';
                    // Laisse le navigateur créer l'image de glissement avant de modifier l'affichage de la page
                    setTimeout(() => onDragStartBlock(def.type), 0);
                  }}
                  onDragEnd={onDragEndBlock}
                  className="relative flex flex-col items-center gap-1.5 px-2 py-3 rounded-sm border border-[#E5DEC9] bg-[#FFFFFF] hover:border-[#9A3412] hover:bg-[#F4EFE6] active:cursor-grabbing cursor-grab text-[#1C1917] transition-colors"
                >
                  <Icon className="w-5 h-5 text-[#9A3412]" aria-hidden="true" />
                  <span className="text-[11px] font-semibold text-center leading-tight">{def.label}</span>
                  {factual && (
                    <span
                      className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#B45309]"
                      aria-label="Contenu factuel à compléter"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <p className="text-[11px] leading-snug text-[#57534E] flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#B45309] shrink-0" aria-hidden="true" />
        <span>Blocs factuels : leurs champs restent « À compléter », rien n’est inventé.</span>
      </p>
    </div>
  );
}

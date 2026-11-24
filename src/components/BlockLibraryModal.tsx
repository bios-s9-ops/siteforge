import { useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import type { BlockType } from '../types/site';
import { BLOCK_CATALOG } from '../utils/blockCatalog';

interface BlockLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBlock: (type: BlockType) => void;
}

const CATEGORIES: Array<'Tous' | 'Navigation' | 'Contenu' | 'Preuve sociale' | 'Conversion'> = [
  'Tous',
  'Navigation',
  'Contenu',
  'Preuve sociale',
  'Conversion',
];

export function BlockLibraryModal({ isOpen, onClose, onSelectBlock }: BlockLibraryModalProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Tous');

  if (!isOpen) return null;

  const filtered = BLOCK_CATALOG.filter((b) => {
    const matchesCat = category === 'Tous' || b.category === category;
    const matchesQuery =
      !search.trim() ||
      b.label.toLowerCase().includes(search.toLowerCase()) ||
      b.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1C1917]/55 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="block-library-title"
    >
      <div className="bg-[#FFFFFF] border border-[#E5DEC9] rounded-sm w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5DEC9] bg-[#FBF8F3] flex items-center justify-between gap-4">
          <div>
            <h2 id="block-library-title" className="font-display text-xl font-semibold text-[#1C1917]">
              Bibliothèque de blocs
            </h2>
            <p className="text-xs text-[#57534E]">
              Les blocs factuels ajoutés contiennent des repères « À compléter » afin de ne rien inventer.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la bibliothèque de blocs"
            className="p-2 rounded-sm text-[#57534E] hover:bg-[#F4EFE6] hover:text-[#1C1917] cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-[#E5DEC9] flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[#FFFFFF]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#57534E] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un bloc (tarifs, logos, galerie, FAQ...)"
              aria-label="Rechercher un bloc"
              className="w-full pl-9 pr-3 py-2 text-sm border border-[#E5DEC9] rounded-sm bg-[#FBF8F3] focus:outline-none focus:border-[#9A3412]"
            />
          </div>
          <div className="flex items-center gap-1 bg-[#F4EFE6] p-1 rounded-sm overflow-x-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-2.5 py-1.5 rounded-sm text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  category === cat ? 'bg-[#FFFFFF] text-[#1C1917] border border-[#E5DEC9]' : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 overflow-y-auto editor-scroll grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#FBF8F3]">
          {filtered.map((def) => (
            <button
              key={def.type}
              type="button"
              onClick={() => {
                onSelectBlock(def.type);
                onClose();
              }}
              className="text-left p-4 rounded-sm border border-[#E5DEC9] bg-[#FFFFFF] hover:border-[#9A3412] transition-colors flex items-start justify-between gap-3 cursor-pointer"
            >
              <div className="space-y-1">
                <div className="font-display font-semibold text-base text-[#1C1917]">{def.label}</div>
                <p className="text-xs text-[#57534E] leading-relaxed">{def.description}</p>
                <div className="text-[11px] text-[#57534E] pt-1 font-mono-tabular">
                  {def.category} · {def.variants.length} variantes
                </div>
              </div>
              <span className="w-7 h-7 rounded-sm bg-[#F4EFE6] text-[#9A3412] flex items-center justify-center shrink-0">
                <Plus className="w-4 h-4" aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

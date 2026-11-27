import { useRef, useState } from 'react';
import { Image as ImageIcon, Link2, Search, Trash2, Upload } from 'lucide-react';
import { ApiClientError, apiSearchImages } from '../services/geminiClient';
import { formatImageCredit, type StockImageResult } from '../utils/credits';
import { sanitizeUrl } from '../utils/validation';

export interface MediaValue {
  image: string;
  imageAlt?: string;
  imageCredit?: string;
}

interface MediaPickerProps {
  label: string;
  value: string;
  alt: string;
  credit?: string;
  /** Mot-clé proposé par défaut pour la recherche (titre du bloc, de l'élément…) */
  suggestedQuery?: string;
  onChange: (patch: MediaValue) => void;
}

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_DIMENSION = 1800;

/** Lit une image locale, la réduit (1800 px max) pour garder le projet léger, et la renvoie en Data URL. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Ce fichier n’est pas une image.'));
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      reject(new Error('Image trop lourde (12 Mo maximum).'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.onload = () => {
      const original = String(reader.result);
      // SVG et GIF animés : conservés tels quels
      if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
        resolve(original);
        return;
      }
      const img = new window.Image();
      img.onerror = () => reject(new Error('Image illisible.'));
      img.onload = () => {
        const ratio = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(original);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const keepAlpha = file.type === 'image/png' || file.type === 'image/webp';
        resolve(canvas.toDataURL(keepAlpha ? 'image/webp' : 'image/jpeg', 0.86));
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}

type Panel = null | 'stock' | 'url';

/**
 * Sélecteur de média : import local (ou glisser-déposer d'un fichier), recherche de photos libres de droits
 * avec auteur et licence, lien direct, ou retrait de l'image.
 */
export function MediaPicker({ label, value, alt, credit, suggestedQuery, onChange }: MediaPickerProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const [query, setQuery] = useState(suggestedQuery ?? '');
  const [results, setResults] = useState<StockImageResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');
  const [urlDraft, setUrlDraft] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const importFile = async (file?: File | null) => {
    if (!file) return;
    setMessage('');
    try {
      const dataUrl = await fileToDataUrl(file);
      onChange({ image: dataUrl, imageAlt: alt || file.name.replace(/\.[^.]+$/, ''), imageCredit: '' });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Import impossible.');
    }
  };

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setMessage('');
    try {
      const found = await apiSearchImages(q, 12);
      setResults(found);
      if (found.length === 0) setMessage('Aucune photo libre de droits trouvée. Essayez d’autres mots-clés.');
    } catch (err) {
      setResults([]);
      setMessage(err instanceof ApiClientError ? err.message : 'Recherche impossible pour le moment.');
    } finally {
      setSearching(false);
    }
  };

  const applyUrl = () => {
    const safe = sanitizeUrl(urlDraft, '');
    if (!safe || !/^https?:\/\//i.test(safe)) {
      setMessage('Entrez un lien complet commençant par https://');
      return;
    }
    onChange({ image: safe, imageAlt: alt, imageCredit: '' });
    setUrlDraft('');
    setPanel(null);
    setMessage('');
  };

  const button =
    'flex-1 min-w-[88px] py-1.5 px-2 rounded-sm border text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer';
  const idle = 'border-[#E5DEC9] bg-[#FFFFFF] hover:bg-[#F4EFE6] text-[#1C1917]';

  return (
    <div className="space-y-2.5">
      <div className="text-xs font-semibold text-[#1C1917]">{label}</div>

      <div
        onDragOver={(e) => {
          if (Array.from(e.dataTransfer.types).includes('Files')) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (e.dataTransfer.files.length > 0) {
            e.preventDefault();
            setDragOver(false);
            void importFile(e.dataTransfer.files[0]);
          }
        }}
        className={`rounded-sm border border-dashed overflow-hidden ${dragOver ? 'border-[#9A3412] bg-[#9A3412]/5' : 'border-[#C9BFA6] bg-[#FBF8F3]'}`}
      >
        {value ? (
          <img src={value} alt={alt || 'Aperçu de l’image'} className="w-full h-28 object-cover" />
        ) : (
          <div className="h-20 flex flex-col items-center justify-center gap-1 text-[11px] text-[#57534E] text-center px-3">
            <ImageIcon className="w-4 h-4" aria-hidden="true" />
            <span>Emplacement vide : glissez une image ici ou choisissez une option</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={`${button} ${idle}`} onClick={() => fileInput.current?.click()}>
          <Upload className="w-3 h-3" aria-hidden="true" />
          Importer
        </button>
        <button
          type="button"
          className={`${button} ${panel === 'stock' ? 'border-[#9A3412] bg-[#F4EFE6]' : idle}`}
          aria-pressed={panel === 'stock'}
          onClick={() => setPanel(panel === 'stock' ? null : 'stock')}
        >
          <Search className="w-3 h-3" aria-hidden="true" />
          Photos libres
        </button>
        <button
          type="button"
          className={`${button} ${panel === 'url' ? 'border-[#9A3412] bg-[#F4EFE6]' : idle}`}
          aria-pressed={panel === 'url'}
          onClick={() => setPanel(panel === 'url' ? null : 'url')}
        >
          <Link2 className="w-3 h-3" aria-hidden="true" />
          Lien
        </button>
        {value && (
          <button
            type="button"
            className={`${button} ${idle}`}
            onClick={() => onChange({ image: '', imageCredit: '' })}
            aria-label="Retirer l’image"
          >
            <Trash2 className="w-3 h-3" aria-hidden="true" />
            Retirer
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            void importFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      {panel === 'stock' && (
        <div className="space-y-2 bg-[#F4EFE6] border border-[#E5DEC9] rounded-sm p-2.5">
          <div className="flex gap-1.5">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="Ex. : boulangerie artisanale"
              aria-label="Mots-clés de la photo"
              className="flex-1 px-2.5 py-1.5 text-xs bg-[#FFFFFF] border border-[#E5DEC9] rounded-sm"
            />
            <button
              type="button"
              onClick={runSearch}
              disabled={searching || !query.trim()}
              className="px-3 rounded-sm bg-[#9A3412] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {searching ? '…' : 'Chercher'}
            </button>
          </div>
          {results.length > 0 && (
            <ul className="grid grid-cols-3 gap-1.5">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ image: r.url, imageAlt: alt || r.title, imageCredit: formatImageCredit(r) });
                      setPanel(null);
                    }}
                    title={`${r.title} — ${r.author} (${r.license})`}
                    className="w-full text-left cursor-pointer group"
                  >
                    <img src={r.thumbUrl} alt={r.title} loading="lazy" className="w-full h-14 object-cover rounded-sm border border-[#E5DEC9] group-hover:border-[#9A3412]" />
                    <span className="block text-[10px] leading-tight text-[#57534E] mt-0.5 truncate">{r.license}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[10px] leading-snug text-[#57534E]">
            Photos issues d’Openverse et de Wikimedia Commons. L’auteur et la licence sont enregistrés et affichés en bas du site : vérifiez-les avant de publier.
          </p>
        </div>
      )}

      {panel === 'url' && (
        <div className="flex gap-1.5">
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyUrl()}
            placeholder="https://…"
            aria-label="Lien de l’image"
            className="flex-1 px-2.5 py-1.5 text-xs bg-[#FFFFFF] border border-[#E5DEC9] rounded-sm"
          />
          <button type="button" onClick={applyUrl} className="px-3 rounded-sm bg-[#9A3412] text-white text-xs font-semibold cursor-pointer">
            Utiliser
          </button>
        </div>
      )}

      {message && (
        <p className="text-[11px] text-[#B45309]" role="status">
          {message}
        </p>
      )}

      {value && (
        <div>
          <label className="block text-[11px] font-medium text-[#57534E] mb-1">Texte alternatif (accessibilité)</label>
          <input
            type="text"
            value={alt}
            onChange={(e) => onChange({ image: value, imageAlt: e.target.value, imageCredit: credit })}
            className="w-full px-2.5 py-1.5 text-xs bg-[#FFFFFF] border border-[#E5DEC9] rounded-sm"
          />
        </div>
      )}

      {credit && <p className="text-[10px] leading-snug text-[#57534E]">Crédit : {credit}</p>}
    </div>
  );
}

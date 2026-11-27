import { RotateCcw } from 'lucide-react';
import type { ImageEffectConfig, SectionAnimationType } from '../types/site';
import {
  DEFAULT_IMAGE_EFFECT,
  IMAGE_3D_EFFECTS,
  IMAGE_SCROLL_EFFECTS,
  MAX_ANIMATION_MS,
  MIN_ANIMATION_MS,
  SECTION_ANIMATIONS,
  sanitizeImageEffect,
  sanitizeSectionAnimation,
} from '../utils/effectsCatalog';

const selectClass = 'w-full px-2.5 py-1.5 text-xs bg-[#FFFFFF] border border-[#E5DEC9] rounded-sm';
const labelClass = 'block text-[11px] font-medium text-[#57534E] mb-1';

interface ImageEffectControlsProps {
  value?: ImageEffectConfig;
  onChange: (next: ImageEffectConfig) => void;
  /** Le comparateur avant / après a besoin d'une seconde image */
  hasSecondaryImage?: boolean;
  idPrefix: string;
}

/** Effet de défilement et effet 3D d'une image, chacun avec son intensité de 0 à 100. */
export function ImageEffectControls({ value, onChange, hasSecondaryImage = false, idPrefix }: ImageEffectControlsProps) {
  const effect = sanitizeImageEffect(value ?? DEFAULT_IMAGE_EFFECT);
  const set = (patch: Partial<ImageEffectConfig>) => onChange({ ...effect, ...patch });
  const scrollDesc = IMAGE_SCROLL_EFFECTS.find((o) => o.id === effect.scroll)?.description;
  const fx3dDesc = IMAGE_3D_EFFECTS.find((o) => o.id === effect.effect3d)?.description;

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${idPrefix}-scroll`} className={labelClass}>
          Effet au défilement
        </label>
        <select
          id={`${idPrefix}-scroll`}
          value={effect.scroll}
          onChange={(e) => set({ scroll: sanitizeImageEffect({ ...effect, scroll: e.target.value }).scroll })}
          className={selectClass}
        >
          {IMAGE_SCROLL_EFFECTS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        {scrollDesc && <p className="text-[10px] text-[#57534E] mt-1">{scrollDesc}</p>}
        {effect.scroll !== 'none' && effect.scroll !== 'sticky-showcase' && (
          <div className="mt-1.5">
            <label htmlFor={`${idPrefix}-scroll-i`} className={labelClass}>
              Intensité : {effect.scrollIntensity}
            </label>
            <input
              id={`${idPrefix}-scroll-i`}
              type="range"
              min={0}
              max={100}
              value={effect.scrollIntensity}
              onChange={(e) => set({ scrollIntensity: Number(e.target.value) })}
              className="w-full accent-[#9A3412]"
            />
          </div>
        )}
      </div>

      <div>
        <label htmlFor={`${idPrefix}-3d`} className={labelClass}>
          Effet 3D ou interactif
        </label>
        <select
          id={`${idPrefix}-3d`}
          value={effect.effect3d}
          onChange={(e) => set({ effect3d: sanitizeImageEffect({ ...effect, effect3d: e.target.value }).effect3d })}
          className={selectClass}
        >
          {IMAGE_3D_EFFECTS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        {fx3dDesc && <p className="text-[10px] text-[#57534E] mt-1">{fx3dDesc}</p>}
        {effect.effect3d === 'before-after-slider' && !hasSecondaryImage && (
          <p className="text-[11px] text-[#B45309] mt-1" role="status">
            Ajoutez une seconde image ci-dessous : sans elle, le comparateur ne s’affiche pas.
          </p>
        )}
        {effect.effect3d !== 'none' && effect.effect3d !== 'before-after-slider' && (
          <div className="mt-1.5">
            <label htmlFor={`${idPrefix}-3d-i`} className={labelClass}>
              Intensité : {effect.effect3dIntensity}
            </label>
            <input
              id={`${idPrefix}-3d-i`}
              type="range"
              min={0}
              max={100}
              value={effect.effect3dIntensity}
              onChange={(e) => set({ effect3dIntensity: Number(e.target.value) })}
              className="w-full accent-[#9A3412]"
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface AnimationControlsProps {
  animation?: SectionAnimationType;
  durationMs?: number;
  onChange: (patch: { animation?: SectionAnimationType; animationDurationMs?: number }) => void;
  onReplay: () => void;
}

/** Animation d'entrée d'une section, sa durée, et un bouton pour la revoir. */
export function AnimationControls({ animation = 'none', durationMs = 700, onChange, onReplay }: AnimationControlsProps) {
  const desc = SECTION_ANIMATIONS.find((o) => o.id === animation)?.description;
  return (
    <div className="space-y-2.5">
      <div>
        <label htmlFor="section-animation" className={labelClass}>
          Animation d’apparition
        </label>
        <select
          id="section-animation"
          value={animation}
          onChange={(e) => onChange({ animation: sanitizeSectionAnimation(e.target.value) })}
          className={selectClass}
        >
          {SECTION_ANIMATIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        {desc && <p className="text-[10px] text-[#57534E] mt-1">{desc}</p>}
      </div>
      {animation !== 'none' && (
        <div className="space-y-1.5">
          <label htmlFor="section-animation-ms" className={labelClass}>
            Durée : {durationMs} ms
          </label>
          <input
            id="section-animation-ms"
            type="range"
            min={MIN_ANIMATION_MS}
            max={MAX_ANIMATION_MS}
            step={50}
            value={durationMs}
            onChange={(e) => onChange({ animationDurationMs: Number(e.target.value) })}
            className="w-full accent-[#9A3412]"
          />
          <button
            type="button"
            onClick={onReplay}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border border-[#E5DEC9] bg-[#FFFFFF] hover:bg-[#F4EFE6] text-[11px] font-medium cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            Revoir l’animation
          </button>
        </div>
      )}
    </div>
  );
}

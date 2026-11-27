import { Info } from 'lucide-react';

/** Mention affichée près de chaque fonction d'IA, comme dans les assistants grand public. */
export function AiNotice({ className = '' }: { className?: string }) {
  return (
    <p className={`flex items-start gap-1.5 text-[11px] leading-snug text-[#57534E] ${className}`} role="note">
      <Info className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
      <span>
        Votre demande et les données nécessaires sont transmises au fournisseur IA configuré (Groq ou Google Gemini) pour générer le résultat. Évitez les données sensibles et vérifiez les conditions de ce fournisseur. L’IA peut se tromper : vérifiez textes, faits, liens et crédits avant publication.
      </span>
    </p>
  );
}

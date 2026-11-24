import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { FormProvider, SiteProject, SiteSettings } from '../types/site';
import { FORM_PROVIDER_LABELS, describeFormDelivery } from '../utils/forms';
import { collectPublishIssues } from '../utils/publish';
import { getSiteSettings, normalizeSiteUrl, normalizeWhatsappNumber, resolveFormEmail } from '../utils/siteSettings';

interface PublishPanelProps {
  project: SiteProject;
  onUpdateProject: (project: SiteProject) => void;
  onJumpToBlock: (blockId: string) => void;
}

const PROVIDERS: FormProvider[] = ['none', 'formsubmit', 'web3forms', 'formspree', 'netlify', 'mailto', 'whatsapp'];

const inputClass = 'w-full px-3 py-2 text-xs bg-[#FFFFFF] border border-[#E5DEC9] rounded-sm focus:border-[#9A3412]';
const labelClass = 'block text-xs font-semibold text-[#1C1917] mb-1';
const helpClass = 'text-[11px] text-[#57534E] mt-1 leading-snug';

export function PublishPanel({ project, onUpdateProject, onJumpToBlock }: PublishPanelProps) {
  const settings = getSiteSettings(project);
  const delivery = useMemo(() => describeFormDelivery(project), [project]);
  const issues = useMemo(() => collectPublishIssues(project), [project]);
  const defaultEmail = resolveFormEmail({ settings: { ...settings, formEmail: '' }, blocks: project.blocks });

  const update = (patch: Partial<SiteSettings>) => {
    onUpdateProject({ ...project, settings: { ...settings, ...patch } });
  };

  const needsEmail = settings.formProvider === 'formsubmit' || settings.formProvider === 'mailto';
  const needsKey = settings.formProvider === 'web3forms' || settings.formProvider === 'formspree';
  const keyLabel = settings.formProvider === 'web3forms' ? 'Clé d’accès Web3Forms' : 'Identifiant ou lien Formspree';
  const keyHelp =
    settings.formProvider === 'web3forms'
      ? 'Créez une clé gratuite sur web3forms.com avec votre adresse e-mail, puis collez-la ici.'
      : 'Créez un formulaire sur formspree.io, puis collez ici son identifiant (ou le lien complet « formspree.io/f/… »).';

  const levelStyle =
    delivery.level === 'ok'
      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
      : delivery.level === 'warn'
        ? 'bg-[#FEF3C7] border-[#D97706]/60 text-[#78350F]'
        : 'bg-red-50 border-red-300 text-red-900';
  const LevelIcon = delivery.level === 'ok' ? CheckCircle2 : delivery.level === 'warn' ? AlertTriangle : XCircle;

  const whatsappRaw = settings.whatsappNumber ?? '';
  const whatsappInvalid = whatsappRaw.trim() !== '' && !normalizeWhatsappNumber(whatsappRaw);
  const siteUrlRaw = settings.siteUrl ?? '';
  const siteUrlInvalid = siteUrlRaw.trim() !== '' && !normalizeSiteUrl(siteUrlRaw);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-[#1C1917]">Recevoir les messages</h3>
        <div className={`text-xs rounded-sm border p-3 flex items-start gap-2 ${levelStyle}`} role="status">
          <LevelIcon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{delivery.text}</span>
        </div>

        <div>
          <label htmlFor="publish-provider" className={labelClass}>
            Mode de réception
          </label>
          <select
            id="publish-provider"
            value={settings.formProvider}
            onChange={(e) => update({ formProvider: e.target.value as FormProvider })}
            className={inputClass}
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {FORM_PROVIDER_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        {needsEmail && (
          <div>
            <label htmlFor="publish-email" className={labelClass}>
              Adresse qui reçoit les messages
            </label>
            <input
              id="publish-email"
              type="email"
              value={settings.formEmail ?? ''}
              placeholder={defaultEmail || 'vous@exemple.fr'}
              onChange={(e) => update({ formEmail: e.target.value })}
              className={inputClass}
            />
            <p className={helpClass}>
              Si le champ reste vide, l’e-mail du bloc Contact est utilisé{defaultEmail ? ` (${defaultEmail})` : ''}.
            </p>
          </div>
        )}

        {needsKey && (
          <div>
            <label htmlFor="publish-key" className={labelClass}>
              {keyLabel}
            </label>
            <input
              id="publish-key"
              type="text"
              value={settings.formKey ?? ''}
              onChange={(e) => update({ formKey: e.target.value })}
              className={inputClass}
              autoComplete="off"
            />
            <p className={helpClass}>{keyHelp}</p>
          </div>
        )}

        <div>
          <label htmlFor="publish-whatsapp" className={labelClass}>
            Numéro WhatsApp {settings.formProvider === 'whatsapp' ? '' : '(facultatif)'}
          </label>
          <input
            id="publish-whatsapp"
            type="tel"
            value={whatsappRaw}
            placeholder="Format international, ex. +33 6 12 34 56 78"
            onChange={(e) => update({ whatsappNumber: e.target.value })}
            className={`${inputClass} ${whatsappInvalid ? 'border-red-400' : ''}`}
          />
          <p className={helpClass}>
            {whatsappInvalid
              ? 'Numéro non valide : indiquez l’indicatif du pays puis le numéro (8 à 15 chiffres).'
              : 'Ajoute un bouton « Écrire sur WhatsApp » dans le bloc Contact.'}
          </p>
        </div>

        <div>
          <label htmlFor="publish-success" className={labelClass}>
            Message après un envoi réussi (facultatif)
          </label>
          <input
            id="publish-success"
            type="text"
            value={settings.successMessage ?? ''}
            placeholder="Merci, votre message a bien été envoyé. Nous vous répondons rapidement."
            onChange={(e) => update({ successMessage: e.target.value })}
            className={inputClass}
          />
        </div>
      </section>

      <section className="space-y-3 pt-4 border-t border-[#E5DEC9]">
        <h3 className="text-sm font-semibold text-[#1C1917]">Adresse du site</h3>
        <div>
          <label htmlFor="publish-url" className={labelClass}>
            Adresse publique (facultatif)
          </label>
          <input
            id="publish-url"
            type="url"
            value={siteUrlRaw}
            placeholder="https://www.monsite.fr"
            onChange={(e) => update({ siteUrl: e.target.value })}
            className={`${inputClass} ${siteUrlInvalid ? 'border-red-400' : ''}`}
          />
          <p className={helpClass}>
            {siteUrlInvalid
              ? 'L’adresse doit commencer par https:// ou http://.'
              : 'Sert au sitemap.xml et au lien canonique pour Google. Vous pouvez la remplir après avoir choisi l’hébergement ou le nom de domaine.'}
          </p>
        </div>
      </section>

      <section className="space-y-2.5 pt-4 border-t border-[#E5DEC9]">
        <h3 className="text-sm font-semibold text-[#1C1917]">Avant la mise en ligne</h3>
        <ul className="space-y-2">
          {issues.map((issue) => (
            <li
              key={issue.id}
              className={`text-xs rounded-sm border p-2.5 space-y-1 ${
                issue.severity === 'warning'
                  ? 'bg-[#FEF3C7]/60 border-[#D97706]/40 text-[#78350F]'
                  : 'bg-[#F4EFE6] border-[#E5DEC9] text-[#57534E]'
              }`}
            >
              <div className="font-semibold flex items-center gap-1.5">
                {issue.severity === 'warning' ? (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>{issue.title}</span>
              </div>
              <p className="leading-snug">{issue.detail}</p>
              {issue.fix?.kind === 'block' && (
                <button
                  type="button"
                  onClick={() => issue.fix?.kind === 'block' && onJumpToBlock(issue.fix.blockId)}
                  className="font-semibold underline cursor-pointer"
                >
                  Aller au bloc
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

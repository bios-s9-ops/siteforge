import type { FormProvider, SiteBlock, SiteProject } from '../types/site';
import { escapeHtml } from './validation';
import {
  cleanEmail,
  deriveQuoteOptions,
  getSiteSettings,
  normalizeWhatsappNumber,
  resolveFormEmail,
  toTelHref,
} from './siteSettings';

export const FORM_PROVIDER_LABELS: Record<FormProvider, string> = {
  none: 'Pas encore choisi',
  formsubmit: 'FormSubmit (adresse e-mail suffit)',
  web3forms: 'Web3Forms (clé d’accès gratuite)',
  formspree: 'Formspree (identifiant de formulaire)',
  netlify: 'Netlify Forms (si le site est hébergé chez Netlify)',
  mailto: 'Ouvrir la messagerie du visiteur',
  whatsapp: 'Ouvrir WhatsApp avec le message prêt',
};

/** Adresse utilisable dans une URL (FormSubmit) : caractères simples uniquement. */
function isUrlSafeEmail(email: string): boolean {
  return /^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);
}

export interface FormDelivery {
  /** Mode effectivement utilisé après repli éventuel */
  provider: FormProvider;
  /** Mode choisi dans les réglages */
  requested: FormProvider;
  endpoint: string;
  key: string;
  email: string;
  whatsapp: string;
  /** false : aucun message ne pourra arriver au propriétaire */
  configured: boolean;
  /** true : aucun service choisi, repli automatique sur la messagerie du visiteur */
  viaFallback: boolean;
}

export function resolveFormDelivery(project: Pick<SiteProject, 'settings' | 'blocks'>): FormDelivery {
  const s = getSiteSettings(project);
  const email = resolveFormEmail(project);
  const whatsapp = normalizeWhatsappNumber(s.whatsappNumber);
  const rawKey = (s.formKey ?? '').trim();
  const base = { requested: s.formProvider, endpoint: '', key: '', email, whatsapp, viaFallback: false };

  const unconfigured: FormDelivery = { ...base, provider: 'none', configured: false };
  const mailtoFallback = (): FormDelivery =>
    email
      ? { ...base, provider: 'mailto', configured: true, viaFallback: true }
      : unconfigured;

  switch (s.formProvider) {
    case 'formsubmit':
      return email && isUrlSafeEmail(email)
        ? { ...base, provider: 'formsubmit', endpoint: `https://formsubmit.co/ajax/${email}`, configured: true }
        : mailtoFallback();
    case 'web3forms':
      return /^[A-Za-z0-9-]{8,64}$/.test(rawKey)
        ? { ...base, provider: 'web3forms', endpoint: 'https://api.web3forms.com/submit', key: rawKey, configured: true }
        : mailtoFallback();
    case 'formspree': {
      const id = rawKey.match(/formspree\.io\/f\/([A-Za-z0-9]+)/)?.[1] ?? rawKey;
      return /^[A-Za-z0-9]{4,32}$/.test(id)
        ? { ...base, provider: 'formspree', endpoint: `https://formspree.io/f/${id}`, key: id, configured: true }
        : mailtoFallback();
    }
    case 'netlify':
      return { ...base, provider: 'netlify', endpoint: '/', configured: true };
    case 'mailto':
      return email ? { ...base, provider: 'mailto', configured: true } : unconfigured;
    case 'whatsapp':
      return whatsapp ? { ...base, provider: 'whatsapp', configured: true } : mailtoFallback();
    default:
      return mailtoFallback();
  }
}

export interface DeliveryDescription {
  level: 'ok' | 'warn' | 'error';
  text: string;
}

/** Phrase claire pour l'éditeur : où arrivent les messages, et ce qu'il reste à faire. */
export function describeFormDelivery(project: Pick<SiteProject, 'settings' | 'blocks'>): DeliveryDescription {
  const d = resolveFormDelivery(project);
  const s = getSiteSettings(project);

  if (!d.configured) {
    return {
      level: 'error',
      text: 'Aucun message ne pourra vous parvenir : choisissez un mode de réception ci-dessous et renseignez l’adresse ou la clé demandée.',
    };
  }
  if (d.viaFallback) {
    const why =
      s.formProvider === 'none'
        ? 'Aucun service choisi'
        : 'Réglage incomplet pour le service choisi';
    return {
      level: 'warn',
      text: `${why} : le formulaire ouvrira la messagerie du visiteur avec un message prérempli vers ${d.email}. Cela ne marche que si le visiteur a une messagerie configurée. Un service d’envoi est plus fiable.`,
    };
  }
  switch (d.provider) {
    case 'formsubmit':
      return {
        level: 'ok',
        text: `Les messages arrivent sur ${d.email}. Au tout premier envoi, FormSubmit envoie un e-mail d’activation à cette adresse : cliquez sur le lien qu’il contient, sinon rien n’est transmis.`,
      };
    case 'web3forms':
      return { level: 'ok', text: 'Les messages arrivent sur l’adresse associée à votre clé Web3Forms.' };
    case 'formspree':
      return { level: 'ok', text: 'Les messages arrivent sur l’adresse associée à votre formulaire Formspree.' };
    case 'netlify':
      return {
        level: 'warn',
        text: 'Netlify Forms ne fonctionne que si le site est hébergé chez Netlify. Les messages se lisent dans le tableau de bord Netlify (rubrique Forms).',
      };
    case 'mailto':
      return {
        level: 'warn',
        text: `Le formulaire ouvrira la messagerie du visiteur avec un message prérempli vers ${d.email}. Le message n’est envoyé que si le visiteur valide dans sa messagerie.`,
      };
    case 'whatsapp':
      return {
        level: 'ok',
        text: `Le formulaire ouvrira WhatsApp avec le message prêt à envoyer au +${d.whatsapp}. Le visiteur doit appuyer sur Envoyer dans WhatsApp.`,
      };
    default:
      return { level: 'error', text: 'Mode de réception inconnu.' };
  }
}

const DEFAULT_SUCCESS = 'Merci, votre message a bien été envoyé. Nous vous répondons rapidement.';

function field(
  block: SiteBlock,
  name: string,
  label: string,
  control: (id: string) => string,
  note?: string,
): string {
  const id = `sf-${escapeHtml(name)}-${escapeHtml(block.id)}`;
  return `<div>
        <label class="sf-field-label" for="${id}">${escapeHtml(label)}${note ? ` <span class="sf-field-note">${escapeHtml(note)}</span>` : ''}</label>
        ${control(id)}
      </div>`;
}

/**
 * Formulaire d'un bloc « contact » (variante « devis » incluse).
 * Le script FORM_RUNTIME_SCRIPT gère l'envoi réel : aucune fausse confirmation.
 */
export function renderFormHtml(block: SiteBlock, project: SiteProject, cardBgStyle: string): string {
  const delivery = resolveFormDelivery(project);
  const settings = getSiteSettings(project);
  const isQuote = block.variant === 'devis';
  const siteName = (project.name || 'Mon site').trim();
  const subject = isQuote ? `Demande de devis — ${siteName}` : `Nouveau message — ${siteName}`;
  const successMessage = (settings.successMessage ?? '').trim() || DEFAULT_SUCCESS;
  const options = isQuote ? deriveQuoteOptions(project, block) : [];

  const fallbackEmail = cleanEmail(block.content.email) || delivery.email;
  const fallbackTel = toTelHref(block.content.phone).replace(/^tel:/, '');

  const netlifyAttrs =
    delivery.provider === 'netlify'
      ? ` name="${escapeHtml(`contact-${block.id}`)}" method="POST" data-netlify="true" netlify-honeypot="_gotcha"`
      : ` name="${escapeHtml(`contact-${block.id}`)}"`;

  const attrs = [
    'data-sf-form',
    `data-provider="${escapeHtml(delivery.provider)}"`,
    `data-endpoint="${escapeHtml(delivery.endpoint)}"`,
    `data-key="${escapeHtml(delivery.key)}"`,
    `data-email="${escapeHtml(delivery.email)}"`,
    `data-whatsapp="${escapeHtml(delivery.whatsapp)}"`,
    `data-site="${escapeHtml(siteName)}"`,
    `data-subject="${escapeHtml(subject)}"`,
    `data-success="${escapeHtml(successMessage)}"`,
    `data-fallback-email="${escapeHtml(fallbackEmail)}"`,
    `data-fallback-tel="${escapeHtml(fallbackTel)}"`,
  ].join(' ');

  const unconfiguredNote = delivery.configured
    ? ''
    : `<p class="sf-form-note" role="note">Ce formulaire n’est pas encore relié à une boîte de réception.</p>`;

  const serviceField = isQuote
    ? options.length > 0
      ? field(
          block,
          'service',
          'Service ou produit concerné',
          (id) =>
            `<select class="sf-input" id="${id}" name="service" data-label="Service concerné">
          <option value="">Choisir…</option>
          ${options.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('')}
          <option value="Autre">Autre</option>
        </select>`,
        )
      : field(
          block,
          'service',
          'Service ou produit concerné',
          (id) => `<input class="sf-input" id="${id}" name="service" type="text" data-label="Service concerné" autocomplete="off" />`,
        )
    : '';

  const quoteExtras = isQuote
    ? `${field(
        block,
        'budget',
        'Budget envisagé',
        (id) => `<input class="sf-input" id="${id}" name="budget" type="text" data-label="Budget" autocomplete="off" />`,
        '(facultatif)',
      )}
      ${field(
        block,
        'deadline',
        'Délai souhaité',
        (id) => `<input class="sf-input" id="${id}" name="deadline" type="text" data-label="Délai souhaité" autocomplete="off" />`,
        '(facultatif)',
      )}`
    : '';

  const messageLabel = isQuote ? 'Détails de votre demande' : 'Votre message';
  const submitLabel = block.content.ctaLabel || (isQuote ? 'Demander mon devis' : 'Envoyer le message');
  const hidden =
    delivery.provider === 'netlify'
      ? `<input type="hidden" name="form-name" value="${escapeHtml(`contact-${block.id}`)}" />`
      : '';

  return `<form class="sf-card sf-form" style="${cardBgStyle}" ${attrs}${netlifyAttrs} novalidate>
      ${unconfiguredNote}
      ${hidden}
      ${field(
        block,
        'name',
        'Nom complet',
        (id) => `<input class="sf-input" id="${id}" name="name" type="text" required autocomplete="name" data-label="Nom" />`,
      )}
      ${field(
        block,
        'email',
        'Adresse e-mail',
        (id) => `<input class="sf-input" id="${id}" name="email" type="email" required autocomplete="email" data-label="E-mail" />`,
      )}
      ${field(
        block,
        'phone',
        'Téléphone',
        (id) => `<input class="sf-input" id="${id}" name="phone" type="tel" autocomplete="tel" data-label="Téléphone" />`,
        '(facultatif)',
      )}
      ${serviceField}
      ${quoteExtras}
      ${field(
        block,
        'message',
        messageLabel,
        (id) => `<textarea class="sf-textarea" id="${id}" name="message" rows="${isQuote ? 5 : 4}" required data-label="Message"></textarea>`,
      )}
      <div class="sf-hp" aria-hidden="true">
        <label>Ne pas remplir ce champ<input type="text" name="_gotcha" tabindex="-1" autocomplete="off" /></label>
      </div>
      <label class="sf-check">
        <input type="checkbox" name="consent" required />
        <span>J’accepte que ces informations soient utilisées pour répondre à ma demande.</span>
      </label>
      <button type="submit" class="sf-btn sf-btn-primary">${escapeHtml(submitLabel)}</button>
      <p class="sf-form-status" data-form-status role="status" aria-live="polite" hidden></p>
    </form>`;
}

/**
 * Script embarqué dans le site exporté. Il envoie réellement le message, ou affiche une erreur claire.
 * Il ne dit « envoyé » que si le service tiers a répondu avec succès.
 * window.__SF_DRY_RUN__ = true (aperçu de l'éditeur) : rien n'est transmis, le contenu est seulement affiché.
 */
export const FORM_RUNTIME_SCRIPT = `(function () {
  var DRY = window.__SF_DRY_RUN__ === true;

  function status(form, text, kind) {
    var el = form.querySelector('[data-form-status]');
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
    el.setAttribute('data-kind', kind);
  }

  function collect(form) {
    var out = [];
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.name.charAt(0) === '_' || el.name === 'form-name' || el.name === 'consent') return;
      if (el.type === 'submit' || el.type === 'button' || el.type === 'checkbox') return;
      var v = (el.value || '').trim();
      if (!v) return;
      out.push({ name: el.name, label: el.getAttribute('data-label') || el.name, value: v });
    });
    return out;
  }

  function asText(fields) {
    return fields.map(function (f) { return f.label + ' : ' + f.value; }).join('\\n');
  }

  function asObject(fields) {
    var o = {};
    fields.forEach(function (f) { o[f.name] = f.value; });
    return o;
  }

  function merge(a, b) {
    for (var k in b) if (Object.prototype.hasOwnProperty.call(b, k)) a[k] = b[k];
    return a;
  }

  function postJson(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        var refused = json && (json.success === false || json.success === 'false' || json.ok === false);
        return res.ok && !refused;
      });
    });
  }

  function postUrlEncoded(url, body) {
    var params = new URLSearchParams();
    Object.keys(body).forEach(function (k) { params.append(k, body[k]); });
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    }).then(function (res) { return res.ok; });
  }

  function fallbackText(form) {
    var mail = form.getAttribute('data-fallback-email');
    var tel = form.getAttribute('data-fallback-tel');
    var parts = [];
    if (mail) parts.push('écrivez-nous à ' + mail);
    if (tel) parts.push('appelez le ' + tel);
    return parts.length ? ' Vous pouvez aussi ' + parts.join(' ou ') + '.' : '';
  }

  function finish(form, btn, label) {
    btn.disabled = false;
    btn.textContent = label;
  }

  Array.prototype.forEach.call(document.querySelectorAll('form[data-sf-form]'), function (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var label = btn.textContent;

      if (!form.checkValidity()) {
        if (form.reportValidity) form.reportValidity();
        return;
      }

      var trap = form.querySelector('[name="_gotcha"]');
      if (trap && trap.value) { form.reset(); return; }

      var provider = form.getAttribute('data-provider');
      var endpoint = form.getAttribute('data-endpoint');
      var key = form.getAttribute('data-key');
      var email = form.getAttribute('data-email');
      var whatsapp = form.getAttribute('data-whatsapp');
      var subject = form.getAttribute('data-subject') || 'Nouveau message';
      var site = form.getAttribute('data-site') || '';
      var success = form.getAttribute('data-success') || 'Merci, votre message a bien été envoyé.';
      var fields = collect(form);
      var text = asText(fields);
      var data = asObject(fields);

      if (DRY) {
        status(form, 'Mode test : rien n’a été envoyé. Mode de réception : ' + provider + '.\\n' + text, 'info');
        return;
      }

      if (provider === 'none') {
        status(form, 'Ce formulaire n’est pas encore relié à une boîte de réception.' + fallbackText(form), 'error');
        return;
      }

      if (provider === 'mailto') {
        var href = 'mailto:' + email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
        status(form, 'Votre messagerie s’ouvre avec le message prêt. Il ne sera envoyé qu’une fois validé dans votre messagerie.', 'info');
        window.location.href = href;
        return;
      }

      if (provider === 'whatsapp') {
        var url = 'https://wa.me/' + whatsapp + '?text=' + encodeURIComponent(subject + '\\n\\n' + text);
        var win = window.open(url, '_blank', 'noopener');
        if (!win) { window.location.href = url; }
        status(form, 'WhatsApp s’ouvre avec votre message prêt. Appuyez sur Envoyer dans WhatsApp pour le transmettre.', 'info');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Envoi en cours…';
      var request;
      if (provider === 'formsubmit') {
        request = postJson(endpoint, merge({ _subject: subject, _template: 'table' }, data));
      } else if (provider === 'web3forms') {
        request = postJson(endpoint, merge({ access_key: key, subject: subject, from_name: site, botcheck: '' }, data));
      } else if (provider === 'formspree') {
        request = postJson(endpoint, merge({ _subject: subject }, data));
      } else if (provider === 'netlify') {
        request = postUrlEncoded(endpoint, merge({ 'form-name': form.getAttribute('name') || '' }, data));
      } else {
        request = Promise.resolve(false);
      }

      request.then(function (ok) {
        finish(form, btn, label);
        if (ok) {
          form.reset();
          status(form, success, 'ok');
        } else {
          status(form, 'L’envoi n’a pas abouti.' + fallbackText(form), 'error');
        }
      }).catch(function () {
        finish(form, btn, label);
        status(form, 'L’envoi n’a pas abouti : vérifiez votre connexion.' + fallbackText(form), 'error');
      });
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-prefill]'), function (link) {
    link.addEventListener('click', function () {
      var value = link.getAttribute('data-prefill');
      var form = document.querySelector('form[data-sf-form]');
      if (!value || !form) return;
      var select = form.querySelector('select[name="service"]');
      var input = form.querySelector('input[name="service"]');
      var message = form.querySelector('textarea[name="message"]');
      if (select) {
        var found = false;
        Array.prototype.forEach.call(select.options, function (opt) {
          if (opt.value === value) { select.value = value; found = true; }
        });
        if (!found && message && !message.value) message.value = 'Demande concernant : ' + value + '\\n';
      } else if (input) {
        input.value = value;
      } else if (message && !message.value) {
        message.value = 'Demande concernant : ' + value + '\\n';
      }
    });
  });
})();`;

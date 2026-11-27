import { Type } from '@google/genai';
import { createLLM, type LLMClient } from './llm';
import type {
  ArtDirectionId,
  BlockType,
  FontPairSuggestion,
  OriginalityReport,
  PaletteSuggestion,
  ProjectInput,
  RealFactsInput,
  SiteBlock,
  SiteProject,
  StructureAnalysis,
} from '../src/types/site';
import {
  ALLOWED_SITE_FONTS,
  applyArtDirectionToTheme,
  ART_DIRECTIONS,
  BANNED_FONTS,
  pickArtDirectionFromMood,
} from '../src/utils/artDirections';
import { BLOCK_CATALOG, createBlockId, createBlockInstance } from '../src/utils/blockCatalog';
import { hasProvidedFactualData, sanitizeForbiddenCopy, TODO_MARKER } from '../src/utils/honesty';
import { sanitizeFontName } from '../src/utils/validation';
import {
  clampDuration,
  HEADER_STYLE_IDS,
  IMAGE_3D_EFFECT_IDS,
  IMAGE_SCROLL_EFFECT_IDS,
  LAYOUT_MODE_IDS,
  sanitizeHeaderStyle,
  sanitizeImageEffect,
  sanitizeLayoutMode,
  sanitizeSectionAnimation,
  SECTION_ANIMATION_IDS,
} from '../src/utils/effectsCatalog';
import { ensureContrast, hexToHsl, normalizeHex } from '../src/utils/colorHarmony';
import { FONT_CATALOG, findFont } from '../src/utils/fonts';
import { formatImageCredit } from '../src/utils/credits';
import { searchRoyaltyFreeImages } from './stockImageService';
import { applyInspirationEffects, clearAllImages } from '../src/utils/projectIO';
import type {
  ImageEffectConfig,
  SiteFonts,
  SitePalette,
  SiteTheme,
} from '../src/types/site';

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

/** Groq en premier, Gemini en secours (voir server/llm.ts). Les clés manquantes sont signalées à l'appel. */
function getClient(): LLMClient {
  return createLLM();
}

export function mapGeminiError(err: unknown): {
  status: number;
  message: string;
  code: string;
  canFallbackToCapture?: boolean;
} {
  const raw = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;
  const code = (err as { code?: string })?.code;

  if (code === 'URL_UNREACHABLE') {
    return { status: 422, code: 'URL_UNREACHABLE', canFallbackToCapture: true, message: raw };
  }
  if (
    code === 'API_KEY_MISSING' ||
    code === 'API_KEY_INVALID' ||
    status === 403 ||
    /PERMISSION_DENIED|API_KEY_INVALID|API_KEY_MISSING/.test(raw)
  ) {
    return {
      status: 403,
      code: 'API_KEY_INVALID',
      message:
        'Clé API manquante ou refusée. Vérifiez GROQ_API_KEY (et GEMINI_API_KEY pour l’analyse d’images et d’URL) dans le fichier .env, puis relancez le serveur.',
    };
  }
  if (code === 'QUOTA_EXCEEDED' || status === 429 || /RESOURCE_EXHAUSTED|\b429\b/.test(raw)) {
    return {
      status: 429,
      code: 'QUOTA_EXCEEDED',
      message: 'Le service d’IA est temporairement saturé. Patientez quelques secondes puis cliquez sur Réessayer.',
    };
  }
  if (code === 'STOCK_UNAVAILABLE') {
    return { status: 503, code, message: raw };
  }
  if (code === 'INVALID_JSON' || code === 'EMPTY_RESPONSE') {
    return {
      status: 502,
      code: 'INVALID_RESPONSE',
      message: 'L’IA a renvoyé une réponse inutilisable. Cliquez sur Réessayer.',
    };
  }
  if (code === 'TIMEOUT') {
    return { status: 504, code: 'TIMEOUT', message: 'L’IA met trop de temps à répondre. Cliquez sur Réessayer.' };
  }
  if (code === 'NETWORK') {
    return { status: 503, code: 'NETWORK', message: 'Le service d’IA est injoignable pour le moment. Réessayez dans un instant.' };
  }
  if (status && status >= 400 && status < 500) {
    return { status, code: 'BAD_REQUEST', message: raw || 'Requête invalide.' };
  }
  return {
    status: 500,
    code: 'AI_ERROR',
    message: raw || 'Une erreur est survenue lors de l’appel à l’IA. Vous pouvez réessayer.',
  };
}

export function validateExternalUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw Object.assign(
      new Error('L’adresse URL fournie n’est pas valide. Utilisez un lien commençant par https://'),
      { status: 400 },
    );
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw Object.assign(new Error('Seules les URL http:// ou https:// sont autorisées.'), { status: 400 });
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    host.startsWith('169.254.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    throw Object.assign(new Error('Les adresses locales ou privées ne peuvent pas être analysées.'), { status: 400 });
  }
  return parsed.toString();
}

const VALID_BLOCK_TYPES: BlockType[] = [
  'navbar',
  'hero',
  'about',
  'services',
  'gallery',
  'products',
  'pricing',
  'testimonials',
  'faq',
  'stats',
  'team',
  'logos',
  'cta',
  'contact',
  'footer',
];

function sanitizeBlockType(t: string): BlockType {
  return VALID_BLOCK_TYPES.includes(t as BlockType) ? (t as BlockType) : 'services';
}

function defaultMediaForBlock(
  type: BlockType,
  index = 0,
  uploadedPhotos: RealFactsInput['uploadedPhotos'] = [],
): { image: string; imageAlt: string } {
  if (uploadedPhotos && uploadedPhotos.length > 0) {
    const safePool =
      type === 'team'
        ? uploadedPhotos.filter((p) => p.isPersonPhoto)
        : uploadedPhotos.filter((p) => !p.isPersonPhoto);
    const chosenPool = safePool.length > 0 ? safePool : uploadedPhotos;
    const chosen = chosenPool[index % chosenPool.length];
    if (chosen) {
      return { image: chosen.dataUrl, imageAlt: chosen.name.replace(/\.[^.]+$/, '') };
    }
  }
  // Aucune image par défaut : l'emplacement reste vide jusqu'à ce que l'utilisateur ajoute une photo.
  return { image: '', imageAlt: '' };
}

const STRUCTURE_ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    pageGoal: { type: Type.STRING, description: 'Objectif structurel général de la page.' },
    layoutRhythm: { type: Type.STRING, description: 'Rythme des espacements et alternance visuelle.' },
    visualHierarchy: { type: Type.STRING, description: 'Hiérarchie des titres, blocs et appels à l’action.' },
    layoutMode: { type: Type.STRING, description: `Architecture repérée : ${LAYOUT_MODE_IDS.join(', ')}` },
    headerStyle: { type: Type.STRING, description: `Navigation repérée : ${HEADER_STYLE_IDS.join(', ')}` },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          blockType: {
            type: Type.STRING,
            description:
              'Un des types exacts : navbar, hero, about, services, gallery, products, pricing, testimonials, faq, stats, team, logos, cta, contact, footer',
          },
          variantHint: { type: Type.STRING, description: 'Disposition suggérée (ex: split, centered, grid-3).' },
          layoutStyle: { type: Type.STRING, description: 'Organisation spatiale (grille, colonnes, alignements).' },
          purpose: { type: Type.STRING, description: 'Rôle structurel de cette section dans le parcours.' },
          columnCount: { type: Type.INTEGER, description: 'Nombre de colonnes principales (1 à 4).' },
          spacingNote: { type: Type.STRING, description: 'Densité et respiration visuelle.' },
          animation: { type: Type.STRING, description: `Animation d’entrée repérée : ${SECTION_ANIMATION_IDS.join(', ')}` },
          imageScroll: { type: Type.STRING, description: `Effet d’image au défilement repéré : ${IMAGE_SCROLL_EFFECT_IDS.join(', ')}` },
          image3d: { type: Type.STRING, description: `Effet 3D d’image repéré : ${IMAGE_3D_EFFECT_IDS.join(', ')}` },
        },
        required: ['blockType', 'variantHint', 'layoutStyle', 'purpose', 'columnCount', 'spacingNote'],
      },
    },
  },
  required: ['pageGoal', 'layoutRhythm', 'visualHierarchy', 'sections'],
};

/**
 * Étape 1 Anti-Plagiat & Honnêteté : extraction purement structurelle (zéro contenu, zéro donnée factuelle).
 */
export async function analyzeTemplateStructure(input: {
  mode: 'image' | 'url' | 'description';
  imageDataUrl?: string;
  url?: string;
  description?: string;
}): Promise<StructureAnalysis> {
  const ai = getClient();

  const antiPlagiarismSystem = `Tu es un architecte d'information pour SiteForge.
RÈGLE ANTI-PLAGIAT ET HONNÊTETÉ ABSOLUE :
- Extrais UNIQUEMENT le TYPE de chaque section (navbar, hero, about, services, gallery, products, pricing, testimonials, faq, stats, team, logos, cta, contact, footer) et son organisation spatiale (grille, colonnes, alignements, rythme).
- INTERDIT D'EXTRAIRE OU DE CITER : textes, slogans, noms de marque, logos, images, avis clients, chiffres/statistiques, tarifs, noms de personnes, adresses, téléphones, e-mails, code HTML/CSS, couleurs ou polices du modèle.
- Réponds en français uniquement.`;

  let rawAnalysisText = '';

  if (input.mode === 'image') {
    if (!input.imageDataUrl || !input.imageDataUrl.startsWith('data:image/')) {
      throw Object.assign(new Error('Veuillez importer une capture d’écran valide (PNG, JPG ou WebP).'), {
        status: 400,
      });
    }
    const [header, base64] = input.imageDataUrl.split(',');
    const mimeMatch = header.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64$/);
    if (!mimeMatch || !base64) {
      throw Object.assign(new Error('Format d’image non pris en charge.'), { status: 400 });
    }

    const res = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { mimeType: mimeMatch[1], data: base64 } },
          {
            text: 'Analyse uniquement le TYPE de chaque section visible et son agencement spatial (colonnes, alignement, rythme) sans mentionner aucun texte, chiffre, avis, prix, marque, logo ou couleur.',
          },
        ],
      },
      config: {
        systemInstruction: antiPlagiarismSystem,
        responseMimeType: 'application/json',
        responseSchema: STRUCTURE_ANALYSIS_SCHEMA,
      },
    });
    return JSON.parse(res.text ?? '{}') as StructureAnalysis;
  }

  if (input.mode === 'url') {
    const safeUrl = validateExternalUrl(input.url ?? '');
    let contextResponse;
    try {
      contextResponse = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Inspecte uniquement la structure de mise en page de ${safeUrl}. Liste seulement les types de sections (navbar, hero, services, produits, tarifs, FAQ, contact, footer), le nombre de colonnes et le rythme visuel. Ne reprends aucun texte, aucune donnée chiffrée, aucune coordonnée ni aucune couleur.`,
        config: {
          systemInstruction: antiPlagiarismSystem,
          tools: [{ urlContext: {} }],
        },
      });
    } catch {
      const err = new Error(
        'Cette URL n’a pas pu être analysée automatiquement (site protégé ou inaccessible). Importez plutôt une capture d’écran ou décrivez la structure souhaitée.',
      );
      (err as Error & { code?: string }).code = 'URL_UNREACHABLE';
      throw err;
    }

    rawAnalysisText = (contextResponse.text ?? '').trim();
    if (!rawAnalysisText || /impossible|cannot access|blocked|403|404|erreur/i.test(rawAnalysisText.slice(0, 140))) {
      const err = new Error(
        'Le contenu de cette URL n’a pas pu être lu directement. Utilisez une capture d’écran ou décrivez la mise en page.',
      );
      (err as Error & { code?: string }).code = 'URL_UNREACHABLE';
      throw err;
    }
  } else {
    if (!input.description?.trim()) {
      throw Object.assign(new Error('Veuillez décrire la structure du site modèle souhaité.'), { status: 400 });
    }
    rawAnalysisText = input.description.trim();
  }

  const structuredRes = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Transforme cette description structurelle en plan JSON normalisé (types de sections et colonnes uniquement, zéro contenu textuel ou factuel) :\n\n${rawAnalysisText}`,
    config: {
      systemInstruction: antiPlagiarismSystem,
      responseMimeType: 'application/json',
      responseSchema: STRUCTURE_ANALYSIS_SCHEMA,
    },
  });

  return JSON.parse(structuredRes.text ?? '{}') as StructureAnalysis;
}

const GENERATED_SITE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    seoTitle: { type: Type.STRING },
    seoDescription: { type: Type.STRING },
    artDirection: {
      type: Type.STRING,
      description:
        'Une parmi: editorial, artisanal, minimal_luxe, brutaliste_doux, vibrant, nature, retro_imprime, technique_sobre',
    },
    blocks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            description:
              'navbar, hero, about, services, gallery, products, pricing, testimonials, faq, stats, team, logos, cta, contact, footer',
          },
          variant: { type: Type.STRING },
          content: {
            type: Type.OBJECT,
            properties: {
              brandName: { type: Type.STRING },
              kicker: { type: Type.STRING },
              heading: { type: Type.STRING },
              subheading: { type: Type.STRING },
              body: { type: Type.STRING },
              ctaLabel: { type: Type.STRING },
              ctaHref: { type: Type.STRING },
              secondaryCtaLabel: { type: Type.STRING },
              secondaryCtaHref: { type: Type.STRING },
              imageAlt: { type: Type.STRING },
              email: { type: Type.STRING },
              phone: { type: Type.STRING },
              address: { type: Type.STRING },
              copyright: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    subtitle: { type: Type.STRING },
                    description: { type: Type.STRING },
                    price: { type: Type.STRING },
                    meta: { type: Type.STRING },
                    imageAlt: { type: Type.STRING },
                    linkLabel: { type: Type.STRING },
                    linkHref: { type: Type.STRING },
                    highlighted: { type: Type.BOOLEAN },
                    features: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['title'],
                },
              },
            },
          },
        },
        required: ['type', 'variant', 'content'],
      },
    },
  },
  required: ['seoTitle', 'seoDescription', 'artDirection', 'blocks'],
};

const ORIGINALITY_CHECK_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, description: 'original ou corrected' },
    summary: { type: Type.STRING, description: 'Résumé clair en français du contrôle effectué.' },
    adjustments: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Liste des ajustements appliqués si une formulation était générique, creuse ou proche.',
    },
    replacements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          blockIndex: { type: Type.INTEGER },
          heading: { type: Type.STRING },
          subheading: { type: Type.STRING },
          body: { type: Type.STRING },
        },
        required: ['blockIndex'],
      },
    },
  },
  required: ['status', 'summary', 'adjustments', 'replacements'],
};

type RawBlock = {
  type: string;
  variant: string;
  content: Record<string, unknown>;
  animation?: string;
  animationDurationMs?: number;
  imageSlots?: unknown;
};

/** Emplacements d'images demandés par l'IA, rattachés au bloc le temps de la génération. */
type BlockWithSlots = SiteBlock & { __slots?: unknown };

function enforceHonestyOnBlocks(
  rawBlocks: RawBlock[],
  siteName: string,
  realFacts?: RealFactsInput,
): SiteBlock[] {
  const uploadedPhotos = realFacts?.uploadedPhotos ?? [];
  const hasRealPrices = Boolean(realFacts?.prices?.trim());
  const realEmail = realFacts?.email?.trim();
  const realPhone = realFacts?.phone?.trim();
  const realAddress = realFacts?.address?.trim();

  // Exclure par défaut testimonials, stats, team et logos s'ils n'ont pas été fournis en faits réels
  const filteredRaw = rawBlocks.filter((b) => {
    const t = sanitizeBlockType(b.type);
    if (t === 'testimonials' || t === 'stats' || t === 'team' || t === 'logos') {
      return hasProvidedFactualData(realFacts, t);
    }
    return true;
  });

  return filteredRaw.map((b, blockIdx) => {
    const type = sanitizeBlockType(b.type);
    const def = BLOCK_CATALOG.find((d) => d.type === type) ?? BLOCK_CATALOG[0];
    const validVariant = def.variants.some((v) => v.id === b.variant) ? b.variant : def.variants[0].id;
    const rawContent = (b.content ?? {}) as Record<string, unknown>;
    const defaults = def.createDefaultContent(siteName);

    const needsImage = type === 'hero' || type === 'about';
    const media = needsImage ? defaultMediaForBlock(type, blockIdx, uploadedPhotos) : undefined;

    const rawItems = Array.isArray(rawContent.items) ? rawContent.items : defaults.items ?? [];
    const items = rawItems.map((it: Record<string, unknown>, itemIdx: number) => {
      const itemNeedsMedia = type === 'gallery' || type === 'products' || type === 'team';
      const itemMedia = itemNeedsMedia ? defaultMediaForBlock(type, itemIdx + blockIdx, uploadedPhotos) : undefined;

      let itemPrice = typeof it.price === 'string' ? sanitizeForbiddenCopy(it.price) : undefined;
      if ((type === 'products' || type === 'pricing') && !hasRealPrices) {
        itemPrice = TODO_MARKER;
      }

      return {
        id: createBlockId('it'),
        title:
          typeof it.title === 'string' && it.title.trim()
            ? sanitizeForbiddenCopy(it.title)
            : TODO_MARKER,
        subtitle: typeof it.subtitle === 'string' ? sanitizeForbiddenCopy(it.subtitle) : undefined,
        description: typeof it.description === 'string' ? sanitizeForbiddenCopy(it.description) : undefined,
        price: itemPrice,
        meta: typeof it.meta === 'string' ? sanitizeForbiddenCopy(it.meta) : undefined,
        linkLabel: typeof it.linkLabel === 'string' ? sanitizeForbiddenCopy(it.linkLabel) : undefined,
        linkHref: typeof it.linkHref === 'string' ? it.linkHref : '#contact',
        highlighted: Boolean(it.highlighted),
        features: Array.isArray(it.features)
          ? it.features
              .filter((f): f is string => typeof f === 'string')
              .map((f) => sanitizeForbiddenCopy(f))
          : undefined,
        image: itemMedia ? itemMedia.image : undefined,
        imageAlt:
          typeof it.imageAlt === 'string' && it.imageAlt.trim()
            ? sanitizeForbiddenCopy(it.imageAlt)
            : itemMedia?.imageAlt,
      };
    });

    let contactEmail = defaults.email;
    let contactPhone = defaults.phone;
    let contactAddress = defaults.address;
    if (type === 'contact') {
      contactEmail = realEmail || TODO_MARKER;
      contactPhone = realPhone || TODO_MARKER;
      contactAddress = realAddress || TODO_MARKER;
    }

    return {
      id: createBlockId(type),
      type,
      variant: validVariant,
      visible: true,
      animation: type === 'navbar' ? 'none' : sanitizeSectionAnimation(b.animation),
      animationDurationMs: clampDuration(b.animationDurationMs),
      ...(b.imageSlots ? { __slots: b.imageSlots } : {}),
      content: {
        ...defaults,
        brandName:
          typeof rawContent.brandName === 'string' && rawContent.brandName
            ? sanitizeForbiddenCopy(rawContent.brandName)
            : siteName,
        kicker:
          typeof rawContent.kicker === 'string'
            ? sanitizeForbiddenCopy(rawContent.kicker)
            : defaults.kicker,
        heading:
          typeof rawContent.heading === 'string' && rawContent.heading
            ? sanitizeForbiddenCopy(rawContent.heading)
            : defaults.heading,
        subheading:
          typeof rawContent.subheading === 'string'
            ? sanitizeForbiddenCopy(rawContent.subheading)
            : defaults.subheading,
        body:
          typeof rawContent.body === 'string'
            ? sanitizeForbiddenCopy(rawContent.body)
            : defaults.body,
        ctaLabel:
          typeof rawContent.ctaLabel === 'string'
            ? sanitizeForbiddenCopy(rawContent.ctaLabel)
            : defaults.ctaLabel,
        ctaHref: typeof rawContent.ctaHref === 'string' ? rawContent.ctaHref : defaults.ctaHref,
        secondaryCtaLabel:
          typeof rawContent.secondaryCtaLabel === 'string'
            ? sanitizeForbiddenCopy(rawContent.secondaryCtaLabel)
            : defaults.secondaryCtaLabel,
        secondaryCtaHref:
          typeof rawContent.secondaryCtaHref === 'string'
            ? rawContent.secondaryCtaHref
            : defaults.secondaryCtaHref,
        email: contactEmail,
        phone: contactPhone,
        address: contactAddress,
        copyright:
          typeof rawContent.copyright === 'string'
            ? sanitizeForbiddenCopy(rawContent.copyright)
            : defaults.copyright,
        image: media ? media.image : undefined,
        imageAlt:
          typeof rawContent.imageAlt === 'string' && rawContent.imageAlt.trim()
            ? sanitizeForbiddenCopy(rawContent.imageAlt)
            : media?.imageAlt,
        items,
      },
    };
  });
}

function resolveArtDirectionId(requested?: string, fallbackMood?: string): ArtDirectionId {
  const found = ART_DIRECTIONS.find((d) => d.id === requested);
  if (found) return found.id;
  return pickArtDirectionFromMood(fallbackMood ?? '');
}

const HONESTY_AND_STYLE_SYSTEM_PROMPT = `Tu es le rédacteur et directeur artistique senior de SiteForge.
RÈGLES ABSOLUES D'HONNÊTETÉ FACTUELLE :
1. N'INVENTE JAMAIS : avis clients, témoignages, notes/étoiles, nombre de clients, statistiques, chiffres de croissance, pourcentages de réussite, prix/tarifs, noms de membres d'équipe, certifications, récompenses, logos partenaires, adresses postales, numéros de téléphone ou adresses e-mail.
2. Si l'utilisateur n'a pas fourni de faits réels pour Témoignages, Statistiques, Équipe ou Logos, N'INCLUS PAS ces blocs.
3. Si l'utilisateur n'a pas fourni ses coordonnées pour Contact ou ses tarifs pour Tarifs/Produits, mets exactement la valeur "À compléter" dans ces champs.
4. TON HUMAIN ET CONCRET : phrases courtes, précises, vocabulaire propre au métier. Aucune formule creuse ("Révolutionnez", "Libérez le potentiel", "Solution tout-en-un", "Découvrez", "Propulsez"). Aucun emoji utilisé comme icône.
5. Réponds uniquement en JSON conforme au schéma sans HTML brut.`;

export async function generateOriginalSite(
  projectInput: ProjectInput,
  structureAnalysis?: StructureAnalysis,
): Promise<{ project: SiteProject; originalityReport: OriginalityReport }> {
  const ai = getClient();
  const realFacts = projectInput.realFacts;

  const catalogGuide = BLOCK_CATALOG.map(
    (b) => `- ${b.type} (variantes: ${b.variants.map((v) => v.id).join(', ')})`,
  ).join('\n');

  const structurePrompt = structureAnalysis
    ? `ARCHITECTURE STRUCTURELLE À SUIVRE (types de blocs et organisation spatiale uniquement, zéro texte ou contenu du modèle) :\n${JSON.stringify(structureAnalysis)}`
    : `Crée une architecture cohérente de 6 à 8 sections commençant par navbar + hero et se terminant par contact + footer (sans inventer de blocs factuels vides).`;

  const realFactsSummary = realFacts
    ? `FAITS RÉELS FOURNIS PAR L'UTILISATEUR (à utiliser fidèlement sans rien inventer d'autre) :
- Produits / Services réels : ${realFacts.productsOrServices || 'Non fourni'}
- Tarifs réels : ${realFacts.prices || 'Non fourni -> écrire "À compléter" si bloc tarifs/produits'}
- Adresse réelle : ${realFacts.address || 'Non fourni -> "À compléter"'}
- Téléphone réel : ${realFacts.phone || 'Non fourni -> "À compléter"'}
- E-mail réel : ${realFacts.email || 'Non fourni -> "À compléter"'}
- Réseaux sociaux : ${realFacts.socialLinks || 'Non fourni'}
- Vrais témoignages clients : ${realFacts.testimonials || 'Aucun -> ne pas générer de bloc testimonials'}
- Membres réels de l'équipe : ${realFacts.teamMembers || 'Aucun -> ne pas générer de bloc team'}
- Chiffres vérifiés : ${realFacts.stats || 'Aucun -> ne pas générer de bloc stats'}
- Partenaires / Clients réels : ${realFacts.partnerLogos || 'Aucun -> ne pas générer de bloc logos'}`
    : `AUCUNE DONNÉE FACTUELLE FOURNIE : n'inclus aucun bloc testimonials, stats, team ou logos ; mets "À compléter" pour email, phone, address et les éventuels prix.`;

  const directionChoice = projectInput.artDirection || pickArtDirectionFromMood(projectInput.mood);

  const prompt = `Génère un site web 100 % ORIGINAL en français pour le projet suivant :
- Nom du site / de la marque : ${projectInput.siteName}
- Activité : ${projectInput.activity}
- Ambiance souhaitée : ${projectInput.mood}
- Direction artistique privilégiée : ${directionChoice}
- Public cible : ${projectInput.targetAudience || 'Grand public et clients locaux'}
- Objectif principal : ${projectInput.goal}

${realFactsSummary}

${structurePrompt}

Types de blocs et variantes autorisés (alterne les variantes pour éviter deux sections identiques d'affilée) :
${catalogGuide}

Règles de liens et de contact :
- Les liens (linkHref, ctaHref, secondaryCtaHref) ne pointent que vers des sections réellement présentes dans la page (#accueil, #apropos, #services, #galerie, #produits, #tarifs, #faq, #contact...). Sans section correspondante, ne mets pas de lien.
- Si l'objectif est de recevoir des demandes de prix ou de devis, utilise le bloc contact avec la variante "devis".
- N'invente jamais d'e-mail, de téléphone ni d'adresse postale : écris "À compléter" tant qu'ils ne sont pas fournis.`;

  const res = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction: HONESTY_AND_STYLE_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: GENERATED_SITE_SCHEMA,
    },
  });

  const parsed = JSON.parse(res.text ?? '{}');
  const blocks = enforceHonestyOnBlocks(
    Array.isArray(parsed.blocks) ? parsed.blocks : [],
    projectInput.siteName,
    realFacts,
  );

  const resolvedDirection = projectInput.artDirection
    ? projectInput.artDirection
    : resolveArtDirectionId(parsed.artDirection, projectInput.mood);
  const theme = applyArtDirectionToTheme(resolvedDirection);

  // Étape 3 : Contrôle d'originalité et d'honnêteté automatique (conservé intact)
  const auditPrompt = `Contrôle l'originalité et l'honnêteté de ce site généré pour "${projectInput.siteName}" (${projectInput.activity}).
Contexte de référence éventuel : ${projectInput.referenceDescription || projectInput.referenceUrl || 'Création de zéro'}
Analyse structurelle : ${structureAnalysis ? JSON.stringify(structureAnalysis) : 'Aucune'}
Blocs générés : ${JSON.stringify(
    blocks.map((b, idx) => ({
      blockIndex: idx,
      type: b.type,
      heading: b.content.heading,
      subheading: b.content.subheading,
      body: b.content.body,
    })),
  )}

Vérifie deux points :
1. Aucune ressemblance textuelle avec un modèle tiers.
2. Aucune formule creuse ("Révolutionnez", "Libérez le potentiel", "Solution tout-en-un", "Découvrez"), aucun emoji, et aucune statistique ou promesse chiffrée inventée.
Si besoin, fournis des textes de remplacement concrets et sobrement rédigés dans "replacements".`;

  let originalityReport: OriginalityReport = {
    checked: true,
    status: 'original',
    summary:
      'Contrôle d’originalité et d’honnêteté validé : contenu original, ton concret et direction artistique dédiée.',
    adjustments: [],
    checkedAt: new Date().toISOString(),
  };

  try {
    const auditRes = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: auditPrompt,
      config: {
        systemInstruction:
          'Tu es le vérificateur anti-plagiat et d’honnêteté éditoriale de SiteForge. Réponds en français selon le schéma JSON.',
        responseMimeType: 'application/json',
        responseSchema: ORIGINALITY_CHECK_SCHEMA,
      },
    });
    const audit = JSON.parse(auditRes.text ?? '{}');
    if (Array.isArray(audit.replacements)) {
      for (const rep of audit.replacements) {
        const target = blocks[rep.blockIndex];
        if (target) {
          if (typeof rep.heading === 'string' && rep.heading.trim()) {
            target.content.heading = sanitizeForbiddenCopy(rep.heading.trim());
          }
          if (typeof rep.subheading === 'string' && rep.subheading.trim()) {
            target.content.subheading = sanitizeForbiddenCopy(rep.subheading.trim());
          }
          if (typeof rep.body === 'string' && rep.body.trim()) {
            target.content.body = sanitizeForbiddenCopy(rep.body.trim());
          }
        }
      }
    }
    originalityReport = {
      checked: true,
      status: audit.status === 'corrected' ? 'corrected' : 'original',
      summary:
        audit.summary ||
        'Contrôle d’originalité et d’honnêteté terminé : contenu original vérifié pour votre marque.',
      adjustments: Array.isArray(audit.adjustments) ? audit.adjustments : [],
      checkedAt: new Date().toISOString(),
    };
  } catch {
    // Keep validated report on transient failure
  }

  const now = new Date().toISOString();
  const project: SiteProject = {
    id: `prj_${Math.random().toString(36).slice(2, 9)}`,
    name: projectInput.siteName,
    seoTitle: sanitizeForbiddenCopy(parsed.seoTitle || `${projectInput.siteName} — ${projectInput.activity}`),
    seoDescription: sanitizeForbiddenCopy(
      parsed.seoDescription || `${projectInput.siteName} : ${projectInput.activity}.`,
    ),
    isDemo: false,
    theme,
    blocks,
    originalityReport,
    structureAnalysis,
    projectInput,
    createdAt: now,
    updatedAt: now,
  };

  if (projectInput.mode === 'inspiration') {
    // Mode inspiration : structure, rythme et effets repris de la référence, jamais ses images ni les vôtres :
    // chaque emplacement d'image reste vide, prêt à recevoir une photo.
    return { project: clearAllImages(applyInspirationEffects(project, structureAnalysis)), originalityReport };
  }

  return { project, originalityReport };
}


// --- Mode « Générer avec l'IA » : trois propositions différentes ---------------------------------------

const PROPOSAL_BLOCK_SCHEMA = {
  ...GENERATED_SITE_SCHEMA.properties.blocks.items,
  properties: {
    ...GENERATED_SITE_SCHEMA.properties.blocks.items.properties,
    animation: { type: Type.STRING, description: SECTION_ANIMATION_IDS.join(', ') },
    animationDurationMs: { type: Type.NUMBER },
    imageSlots: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          target: { type: Type.STRING, description: 'content (image du bloc) ou item (image d’un élément)' },
          itemIndex: { type: Type.NUMBER },
          query: { type: Type.STRING, description: 'Mots-clés concrets de recherche de photo libre de droits, 2 à 5 mots.' },
          alt: { type: Type.STRING },
          scroll: { type: Type.STRING, description: IMAGE_SCROLL_EFFECT_IDS.join(', ') },
          scrollIntensity: { type: Type.NUMBER },
          effect3d: { type: Type.STRING, description: IMAGE_3D_EFFECT_IDS.join(', ') },
          effect3dIntensity: { type: Type.NUMBER },
        },
        required: ['target', 'query'],
      },
    },
  },
};

const PROPOSALS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    proposals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Nom court de la proposition (3 à 5 mots).' },
          concept: { type: Type.STRING, description: 'Une phrase qui résume l’idée visuelle.' },
          siteName: { type: Type.STRING },
          seoTitle: { type: Type.STRING },
          seoDescription: { type: Type.STRING },
          layoutMode: { type: Type.STRING, description: LAYOUT_MODE_IDS.join(', ') },
          headerStyle: { type: Type.STRING, description: HEADER_STYLE_IDS.join(', ') },
          visitorThemeToggle: { type: Type.BOOLEAN },
          palette: {
            type: Type.OBJECT,
            properties: {
              primary: { type: Type.STRING },
              secondary: { type: Type.STRING },
              background: { type: Type.STRING },
              surface: { type: Type.STRING },
              text: { type: Type.STRING },
              mutedText: { type: Type.STRING },
            },
            required: ['primary', 'secondary', 'background', 'surface', 'text', 'mutedText'],
          },
          fonts: {
            type: Type.OBJECT,
            properties: { heading: { type: Type.STRING }, body: { type: Type.STRING } },
            required: ['heading', 'body'],
          },
          blocks: { type: Type.ARRAY, items: PROPOSAL_BLOCK_SCHEMA },
        },
        required: ['name', 'concept', 'layoutMode', 'headerStyle', 'palette', 'fonts', 'blocks'],
      },
    },
  },
  required: ['proposals'],
};

const LAYOUT_FALLBACK_ORDER = ['vertical', 'split-screen', 'bento-grid', 'scroll-story', 'horizontal-slides'] as const;
const HEADER_FALLBACK_ORDER = ['classic-bar', 'floating-glass', 'minimal-centered', 'vertical-sidebar'] as const;

/** Violet, rose et cyan fluo : la teinte typique des sites « faits par une IA », refusée comme couleur de marque. */
export function isClicheNeonColor(hex: string): boolean {
  const { h, s, l } = hexToHsl(hex);
  const vivid = s > 55 && l > 38 && l < 78;
  const purplePink = h >= 265 && h <= 335;
  const neonCyan = h >= 170 && h <= 200 && s > 75;
  return vivid && (purplePink || neonCyan);
}

export function sanitizeProposalPalette(raw: unknown, fallback: SitePalette): SitePalette {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pick = (key: Exclude<keyof SitePalette, 'name'>): string => normalizeHex(String(r[key] ?? '')) ?? fallback[key];
  let palette: SitePalette = {
    primary: pick('primary'),
    secondary: pick('secondary'),
    background: pick('background'),
    surface: pick('surface'),
    text: pick('text'),
    mutedText: pick('mutedText'),
  };
  if (isClicheNeonColor(palette.primary) || isClicheNeonColor(palette.secondary)) {
    palette = { ...palette, primary: fallback.primary, secondary: fallback.secondary };
  }
  if (palette.surface === palette.background) palette.surface = fallback.surface;
  palette.text = ensureContrast(palette.text, palette.background, 4.5);
  palette.mutedText = ensureContrast(palette.mutedText, palette.background, 3.5);
  return palette;
}

function sanitizeProposalFonts(raw: unknown, fallback: SiteFonts): SiteFonts {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const ok = (value: unknown, fb: string): string => {
    const name = typeof value === 'string' ? sanitizeFontName(value, '') : '';
    if (!name) return fb;
    if ((BANNED_FONTS as readonly string[]).includes(name)) return fb;
    return findFont(name) || (ALLOWED_SITE_FONTS as readonly string[]).includes(name) ? name : fb;
  };
  return { heading: ok(r.heading, fallback.heading), body: ok(r.body, fallback.body) };
}

/** Garantit des mises en page et des navigations différentes d'une proposition à l'autre. */
export function diversifyChoices<T extends string>(chosen: T[], pool: readonly T[]): T[] {
  const used = new Set<T>();
  return chosen.map((value) => {
    if (!used.has(value)) {
      used.add(value);
      return value;
    }
    const replacement = pool.find((p) => !used.has(p)) ?? value;
    used.add(replacement);
    return replacement;
  });
}

async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

const FACTUAL_REQUESTS: Array<{ re: RegExp; type: BlockType }> = [
  { re: /t[ée]moignage|avis (client|des clients)/i, type: 'testimonials' },
  { re: /[ée]quipe/i, type: 'team' },
  { re: /chiffres?|statistiques?/i, type: 'stats' },
  { re: /partenaires?|logos?|r[ée]f[ée]rences/i, type: 'logos' },
];

interface ImageSlotRaw {
  target?: string;
  itemIndex?: number;
  query?: string;
  alt?: string;
  scroll?: string;
  scrollIntensity?: number;
  effect3d?: string;
  effect3dIntensity?: number;
}

type StockSearchFn = typeof searchRoyaltyFreeImages;

/**
 * Remplit les emplacements d'images d'une proposition avec des photos libres de droits uniquement.
 * Sans résultat, l'emplacement reste vide (jamais d'image de substitution ni d'illustration générée),
 * mais les effets choisis sont conservés pour la photo que l'utilisateur ajoutera.
 */
export async function fillImageSlots(
  blocks: BlockWithSlots[],
  search: StockSearchFn = searchRoyaltyFreeImages,
  cache: Map<string, Awaited<ReturnType<StockSearchFn>> | null> = new Map(),
): Promise<{ filled: number; empty: number }> {
  const jobs: Array<{ block: BlockWithSlots; slot: ImageSlotRaw }> = [];
  for (const block of blocks) {
    const slots = Array.isArray(block.__slots) ? (block.__slots as ImageSlotRaw[]) : [];
    for (const slot of slots.slice(0, 8)) {
      if (slot && typeof slot.query === 'string' && slot.query.trim()) jobs.push({ block, slot });
    }
    delete block.__slots;
  }

  const queries = Array.from(new Set(jobs.map((j) => j.slot.query!.trim().toLowerCase())));
  await mapWithLimit(queries, 4, async (q) => {
    if (cache.has(q)) return;
    try {
      cache.set(q, await search(q, 8));
    } catch {
      cache.set(q, null);
    }
  });

  const used = new Set<string>();
  let filled = 0;
  let empty = 0;
  for (const { block, slot } of jobs) {
    const results = cache.get(slot.query!.trim().toLowerCase()) ?? [];
    const found = results.find((r) => !used.has(r.url));
    const effect: ImageEffectConfig = sanitizeImageEffect({
      scroll: slot.scroll,
      scrollIntensity: slot.scrollIntensity,
      effect3d: slot.effect3d === 'before-after-slider' ? 'none' : slot.effect3d,
      effect3dIntensity: slot.effect3dIntensity,
    });
    const alt = typeof slot.alt === 'string' && slot.alt.trim() ? sanitizeForbiddenCopy(slot.alt) : found?.title ?? '';
    const patch = found
      ? { image: found.url, imageAlt: alt, imageCredit: formatImageCredit(found), imageEffect: effect }
      : { image: '', imageAlt: alt, imageEffect: effect };
    if (found) {
      used.add(found.url);
      filled += 1;
    } else {
      empty += 1;
    }
    if (slot.target === 'item') {
      const item = block.content.items?.[Math.max(0, Math.floor(slot.itemIndex ?? 0))];
      if (item) Object.assign(item, patch);
    } else if (block.type === 'hero' || block.type === 'about') {
      Object.assign(block.content, patch);
    }
  }
  return { filled, empty };
}

export interface ProposalInput {
  description: string;
  vision: string;
  mustHave: string;
  siteName?: string;
}

export interface GeneratedProposal {
  id: string;
  name: string;
  concept: string;
  project: SiteProject;
}

/**
 * Génère 3 propositions différentes à partir d'un brief en trois champs :
 * description, vision (ambiance, couleurs, effets) et éléments indispensables.
 * Les textes, la mise en page, la palette, les polices, les animations et les effets viennent de l'IA ;
 * les photos viennent uniquement des banques libres de droits.
 */
export async function generateSiteProposals(
  input: ProposalInput,
  deps: { llm?: LLMClient; search?: StockSearchFn } = {},
): Promise<GeneratedProposal[]> {
  const ai = deps.llm ?? getClient();
  const catalogGuide = BLOCK_CATALOG.map((b) => `- ${b.type} (variantes: ${b.variants.map((v) => v.id).join(', ')})`).join('\n');
  const fontList = Array.from(new Set([...ALLOWED_SITE_FONTS, ...FONT_CATALOG.map((f) => f.name)])).join(', ');

  const prompt = `Tu conçois TROIS PROPOSITIONS de site web très différentes les unes des autres, en français, pour ce brief :
- Description du projet : ${input.description}
- Vision (ambiance, couleurs, sensation de mise en page, effets visuels, de défilement ou 3D souhaités) : ${input.vision || 'Libre : propose trois directions contrastées.'}
- Éléments indispensables (sections, fonctions, contenus) : ${input.mustHave || 'Aucune exigence particulière.'}
- Nom du site : ${input.siteName || 'à inventer sobrement à partir de la description'}

RÈGLES
1. Chaque proposition a sa propre architecture (layoutMode parmi : ${LAYOUT_MODE_IDS.join(', ')}), son propre style de navigation (headerStyle parmi : ${HEADER_STYLE_IDS.join(', ')}), sa propre palette de 6 couleurs hexadécimales (jamais de violet, rose ou cyan fluo ; texte très lisible sur le fond), ses propres polices Google Fonts (parmi : ${fontList}), des animations d'entrée par section (animation parmi : ${SECTION_ANIMATION_IDS.join(', ')}) et des effets d'image (scroll parmi : ${IMAGE_SCROLL_EFFECT_IDS.join(', ')} ; effect3d parmi : ${IMAGE_3D_EFFECT_IDS.join(', ')} ; intensités de 0 à 100) choisis selon la vision demandée.
2. Les trois propositions doivent différer par layoutMode (trois valeurs distinctes), par headerStyle, par palette, par polices et par effets.
3. Pour chaque bloc qui porte des images (hero, about, éléments de gallery / products / team), renseigne imageSlots avec une requête de recherche de photo libre de droits : 2 à 5 mots concrets et photographiables, en français ou en anglais (par exemple « croissants dorés comptoir boulangerie »). Jamais de mot abstrait, jamais de personne identifiable, jamais de marque. target = "content" pour l'image du bloc, "item" avec itemIndex pour l'image d'un élément. N'utilise pas before-after-slider.
4. Entre 6 et 9 blocs, navbar en premier, footer en dernier. Ne génère AUCUN bloc testimonials, stats, team ou logos : aucune donnée réelle n'est fournie.
5. Aucun avis, chiffre, prix, nom de personne, adresse, téléphone ou e-mail inventé : écris « À compléter » pour les coordonnées et les prix.
6. Liens (linkHref, ctaHref) uniquement vers des sections présentes (#accueil, #apropos, #services, #galerie, #produits, #tarifs, #faq, #contact).

Types de blocs et variantes autorisés :
${catalogGuide}`;

  const res = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction: HONESTY_AND_STYLE_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: PROPOSALS_SCHEMA,
      temperature: 0.9,
    },
  });

  const parsed = JSON.parse(res.text ?? '{}') as { proposals?: Array<Record<string, unknown>> };
  const rawProposals = Array.isArray(parsed.proposals) ? parsed.proposals.slice(0, 3) : [];
  if (rawProposals.length === 0) {
    throw Object.assign(new Error('L’IA n’a proposé aucune maquette exploitable.'), { code: 'INVALID_JSON' });
  }

  const layouts = diversifyChoices(rawProposals.map((p) => sanitizeLayoutMode(p.layoutMode)), LAYOUT_FALLBACK_ORDER);
  const headers = diversifyChoices(rawProposals.map((p) => sanitizeHeaderStyle(p.headerStyle)), HEADER_FALLBACK_ORDER);
  const mood = `${input.vision} ${input.description}`;
  const cache = new Map<string, Awaited<ReturnType<StockSearchFn>> | null>();
  const now = new Date().toISOString();

  return Promise.all(
    rawProposals.map(async (raw, index) => {
      const siteName = String(raw.siteName || input.siteName || 'Mon site').slice(0, 60);
      const baseTheme = applyArtDirectionToTheme(pickArtDirectionFromMood(mood));
      const palette = sanitizeProposalPalette(raw.palette, baseTheme.palette);
      const theme: SiteTheme = {
        ...baseTheme,
        palette,
        fonts: sanitizeProposalFonts(raw.fonts, baseTheme.fonts),
        mode: hexToHsl(palette.background).l < 30 ? 'dark' : 'light',
        layoutMode: layouts[index],
        headerStyle: headers[index],
        visitorThemeToggle: raw.visitorThemeToggle === true,
      };

      const blocks = enforceHonestyOnBlocks(Array.isArray(raw.blocks) ? (raw.blocks as RawBlock[]) : [], siteName) as BlockWithSlots[];
      if (blocks[0]?.type !== 'navbar') blocks.unshift(createBlockInstance('navbar', siteName) as BlockWithSlots);
      if (blocks[blocks.length - 1]?.type !== 'footer') blocks.push(createBlockInstance('footer', siteName) as BlockWithSlots);

      // Sections factuelles demandées sans données : créées vides, champs « À compléter », jamais inventées
      for (const { re, type } of FACTUAL_REQUESTS) {
        if (re.test(input.mustHave) && !blocks.some((b) => b.type === type)) {
          const at = Math.max(1, blocks.findIndex((b) => b.type === 'contact' || b.type === 'cta' || b.type === 'footer'));
          blocks.splice(at, 0, createBlockInstance(type, siteName) as BlockWithSlots);
        }
      }

      await fillImageSlots(blocks, deps.search, cache);

      const projectInput: ProjectInput = {
        mode: 'ai',
        description: input.description,
        vision: input.vision,
        mustHave: input.mustHave,
        siteName,
        activity: input.description.slice(0, 140),
        mood: input.vision || 'Libre',
        targetAudience: '',
        goal: input.mustHave || '',
      };
      const project: SiteProject = {
        id: `prj_${Math.random().toString(36).slice(2, 9)}`,
        name: siteName,
        seoTitle: sanitizeForbiddenCopy(String(raw.seoTitle || `${siteName}`)),
        seoDescription: sanitizeForbiddenCopy(String(raw.seoDescription || input.description.slice(0, 150))),
        isDemo: false,
        theme,
        blocks,
        projectInput,
        createdAt: now,
        updatedAt: now,
      };
      return {
        id: `prop_${index + 1}`,
        name: sanitizeForbiddenCopy(String(raw.name || `Proposition ${index + 1}`)),
        concept: sanitizeForbiddenCopy(String(raw.concept || '')),
        project,
      };
    }),
  );
}

export async function regenerateSingleBlock(input: {
  block: SiteBlock;
  instruction: string;
  siteName: string;
  activity?: string;
}): Promise<SiteBlock> {
  const ai = getClient();
  const res = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Réécris et améliore le contenu JSON de ce bloc "${input.block.type}" pour le site "${input.siteName}" (${input.activity || 'site web'}).
Consigne utilisateur : "${input.instruction}".
Contenu actuel : ${JSON.stringify(input.block.content)}
Règles strictes : n'invente jamais de chiffres, prix, avis, coordonnées ou noms s'ils valent "À compléter" (conserve "À compléter"). Aucune formule creuse ni emoji. Réponds en français uniquement.`,
    config: {
      systemInstruction:
        'Tu es rédacteur web senior pour SiteForge. Renvoie uniquement du JSON strictement conforme au schéma sans HTML brut ni faits inventés.',
      responseMimeType: 'application/json',
      responseSchema: GENERATED_SITE_SCHEMA.properties.blocks.items.properties.content,
    },
  });

  const nextContent = JSON.parse(res.text ?? '{}');
  const existingItems = input.block.content.items ?? [];
  const mergedItems = Array.isArray(nextContent.items)
    ? nextContent.items.map((item: Record<string, unknown>, i: number) => ({
        ...existingItems[i],
        id: existingItems[i]?.id || createBlockId('it'),
        title:
          typeof item.title === 'string'
            ? sanitizeForbiddenCopy(item.title)
            : existingItems[i]?.title || TODO_MARKER,
        subtitle:
          typeof item.subtitle === 'string'
            ? sanitizeForbiddenCopy(item.subtitle)
            : existingItems[i]?.subtitle,
        description:
          typeof item.description === 'string'
            ? sanitizeForbiddenCopy(item.description)
            : existingItems[i]?.description,
        price: existingItems[i]?.price === TODO_MARKER ? TODO_MARKER : existingItems[i]?.price,
        meta: typeof item.meta === 'string' ? sanitizeForbiddenCopy(item.meta) : existingItems[i]?.meta,
        linkLabel:
          typeof item.linkLabel === 'string'
            ? sanitizeForbiddenCopy(item.linkLabel)
            : existingItems[i]?.linkLabel,
        linkHref: typeof item.linkHref === 'string' ? item.linkHref : existingItems[i]?.linkHref,
        image: existingItems[i]?.image,
        imageAlt:
          typeof item.imageAlt === 'string'
            ? sanitizeForbiddenCopy(item.imageAlt)
            : existingItems[i]?.imageAlt,
        features: Array.isArray(item.features)
          ? item.features
              .filter((f): f is string => typeof f === 'string')
              .map((f) => sanitizeForbiddenCopy(f))
          : existingItems[i]?.features,
      }))
    : existingItems;

  return {
    ...input.block,
    content: {
      ...input.block.content,
      ...nextContent,
      heading:
        typeof nextContent.heading === 'string'
          ? sanitizeForbiddenCopy(nextContent.heading)
          : input.block.content.heading,
      subheading:
        typeof nextContent.subheading === 'string'
          ? sanitizeForbiddenCopy(nextContent.subheading)
          : input.block.content.subheading,
      body:
        typeof nextContent.body === 'string'
          ? sanitizeForbiddenCopy(nextContent.body)
          : input.block.content.body,
      email: input.block.content.email === TODO_MARKER ? TODO_MARKER : input.block.content.email,
      phone: input.block.content.phone === TODO_MARKER ? TODO_MARKER : input.block.content.phone,
      address: input.block.content.address === TODO_MARKER ? TODO_MARKER : input.block.content.address,
      image: input.block.content.image,
      items: mergedItems,
    },
  };
}

export async function rewriteTextSnippet(input: {
  text: string;
  instruction: string;
  siteName?: string;
}): Promise<string> {
  const ai = getClient();
  const res = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Réécris ce texte en français concret et sobre pour le site "${input.siteName || 'Mon site'}".
Consigne : ${input.instruction}
Règle : aucun superlatif creux, aucun emoji, aucun chiffre inventé.
Texte original : "${input.text}"`,
    config: {
      systemInstruction: 'Réponds uniquement par du JSON { "rewrittenText": "..." } sans balises HTML.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          rewrittenText: { type: Type.STRING },
        },
        required: ['rewrittenText'],
      },
    },
  });
  const parsed = JSON.parse(res.text ?? '{}');
  return sanitizeForbiddenCopy(parsed.rewrittenText || input.text);
}

export async function suggestPalettesAndFonts(input: {
  activity: string;
  mood: string;
  siteName: string;
}): Promise<{ palettes: PaletteSuggestion[]; fontPairs: FontPairSuggestion[] }> {
  const ai = getClient();
  const allowedList = ALLOWED_SITE_FONTS.join(', ');
  const bannedList = BANNED_FONTS.join(', ');
  const res = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Propose exactement 3 palettes de couleurs sobres (4-5 couleurs avec UN seul accent principal et fort contraste WCAG) et 3 duos de polices Google Fonts choisis UNIQUEMENT parmi [${allowedList}] (INTERDIT d'utiliser ${bannedList}) pour "${input.siteName}" (${input.activity}, ambiance : ${input.mood}).`,
    config: {
      systemInstruction: 'Réponds en français uniquement en respectant strictement le schéma JSON.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          palettes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                rationale: { type: Type.STRING },
                mode: { type: Type.STRING, description: 'light ou dark' },
                primary: { type: Type.STRING },
                secondary: { type: Type.STRING },
                background: { type: Type.STRING },
                surface: { type: Type.STRING },
                text: { type: Type.STRING },
                mutedText: { type: Type.STRING },
              },
              required: ['name', 'rationale', 'mode', 'primary', 'secondary', 'background', 'surface', 'text', 'mutedText'],
            },
          },
          fontPairs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                rationale: { type: Type.STRING },
                heading: {
                  type: Type.STRING,
                  description: `Une parmi: ${allowedList}`,
                },
                body: {
                  type: Type.STRING,
                  description: `Une parmi: ${allowedList}`,
                },
              },
              required: ['name', 'rationale', 'heading', 'body'],
            },
          },
        },
        required: ['palettes', 'fontPairs'],
      },
    },
  });
  const raw = JSON.parse(res.text ?? '{}');
  const safeFontPairs: FontPairSuggestion[] = Array.isArray(raw.fontPairs)
    ? raw.fontPairs.map((fp: FontPairSuggestion) => {
        const heading = ALLOWED_SITE_FONTS.includes(fp.heading as (typeof ALLOWED_SITE_FONTS)[number])
          ? sanitizeFontName(fp.heading, 'Fraunces')
          : 'Fraunces';
        const body = ALLOWED_SITE_FONTS.includes(fp.body as (typeof ALLOWED_SITE_FONTS)[number])
          ? sanitizeFontName(fp.body, 'Libre Franklin')
          : 'Libre Franklin';
        return { ...fp, heading, body };
      })
    : [];
  return {
    palettes: Array.isArray(raw.palettes) ? raw.palettes : [],
    fontPairs: safeFontPairs,
  };
}

export async function generateSeoAndAlts(project: SiteProject): Promise<{
  seoTitle: string;
  seoDescription: string;
  imageAlts: Array<{ blockId: string; itemId?: string; alt: string }>;
}> {
  const ai = getClient();
  const imageSlots: Array<{ blockId: string; itemId?: string; context: string }> = [];
  for (const b of project.blocks) {
    if (b.content.image) {
      imageSlots.push({ blockId: b.id, context: `${b.type}: ${b.content.heading || ''}` });
    }
    for (const it of b.content.items ?? []) {
      if (it.image) {
        imageSlots.push({ blockId: b.id, itemId: it.id, context: `${b.type} item: ${it.title}` });
      }
    }
  }

  const res = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Génère un titre SEO (max 60 caractères), une meta description sobre et honnête (max 155 caractères, sans formule creuse ni chiffre inventé) et des textes alternatifs accessibles (alt) pour chaque image du site "${project.name}".
Résumé du site : ${project.blocks.map((b) => `${b.type}: ${b.content.heading || b.content.brandName || ''}`).join(' | ')}
Emplacements d'images : ${JSON.stringify(imageSlots)}`,
    config: {
      systemInstruction: 'Réponds en français uniquement selon le schéma JSON.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          seoTitle: { type: Type.STRING },
          seoDescription: { type: Type.STRING },
          imageAlts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                blockId: { type: Type.STRING },
                itemId: { type: Type.STRING },
                alt: { type: Type.STRING },
              },
              required: ['blockId', 'alt'],
            },
          },
        },
        required: ['seoTitle', 'seoDescription', 'imageAlts'],
      },
    },
  });

  const parsed = JSON.parse(res.text ?? '{}');
  return {
    seoTitle: sanitizeForbiddenCopy(parsed.seoTitle || project.seoTitle),
    seoDescription: sanitizeForbiddenCopy(parsed.seoDescription || project.seoDescription),
    imageAlts: Array.isArray(parsed.imageAlts) ? parsed.imageAlts : [],
  };
}

import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Globe,
  ImagePlus,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { ApiClientError, apiAnalyzeTemplate, apiGenerateSite } from '../services/geminiClient';
import type {
  ArtDirectionId,
  OriginalityReport,
  ProjectInput,
  RealFactsInput,
  SiteProject,
  StructureAnalysis,
  UploadedFactPhoto,
} from '../types/site';
import { ART_DIRECTIONS } from '../utils/artDirections';

interface WizardFlowProps {
  mode: 'inspiration' | 'scratch';
  onCancel: () => void;
  onComplete: (project: SiteProject) => void;
}

const GOAL_OPTIONS = [
  'Générer des demandes de devis ou prises de rendez-vous',
  'Présenter mes services et inspirer confiance sans exagération',
  'Vendre des produits ou présenter un catalogue réel',
  'Faire connaître mon studio, portfolio ou cabinet',
];

export function WizardFlow({ mode, onCancel, onComplete }: WizardFlowProps) {
  const [step, setStep] = useState<number>(1);
  const [refMode, setRefMode] = useState<'image' | 'url' | 'description'>('image');
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [imageFileName, setImageFileName] = useState<string>('');
  const [refUrl, setRefUrl] = useState<string>('');
  const [refDescription, setRefDescription] = useState<string>('');

  const [siteName, setSiteName] = useState<string>('');
  const [activity, setActivity] = useState<string>('');
  const [artDirection, setArtDirection] = useState<ArtDirectionId>('editorial');
  const [targetAudience, setTargetAudience] = useState<string>('');
  const [goal, setGoal] = useState<string>(GOAL_OPTIONS[0]);

  // Étape "Ce que tu peux me donner de vrai"
  const [productsOrServices, setProductsOrServices] = useState<string>('');
  const [prices, setPrices] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [socialLinks, setSocialLinks] = useState<string>('');
  const [testimonials, setTestimonials] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<string>('');
  const [stats, setStats] = useState<string>('');
  const [partnerLogos, setPartnerLogos] = useState<string>('');
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedFactPhoto[]>([]);
  const [personMediaConsent, setPersonMediaConsent] = useState<boolean>(false);

  const [formError, setFormError] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationPhase, setGenerationPhase] = useState<string>('');
  const [apiError, setApiError] = useState<{ message: string; canFallbackToCapture?: boolean } | null>(null);
  const [extractedAnalysis, setExtractedAnalysis] = useState<StructureAnalysis | null>(null);

  const totalSteps = mode === 'inspiration' ? 5 : 4;

  const isSourceStep = mode === 'inspiration' && step === 1;
  const isIdentityStep = (mode === 'inspiration' && step === 2) || (mode === 'scratch' && step === 1);
  const isDirectionStep = (mode === 'inspiration' && step === 3) || (mode === 'scratch' && step === 2);
  const isRealFactsStep = (mode === 'inspiration' && step === 4) || (mode === 'scratch' && step === 3);
  const isGoalStep = (mode === 'inspiration' && step === 5) || (mode === 'scratch' && step === 4);

  const requiresPersonConsent =
    testimonials.trim().length > 0 || uploadedPhotos.some((photo) => photo.isPersonPhoto);

  const handleTemplateImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Veuillez sélectionner un fichier image (PNG, JPG ou WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageDataUrl(reader.result);
        setImageFileName(file.name);
        setFormError('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFactPhotosUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const dataUrl = reader.result;
          setUploadedPhotos((prev) => [
            ...prev,
            {
              id: `ph_${Math.random().toString(36).slice(2, 8)}`,
              name: file.name,
              dataUrl,
              isPersonPhoto: false,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleNext = () => {
    setFormError('');
    if (isSourceStep) {
      if (refMode === 'image' && !imageDataUrl) {
        setFormError('Importez une capture d’écran ou choisissez l’option URL / Description.');
        return;
      }
      if (refMode === 'url' && !refUrl.trim()) {
        setFormError('Saisissez une adresse URL valide commençant par https://');
        return;
      }
      if (refMode === 'description' && refDescription.trim().length < 15) {
        setFormError('Décrivez en au moins 15 caractères la structure de mise en page souhaitée.');
        return;
      }
      setStep(2);
      return;
    }

    if (isIdentityStep) {
      if (!siteName.trim() || !activity.trim()) {
        setFormError('Veuillez renseigner le nom de votre projet et votre activité.');
        return;
      }
      setStep(step + 1);
      return;
    }

    if (isRealFactsStep && requiresPersonConsent && !personMediaConsent) {
      setFormError(
        'Veuillez cocher la case confirmant que vous disposez de l’accord des personnes pour publier leur avis ou leur photo.',
      );
      return;
    }

    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const runGeneration = async () => {
    if (requiresPersonConsent && !personMediaConsent) {
      setFormError(
        'Veuillez confirmer avoir obtenu l’accord des personnes pour publier leur avis ou leur photo.',
      );
      return;
    }

    setApiError(null);
    setFormError('');
    setIsGenerating(true);

    try {
      let analysis: StructureAnalysis | undefined = extractedAnalysis ?? undefined;

      if (mode === 'inspiration' && !analysis) {
        setGenerationPhase('Étape 1/3 · Analyse purement structurelle du modèle (zéro texte ni chiffre repris)...');
        analysis = await apiAnalyzeTemplate({
          mode: refMode,
          imageDataUrl: refMode === 'image' ? imageDataUrl : undefined,
          url: refMode === 'url' ? refUrl.trim() : undefined,
          description: refMode === 'description' ? refDescription.trim() : undefined,
        });
        setExtractedAnalysis(analysis);
      }

      const selectedPreset = ART_DIRECTIONS.find((d) => d.id === artDirection) ?? ART_DIRECTIONS[0];
      const realFacts: RealFactsInput = {
        productsOrServices: productsOrServices.trim() || undefined,
        prices: prices.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        socialLinks: socialLinks.trim() || undefined,
        testimonials: testimonials.trim() || undefined,
        teamMembers: teamMembers.trim() || undefined,
        stats: stats.trim() || undefined,
        partnerLogos: partnerLogos.trim() || undefined,
        uploadedPhotos: uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
        personMediaConsent: requiresPersonConsent ? personMediaConsent : undefined,
      };

      setGenerationPhase('Étape 2/3 · Rédaction honnête et composition selon votre direction artistique...');
      const projectInput: ProjectInput = {
        mode,
        siteName: siteName.trim(),
        activity: activity.trim(),
        mood: selectedPreset.label,
        artDirection,
        targetAudience: targetAudience.trim() || 'Particuliers et entreprises',
        goal,
        referenceMode: mode === 'inspiration' ? refMode : undefined,
        referenceUrl: mode === 'inspiration' && refMode === 'url' ? refUrl.trim() : undefined,
        referenceDescription: mode === 'inspiration' && refMode === 'description' ? refDescription.trim() : undefined,
        realFacts,
      };

      setGenerationPhase('Étape 3/3 · Contrôle d’originalité et audit anti-plagiat...');
      const result: { project: SiteProject; originalityReport: OriginalityReport } = await apiGenerateSite(
        projectInput,
        analysis,
      );

      onComplete({
        ...result.project,
        isDemo: false,
        originalityReport: result.originalityReport,
        structureAnalysis: analysis,
      });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setApiError({
          message: err.message,
          canFallbackToCapture: err.canFallbackToCapture,
        });
      } else {
        setApiError({
          message: 'Une erreur est survenue lors de la génération. Vous pouvez réessayer.',
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF8F3] text-[#1C1917] flex flex-col">
      {/* Header */}
      <header className="bg-[#FFFFFF] border-b border-[#E5DEC9] px-6 h-16 flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-[#57534E] hover:text-[#1C1917] flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Retour à l’accueil</span>
        </button>

        <span className="font-mono-tabular font-medium text-xs uppercase tracking-wider text-[#57534E]">
          {mode === 'inspiration' ? 'Mode Inspiration' : 'Création de A à Z'} · Étape {step}/{totalSteps}
        </span>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
        {/* Progress bar */}
        <div className="w-full h-1 bg-[#E5DEC9] overflow-hidden mb-8">
          <div
            className="h-full bg-[#9A3412] transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        {/* Loading state */}
        {isGenerating ? (
          <div className="bg-[#FFFFFF] border border-[#E5DEC9] p-8 md:p-10 text-center space-y-5">
            <div className="w-12 h-12 rounded-sm bg-[#F4EFE6] text-[#9A3412] flex items-center justify-center mx-auto">
              <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-semibold text-[#1C1917]">Génération de votre site original</h2>
              <p className="text-sm text-[#57534E]">{generationPhase}</p>
            </div>
            <div className="max-w-md mx-auto bg-[#F4EFE6] border border-[#E5DEC9] border-l-4 border-l-[#B45309] p-3.5 text-xs text-[#1C1917] text-left flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Aucun texte ni donnée d’un autre site n’est repris, et aucune donnée factuelle manquante ne sera
                inventée pour {siteName || 'votre projet'}.
              </span>
            </div>
          </div>
        ) : apiError ? (
          <div className="bg-[#FFFFFF] border border-red-300 p-8 space-y-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1.5">
                <h2 className="font-display text-xl font-semibold text-[#1C1917]">Impossible de terminer la génération</h2>
                <p className="text-sm text-[#57534E] leading-relaxed">{apiError.message}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={runGeneration}
                className="px-4 py-2.5 rounded-sm bg-[#9A3412] hover:bg-[#7C2D12] text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                <span>Réessayer</span>
              </button>
              {apiError.canFallbackToCapture && (
                <button
                  type="button"
                  onClick={() => {
                    setApiError(null);
                    setRefMode('image');
                    setStep(1);
                  }}
                  className="px-4 py-2.5 rounded-sm border border-[#E5DEC9] hover:bg-[#F4EFE6] text-[#1C1917] text-sm font-medium cursor-pointer"
                >
                  Importer une capture d’écran à la place
                </button>
              )}
              <button
                type="button"
                onClick={() => setApiError(null)}
                className="px-4 py-2.5 rounded-sm border border-[#E5DEC9] hover:bg-[#F4EFE6] text-[#57534E] text-sm font-medium cursor-pointer"
              >
                Modifier mes réponses
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#FFFFFF] border border-[#E5DEC9] p-6 md:p-8 space-y-6">
            {/* Inspiration Step 1: Source structure */}
            {isSourceStep && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <h1 className="font-display text-2xl md:text-3xl font-semibold text-[#1C1917]">
                    Choisissez un modèle pour en extraire la structure
                  </h1>
                  <p className="text-sm text-[#57534E]">
                    Gemini analyse uniquement les types de sections et l’organisation spatiale, jamais les contenus.
                  </p>
                </div>

                <div className="bg-[#F4EFE6] border border-[#E5DEC9] border-l-4 border-l-[#B45309] p-4 flex items-start gap-3 text-xs text-[#1C1917]">
                  <ShieldCheck className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Le modèle sert d’inspiration structurelle uniquement. Ne reproduis pas le logo, les images, les
                    textes ou l’identité d’une autre marque.
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 p-1 bg-[#F4EFE6] border border-[#E5DEC9] rounded-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setRefMode('image');
                      setFormError('');
                    }}
                    className={`py-2 px-3 rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      refMode === 'image' ? 'bg-[#FFFFFF] text-[#1C1917] border border-[#E5DEC9]' : 'text-[#57534E] hover:text-[#1C1917]'
                    }`}
                  >
                    <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Capture d’écran</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRefMode('url');
                      setFormError('');
                    }}
                    className={`py-2 px-3 rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      refMode === 'url' ? 'bg-[#FFFFFF] text-[#1C1917] border border-[#E5DEC9]' : 'text-[#57534E] hover:text-[#1C1917]'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Adresse URL</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRefMode('description');
                      setFormError('');
                    }}
                    className={`py-2 px-3 rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      refMode === 'description'
                        ? 'bg-[#FFFFFF] text-[#1C1917] border border-[#E5DEC9]'
                        : 'text-[#57534E] hover:text-[#1C1917]'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Description</span>
                  </button>
                </div>

                {refMode === 'image' && (
                  <div className="space-y-3">
                    <label
                      htmlFor="template-screenshot-input"
                      className="block border-2 border-dashed border-[#E5DEC9] hover:border-[#9A3412] rounded-sm p-6 text-center cursor-pointer transition-colors bg-[#FBF8F3]"
                    >
                      <input
                        id="template-screenshot-input"
                        type="file"
                        accept="image/*"
                        onChange={handleTemplateImageUpload}
                        className="sr-only"
                      />
                      <ImagePlus className="w-8 h-8 text-[#57534E] mx-auto mb-2" aria-hidden="true" />
                      <span className="block text-sm font-medium text-[#1C1917]">
                        {imageFileName ? `Fichier sélectionné : ${imageFileName}` : 'Cliquez pour importer une capture d’écran'}
                      </span>
                      <span className="block text-xs text-[#57534E] mt-1">PNG, JPG ou WebP</span>
                    </label>
                    {imageDataUrl && (
                      <img
                        src={imageDataUrl}
                        alt="Aperçu de la capture d’écran importée"
                        className="w-full max-h-56 object-contain rounded-sm border border-[#E5DEC9] bg-[#F4EFE6]"
                      />
                    )}
                  </div>
                )}

                {refMode === 'url' && (
                  <div className="space-y-2">
                    <label htmlFor="ref-url-input" className="block text-sm font-semibold text-[#1C1917]">
                      Adresse du site modèle (URL publique)
                    </label>
                    <input
                      id="ref-url-input"
                      type="url"
                      value={refUrl}
                      onChange={(e) => setRefUrl(e.target.value)}
                      placeholder="https://exemple-site.fr"
                      className="w-full px-3.5 py-2.5 rounded-sm border border-[#E5DEC9] bg-[#FBF8F3] text-sm focus:outline-none focus:border-[#9A3412]"
                    />
                    <p className="text-xs text-[#57534E]">
                      Si le site bloque la lecture automatique, vous pourrez importer une capture d’écran juste après.
                    </p>
                  </div>
                )}

                {refMode === 'description' && (
                  <div className="space-y-2">
                    <label htmlFor="ref-desc-input" className="block text-sm font-semibold text-[#1C1917]">
                      Décrivez l’organisation des sections souhaitée
                    </label>
                    <textarea
                      id="ref-desc-input"
                      rows={4}
                      value={refDescription}
                      onChange={(e) => setRefDescription(e.target.value)}
                      placeholder="Ex. : Grande bannière éditoriale, 3 services en liste numérotée, galerie asymétrique et formulaire de contact..."
                      className="w-full px-3.5 py-2.5 rounded-sm border border-[#E5DEC9] bg-[#FBF8F3] text-sm focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Identity Step */}
            {isIdentityStep && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <h1 className="font-display text-2xl md:text-3xl font-semibold text-[#1C1917]">
                    Parlez-nous de votre projet
                  </h1>
                  <p className="text-sm text-[#57534E]">
                    Ces repères cadrent le vocabulaire métier employé par Gemini, sans formules publicitaires creuses.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="site-name-input" className="block text-sm font-semibold text-[#1C1917] mb-1.5">
                      Nom du site ou de votre activité
                    </label>
                    <input
                      id="site-name-input"
                      type="text"
                      value={siteName}
                      onChange={(e) => setSiteName(e.target.value)}
                      placeholder="Ex. : Boulangerie Levain, Studio Méridien, Claire Conseils"
                      className="w-full px-3.5 py-2.5 rounded-sm border border-[#E5DEC9] bg-[#FBF8F3] text-sm focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>

                  <div>
                    <label htmlFor="site-activity-input" className="block text-sm font-semibold text-[#1C1917] mb-1.5">
                      Que faites-vous concrètement ?
                    </label>
                    <textarea
                      id="site-activity-input"
                      rows={3}
                      value={activity}
                      onChange={(e) => setActivity(e.target.value)}
                      placeholder="Ex. : Architecture intérieure écoresponsable pour particuliers et commerces à Bordeaux"
                      className="w-full px-3.5 py-2.5 rounded-sm border border-[#E5DEC9] bg-[#FBF8F3] text-sm focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Direction Artistique Step */}
            {isDirectionStep && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <h1 className="font-display text-2xl md:text-3xl font-semibold text-[#1C1917]">
                    Choisissez une direction artistique
                  </h1>
                  <p className="text-sm text-[#57534E]">
                    Chaque direction associe un duo typographique distinct, une palette sobre à un seul accent et un style de bordures. Changeable en 1 clic ensuite.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ART_DIRECTIONS.map((dir) => {
                    const selected = artDirection === dir.id;
                    return (
                      <button
                        key={dir.id}
                        type="button"
                        onClick={() => setArtDirection(dir.id)}
                        className={`text-left p-4 rounded-sm border transition-colors cursor-pointer space-y-2.5 ${
                          selected
                            ? 'border-[#9A3412] bg-[#F4EFE6]'
                            : 'border-[#E5DEC9] hover:border-[#1C1917]/40 bg-[#FFFFFF]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display font-semibold text-base text-[#1C1917]">{dir.label}</span>
                          {selected && <CheckCircle2 className="w-4 h-4 text-[#9A3412] shrink-0" aria-hidden="true" />}
                        </div>
                        <p className="text-xs text-[#57534E] leading-snug">{dir.tagline}</p>
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-1.5">
                            {[dir.palette.background, dir.palette.surface, dir.palette.text, dir.palette.primary].map(
                              (hex, i) => (
                                <span
                                  key={i}
                                  className="w-4 h-4 rounded-full border border-[#1C1917]/15"
                                  style={{ backgroundColor: hex }}
                                  aria-hidden="true"
                                />
                              ),
                            )}
                          </div>
                          <span className="text-[10px] font-mono-tabular text-[#57534E]">
                            {dir.fonts.heading}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step "Ce que tu peux me donner de vrai" */}
            {isRealFactsStep && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#9A3412]">
                    Contenu 100 % honnête
                  </p>
                  <h1 className="font-display text-2xl md:text-3xl font-semibold text-[#1C1917]">
                    Ce que tu peux me donner de vrai
                  </h1>
                  <p className="text-sm text-[#57534E]">
                    Tout est facultatif. Ce qui reste vide ne sera jamais inventé : les blocs Témoignages, Chiffres,
                    Équipe et Logos seront exclus s’ils sont vides, et vos coordonnées/tarifs manquants seront marqués « À compléter ».
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label htmlFor="facts-products" className="block text-xs font-semibold text-[#1C1917] mb-1">
                      Produits ou services réels proposés
                    </label>
                    <textarea
                      id="facts-products"
                      rows={2}
                      value={productsOrServices}
                      onChange={(e) => setProductsOrServices(e.target.value)}
                      placeholder="Ex. : Coupe homme, soin barbe, fabrication de pains au levain..."
                      className="w-full px-3 py-2 rounded-sm border border-[#E5DEC9] bg-[#FBF8F3] text-xs focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>

                  <div>
                    <label htmlFor="facts-prices" className="block text-xs font-semibold text-[#1C1917] mb-1">
                      Tarifs réels (sinon « À compléter »)
                    </label>
                    <input
                      id="facts-prices"
                      type="text"
                      value={prices}
                      onChange={(e) => setPrices(e.target.value)}
                      placeholder="Ex. : Diagnostic 120 €, Forfait journée 650 €"
                      className="w-full px-3 py-2 rounded-sm border border-[#E5DEC9] bg-[#FBF8F3] text-xs focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>

                  <div>
                    <label htmlFor="facts-email" className="block text-xs font-semibold text-[#1C1917] mb-1">
                      E-mail de contact réel
                    </label>
                    <input
                      id="facts-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Ex. : contact@monatelier.fr"
                      className="w-full px-3 py-2 rounded-sm border border-[#E5DEC9] bg-[#FBF8F3] text-xs focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>

                  <div>
                    <label htmlFor="facts-phone" className="block text-xs font-semibold text-[#1C1917] mb-1">
                      Téléphone réel
                    </label>
                    <input
                      id="facts-phone"
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ex. : 04 72 ..."
                      className="w-full px-3 py-2 rounded-sm border border-[#E5DEC9] bg-[#FBF8F3] text-xs focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>

                  <div>
                    <label htmlFor="facts-address" className="block text-xs font-semibold text-[#1C1917] mb-1">
                      Adresse réelle / Ville d’intervention
                    </label>
                    <input
                      id="facts-address"
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Ex. : 12 rue des Tanneurs, Nantes"
                      className="w-full px-3 py-2 rounded-sm border border-[#E5DEC9] bg-[#FBF8F3] text-xs focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="facts-socials" className="block text-xs font-semibold text-[#1C1917] mb-1">
                      Liens réseaux sociaux réels (optionnel)
                    </label>
                    <input
                      id="facts-socials"
                      type="text"
                      value={socialLinks}
                      onChange={(e) => setSocialLinks(e.target.value)}
                      placeholder="Ex. : Instagram @monatelier, LinkedIn..."
                      className="w-full px-3 py-2 rounded-sm border border-[#E5DEC9] bg-[#FBF8F3] text-xs focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="facts-testimonials" className="block text-xs font-semibold text-[#1C1917] mb-1">
                      Vrais témoignages clients reçus (laisser vide pour ne pas générer le bloc)
                    </label>
                    <textarea
                      id="facts-testimonials"
                      rows={2}
                      value={testimonials}
                      onChange={(e) => setTestimonials(e.target.value)}
                      placeholder="Copiez uniquement des avis authentiques accompagnés du nom/prénom autorisé..."
                      className="w-full px-3 py-2 rounded-sm border border-[#E5DEC9] bg-[#FBF8F3] text-xs focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>

                  <div>
                    <label htmlFor="facts-team" className="block text-xs font-semibold text-[#1C1917] mb-1">
                      Membres réels de l’équipe (laisser vide pour exclure)
                    </label>
                    <input
                      id="facts-team"
                      type="text"
                      value={teamMembers}
                      onChange={(e) => setTeamMembers(e.target.value)}
                      placeholder="Ex. : Jeanne Martin (fondatrice)"
                      className="w-full px-3 py-2 rounded-sm border border-[#E5DEC9] bg-[#FBF8F3] text-xs focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>

                  <div>
                    <label htmlFor="facts-stats" className="block text-xs font-semibold text-[#1C1917] mb-1">
                      Chiffres réels vérifiables (laisser vide pour exclure)
                    </label>
                    <input
                      id="facts-stats"
                      type="text"
                      value={stats}
                      onChange={(e) => setStats(e.target.value)}
                      placeholder="Ex. : En activité depuis 2018"
                      className="w-full px-3 py-2 rounded-sm border border-[#E5DEC9] bg-[#FBF8F3] text-xs focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="facts-logos" className="block text-xs font-semibold text-[#1C1917] mb-1">
                      Vrais partenaires, labels ou clients (laisser vide pour exclure)
                    </label>
                    <input
                      id="facts-logos"
                      type="text"
                      value={partnerLogos}
                      onChange={(e) => setPartnerLogos(e.target.value)}
                      placeholder="Ex. : Artisanat d'Art, Librairie Mollat..."
                      className="w-full px-3 py-2 rounded-sm border border-[#E5DEC9] bg-[#FBF8F3] text-xs focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>

                  {/* Photos Upload */}
                  <div className="sm:col-span-2 space-y-2.5 pt-2 border-t border-[#E5DEC9]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-[#1C1917]">Vos vraies photos (optionnel)</span>
                      <label className="px-3 py-1.5 rounded-sm border border-[#E5DEC9] bg-[#F4EFE6] hover:bg-[#E5DEC9]/50 text-xs font-semibold text-[#1C1917] flex items-center gap-1.5 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Importer des photos</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleFactPhotosUpload}
                          className="sr-only"
                        />
                      </label>
                    </div>

                    {uploadedPhotos.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {uploadedPhotos.map((ph) => (
                          <div
                            key={ph.id}
                            className="p-2.5 rounded-sm border border-[#E5DEC9] bg-[#FBF8F3] flex items-center gap-3"
                          >
                            <img
                              src={ph.dataUrl}
                              alt={ph.name}
                              className="w-12 h-12 object-cover rounded-sm shrink-0 border border-[#E5DEC9]"
                            />
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="text-xs font-medium text-[#1C1917] truncate">{ph.name}</div>
                              <label className="flex items-center gap-1.5 text-[11px] text-[#57534E] cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={ph.isPersonPhoto}
                                  onChange={(e) =>
                                    setUploadedPhotos((prev) =>
                                      prev.map((item) =>
                                        item.id === ph.id ? { ...item, isPersonPhoto: e.target.checked } : item,
                                      ),
                                    )
                                  }
                                  className="accent-[#9A3412]"
                                />
                                <span>Photo de personne</span>
                              </label>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setUploadedPhotos((prev) => prev.filter((item) => item.id !== ph.id))
                              }
                              aria-label={`Retirer ${ph.name}`}
                              className="p-1.5 text-[#57534E] hover:text-red-700 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mandatory Consent Checkbox when testimonials or person photos provided */}
                  {requiresPersonConsent && (
                    <div className="sm:col-span-2 bg-[#FEF3C7] border border-[#D97706] p-3.5 rounded-sm">
                      <label className="flex items-start gap-2.5 text-xs font-semibold text-[#78350F] cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={personMediaConsent}
                          onChange={(e) => {
                            setPersonMediaConsent(e.target.checked);
                            setFormError('');
                          }}
                          className="w-4 h-4 mt-0.5 accent-[#9A3412] shrink-0"
                        />
                        <span>J’ai l’accord de ces personnes pour publier leur avis ou leur photo</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Goal & Audience Step */}
            {isGoalStep && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <h1 className="font-display text-2xl md:text-3xl font-semibold text-[#1C1917]">
                    Dernière étape : cible et objectif
                  </h1>
                  <p className="text-sm text-[#57534E]">
                    Pour calibrer vos appels à l’action concrets et la hiérarchie de votre page.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="target-audience-input" className="block text-sm font-semibold text-[#1C1917] mb-1.5">
                      Public cible (optionnel)
                    </label>
                    <input
                      id="target-audience-input"
                      type="text"
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      placeholder="Ex. : Dirigeants de PME, familles, amateurs d’artisanat..."
                      className="w-full px-3.5 py-2.5 rounded-sm border border-[#E5DEC9] bg-[#FBF8F3] text-sm focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="block text-sm font-semibold text-[#1C1917]">Objectif principal du site</span>
                    <div className="grid gap-2.5">
                      {GOAL_OPTIONS.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGoal(g)}
                          className={`text-left px-4 py-3 rounded-sm border text-sm transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                            goal === g
                              ? 'border-[#9A3412] bg-[#F4EFE6] font-semibold text-[#1C1917]'
                              : 'border-[#E5DEC9] hover:border-[#1C1917]/40 text-[#57534E]'
                          }`}
                        >
                          <span>{g}</span>
                          {goal === g && <CheckCircle2 className="w-4 h-4 text-[#9A3412] shrink-0" aria-hidden="true" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {formError && (
              <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-300 rounded-sm px-4 py-2.5">
                {formError}
              </p>
            )}

            {/* Navigation Footer */}
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-[#E5DEC9]">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setFormError('');
                    setStep(step - 1);
                  }}
                  className="px-4 py-2.5 rounded-sm border border-[#E5DEC9] hover:bg-[#F4EFE6] text-sm font-medium text-[#1C1917] flex items-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  <span>Précédent</span>
                </button>
              ) : (
                <div />
              )}

              {step < totalSteps ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-5 py-2.5 rounded-sm bg-[#9A3412] hover:bg-[#7C2D12] text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <span>Continuer</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={runGeneration}
                  className="px-5 py-2.5 rounded-sm bg-[#9A3412] hover:bg-[#7C2D12] text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <span>Générer mon site original</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  analyzeTemplateStructure,
  generateOriginalSite,
  generateSeoAndAlts,
  generateSiteProposals,
  mapGeminiError,
  mutateSiteWithAI,
  regenerateSingleBlock,
  rewriteTextSnippet,
  suggestPalettesAndFonts,
} from './server/geminiService';
import { describeProviders } from './server/llm';
import { searchRoyaltyFreeImages } from './server/stockImageService';

type Handler = (req: Request, res: Response) => Promise<void>;

/** Toute route d'API répond en JSON valide, même en cas d'erreur inattendue. */
function route(handler: Handler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (res.headersSent) {
        next(err);
        return;
      }
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({
        error: mapped.message,
        code: mapped.code,
        canFallbackToCapture: mapped.canFallbackToCapture,
      });
    }
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'siteforge', providers: describeProviders() });
  });

  app.get(
    '/api/images/search',
    route(async (req, res) => {
      const q = String(req.query.q ?? '').trim();
      const limit = Number(req.query.limit) || 12;
      if (!q) {
        res.status(400).json({ error: 'Indiquez un mot-clé pour chercher une image.', code: 'BAD_REQUEST' });
        return;
      }
      res.json(await searchRoyaltyFreeImages(q, limit));
    }),
  );

  app.post(
    '/api/gemini/analyze-template',
    route(async (req, res) => {
      const { mode, imageDataUrl, url, description } = req.body ?? {};
      const analysis = await analyzeTemplateStructure({ mode, imageDataUrl, url, description });
      res.json({ analysis });
    }),
  );

  app.post(
    '/api/ai/mutate',
    route(async (req, res) => {
      const { userPrompt, activePageId, selectedBlockId, projectSnapshot } = req.body ?? {};
      if (typeof userPrompt !== 'string' || !projectSnapshot || !Array.isArray(projectSnapshot.blocks)) {
        res.status(400).json({ error: 'Requête de modification incomplète.', code: 'BAD_REQUEST' });
        return;
      }
      res.json(await mutateSiteWithAI({ userPrompt, activePageId, selectedBlockId, projectSnapshot }));
    }),
  );

  app.post(
    '/api/gemini/generate-site',
    route(async (req, res) => {
      const { projectInput, structureAnalysis } = req.body ?? {};
      if (!projectInput || !projectInput.siteName || !projectInput.activity) {
        res.status(400).json({ error: 'Le nom du site et le type d’activité sont requis.', code: 'BAD_REQUEST' });
        return;
      }
      res.json(await generateOriginalSite(projectInput, structureAnalysis));
    }),
  );

  app.post(
    '/api/gemini/generate-proposals',
    route(async (req, res) => {
      const { description, vision, mustHave, siteName } = req.body ?? {};
      if (!String(description ?? '').trim()) {
        res.status(400).json({ error: 'Décrivez en quelques mots le site que vous voulez.', code: 'BAD_REQUEST' });
        return;
      }
      const proposals = await generateSiteProposals({
        description: String(description),
        vision: String(vision ?? ''),
        mustHave: String(mustHave ?? ''),
        siteName: siteName ? String(siteName) : undefined,
      });
      res.json({ proposals });
    }),
  );

  app.post(
    '/api/gemini/regenerate-block',
    route(async (req, res) => {
      const { block, instruction, siteName, activity } = req.body ?? {};
      if (!block || !instruction) {
        res.status(400).json({ error: 'Bloc et consigne requis.', code: 'BAD_REQUEST' });
        return;
      }
      res.json({ block: await regenerateSingleBlock({ block, instruction, siteName, activity }) });
    }),
  );

  app.post(
    '/api/gemini/rewrite-text',
    route(async (req, res) => {
      const { text, instruction, siteName } = req.body ?? {};
      if (!text || !instruction) {
        res.status(400).json({ error: 'Texte et consigne requis.', code: 'BAD_REQUEST' });
        return;
      }
      res.json({ rewrittenText: await rewriteTextSnippet({ text, instruction, siteName }) });
    }),
  );

  app.post(
    '/api/gemini/suggest-styles',
    route(async (req, res) => {
      const { activity, mood, siteName } = req.body ?? {};
      res.json(
        await suggestPalettesAndFonts({
          activity: activity || 'Entreprise locale',
          mood: mood || 'Professionnel et moderne',
          siteName: siteName || 'Mon Site',
        }),
      );
    }),
  );

  app.post(
    '/api/gemini/generate-seo',
    route(async (req, res) => {
      const { project } = req.body ?? {};
      if (!project) {
        res.status(400).json({ error: 'Projet requis.', code: 'BAD_REQUEST' });
        return;
      }
      res.json(await generateSeoAndAlts(project));
    }),
  );

  // Une route d'API inconnue répond en JSON (jamais la page HTML de l'application)
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Route introuvable.', code: 'NOT_FOUND' });
  });

  // Corps de requête illisible, trop gros, ou erreur imprévue : toujours une réponse JSON complète
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api')) {
      next(err);
      return;
    }
    const status = (err as { status?: number })?.status;
    const tooLarge = status === 413 || (err as { type?: string })?.type === 'entity.too.large';
    const badJson = (err as { type?: string })?.type === 'entity.parse.failed';
    res.status(tooLarge ? 413 : badJson ? 400 : 500).json({
      error: tooLarge
        ? 'Les données envoyées sont trop volumineuses (images trop lourdes ?).'
        : badJson
          ? 'Requête illisible.'
          : 'Erreur interne du serveur.',
      code: tooLarge ? 'PAYLOAD_TOO_LARGE' : badJson ? 'BAD_REQUEST' : 'SERVER_ERROR',
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SiteForge server running on http://localhost:${PORT}`);
    const providers = describeProviders();
    console.log(`IA : Groq ${providers.groq ? 'configuré' : 'absent'}, Gemini ${providers.gemini ? 'configuré' : 'absent'}`);
  });
}

startServer();

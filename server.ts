import { searchRoyaltyFreeImages } from './server/stockImageService';
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  analyzeTemplateStructure,
  generateIllustrationSpec,
  generateOriginalSite,
  generateSeoAndAlts,
  mapGeminiError,
  regenerateSingleBlock,
  rewriteTextSnippet,
  suggestPalettesAndFonts,
} from './server/geminiService';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'siteforge' });
  });

  app.post('/api/gemini/analyze-template', async (req, res) => {
    try {
      const { mode, imageDataUrl, url, description } = req.body ?? {};
      const analysis = await analyzeTemplateStructure({ mode, imageDataUrl, url, description });
      res.json({ analysis });
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({
        error: mapped.message,
        code: mapped.code,
        canFallbackToCapture: mapped.canFallbackToCapture,
      });
    }
  });

  app.post('/api/gemini/generate-site', async (req, res) => {
    try {
      const { projectInput, structureAnalysis } = req.body ?? {};
      if (!projectInput || !projectInput.siteName || !projectInput.activity) {
        res.status(400).json({ error: 'Le nom du site et le type d’activité sont requis.' });
        return;
      }
      const result = await generateOriginalSite(projectInput, structureAnalysis);
      res.json(result);
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  app.post('/api/gemini/regenerate-block', async (req, res) => {
    try {
      const { block, instruction, siteName, activity } = req.body ?? {};
      if (!block || !instruction) {
        res.status(400).json({ error: 'Bloc et consigne requis.' });
        return;
      }
      const updatedBlock = await regenerateSingleBlock({ block, instruction, siteName, activity });
      res.json({ block: updatedBlock });
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  app.post('/api/gemini/rewrite-text', async (req, res) => {
    try {
      const { text, instruction, siteName } = req.body ?? {};
      if (!text || !instruction) {
        res.status(400).json({ error: 'Texte et consigne requis.' });
        return;
      }
      const rewrittenText = await rewriteTextSnippet({ text, instruction, siteName });
      res.json({ rewrittenText });
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  app.post('/api/gemini/suggest-styles', async (req, res) => {
    try {
      const { activity, mood, siteName } = req.body ?? {};
      const suggestions = await suggestPalettesAndFonts({
        activity: activity || 'Entreprise locale',
        mood: mood || 'Professionnel et moderne',
        siteName: siteName || 'Mon Site',
      });
      res.json(suggestions);
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  app.post('/api/gemini/generate-seo', async (req, res) => {
    try {
      const { project } = req.body ?? {};
      if (!project) {
        res.status(400).json({ error: 'Projet requis.' });
        return;
      }
      const seo = await generateSeoAndAlts(project);
      res.json(seo);
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  app.post('/api/gemini/generate-illustration', async (req, res) => {
    try {
      const { prompt, primaryColor, secondaryColor } = req.body ?? {};
      if (!prompt) {
        res.status(400).json({ error: 'Description de l’illustration requise.' });
        return;
      }
      const spec = await generateIllustrationSpec({
        prompt,
        primaryColor: primaryColor || '#1E40AF',
        secondaryColor: secondaryColor || '#0F766E',
      });
      res.json({ spec });
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
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

  
app.get('/api/images/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(24, Math.max(4, Number(req.query.limit) || 12));
    const images = await searchRoyaltyFreeImages(q || 'modern workspace', limit);
    res.json({ images });
  } catch (err) {
    res.status(500).json({ message: 'Impossible de rechercher dans la bibliothèque libre de droits.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`SiteForge server running on http://localhost:${PORT}`);
  });
}

startServer();

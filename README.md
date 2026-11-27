# SiteForge

Créateur de sites web par blocs, avec trois façons de commencer : page vierge, inspiration d'une référence (structure et effets, images vides), ou trois propositions générées par l'IA.

## Lancer

```
npm install --legacy-peer-deps
npm run dev      # http://localhost:3000
npm test         # 45 tests
npm run build
```

Le fichier `.env` contient les clés (jamais publié : il est dans `.gitignore`). Modèle de configuration : `.env.example`.
- `GROQ_API_KEY` : rédaction (openai/gpt-oss-120b, puis qwen/qwen3-32b). Reprise automatique sur 429 et 503.
- `GEMINI_API_KEY` : secours, et seule option pour analyser une image ou une URL de référence.

## Règles du projet
- Aucune image générée par l'IA, aucune illustration générée, aucune image de banque embarquée. Les photos viennent de l'import, d'un lien, ou de la recherche libre de droits (Openverse, Wikimedia Commons), avec auteur et licence affichés dans les crédits du site.
- Aucun avis, chiffre, prix, nom ou coordonnée inventé : les champs factuels restent « À compléter ».
- L'IA peut se tromper : la mention est affichée près de chaque fonction d'IA.

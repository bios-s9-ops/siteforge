# Modifications : sites exportés réellement utilisables

## Problèmes constatés dans la version d'origine
- Le formulaire de contact n'envoyait rien : il affichait « votre message a bien été préparé » sans transmettre quoi que ce soit.
- Sur mobile, le menu de navigation disparaissait (aucun bouton de menu).
- Les liens générés pouvaient pointer vers des sections absentes de la page (liens morts), et deux blocs du même type recevaient le même id.
- L'aperçu de l'éditeur n'était pas cliquable ; aucun moyen de tester le vrai site.
- Les coordonnées (e-mail, téléphone, adresse) n'étaient pas cliquables et « À compléter » pouvait s'afficher au public.
- Le fichier HTML unique contenait des images /src/assets/... qui n'existent plus une fois le fichier ouvert ailleurs.
- Aucun fichier utile à la mise en ligne (favicon, robots.txt, sitemap, guide).

## Ce qui a été ajouté
- Réception réelle des messages : FormSubmit, Web3Forms, Formspree, Netlify Forms, messagerie du visiteur (mailto) ou WhatsApp. Aucun faux succès : « envoyé » n'est affiché que si le service a répondu OK, sinon erreur claire avec coordonnées de secours.
- Variante « Demande de devis » du bloc contact (service concerné issu des vrais services du site, budget, délai).
- Anti-spam (champ piège), case de consentement, boutons « Demander ce produit / cette offre » qui préremplissent le devis.
- Menu mobile (bouton, fermeture au clic et à Échap), décalage d'ancre sous l'en-tête fixe, focus visible, mouvement réduit respecté.
- Liens vérifiés à l'export (alias comme #realisations → galerie, liens vides retirés), ids uniques, liens externes sécurisés, e-mail/téléphone/adresse cliquables, bouton WhatsApp, réseaux sociaux du pied de page (seulement ceux fournis).
- Onglet « Publier » (réception des messages, WhatsApp, adresse du site, contrôle avant mise en ligne) et bouton « Tester le site » (le vrai HTML exporté, en mode test sans envoi réel par défaut).
- Export complet : favicon.svg, robots.txt, sitemap.xml (si l'adresse est renseignée), LISEZMOI.md (mise en ligne gratuite, nom de domaine, réception des messages), balises de partage et données structurées limitées à ce qui est renseigné.
- Fenêtre d'export : liste des points à régler avec raccourcis, confirmation obligatoire tant qu'il en reste.
- Prompt Gemini : liens uniquement vers des sections présentes, variante « devis » si l'objectif est un devis, aucune coordonnée inventée.

## Fichiers
Nouveaux : src/utils/{links,forms,publish,siteSettings}.ts, src/utils/publish.test.ts, src/components/{PublishPanel,LivePreviewModal}.tsx, src/types/jsdom.d.ts
Modifiés : src/utils/{exporter,blockCatalog}.ts, src/types/site.ts, src/components/{EditorWorkspace,ExportModal,InspectorPanel,BlockRenderer}.tsx, server/geminiService.ts

## Vérifications
- tsc --noEmit : aucune erreur
- 18 tests sur 18 (8 existants + 10 nouveaux, dont l'exécution réelle du menu mobile et du formulaire dans jsdom)
- vite build : OK
- Non vérifié : envois réels vers FormSubmit/Web3Forms/Formspree/Netlify (pas d'accès réseau à ces services ici), rendu visuel dans un vrai navigateur, appels Gemini.

## Lancer les tests
npx tsx --test src/utils/siteLogic.test.ts src/utils/publish.test.ts
(Les tests d'exécution du site exigent jsdom : npm install --no-save jsdom. Sans lui, ils sont ignorés.)

---

# Étape 3 : glisser-déposer façon Odoo + ton Gemini

## Comportement
- Panneau de gauche à deux onglets : « Blocs » (palette par catégories, avec recherche) et « Structure » (liste ordonnée).
- On fait glisser une tuile de la palette sur la page : des bandes de dépôt apparaissent entre les sections et celle sous le curseur s'illumine (« Déposer ici »). Un clic sur la tuile insère aussi le bloc (tactile, clavier).
- Chaque bloc de la page a une poignée (visible au survol) pour le glisser ailleurs ; le bloc déplacé est atténué, les emplacements sans effet ne s'affichent pas.
- Petit bouton « + » entre deux sections pour insérer à cet endroit précis (via la bibliothèque).
- La page défile toute seule quand on glisse près du haut ou du bas.
- La barre de navigation reste en haut et le pied de page en bas : un bloc déposé au-dessus ou en dessous est ramené juste à côté, et la bande illuminée montre l'endroit réel.
- Blocs factuels (témoignages, chiffres, équipe, logos) marqués d'un point ambre : leurs champs restent « À compléter ».
- Le glissement ne reconnaît que ce qui vient de SiteForge (un fichier ou un texte déposé par erreur est ignoré). Tout dépôt s'annule avec Annuler.
- Gemini : choix du ton (Concis, Professionnel, Chaleureux, Persuasif, Informatif) dans « Régénérer avec Gemini », avec consigne de ne rien inventer.

## Fichiers
Nouveaux : src/utils/blockOps.ts(+test), src/components/{BlockPalette,DropZone}.tsx, src/components/dragdrop.test.tsx
Modifiés : src/components/{EditorWorkspace,BlockRenderer,InspectorPanel}.tsx

## Vérifications
tsc OK, 27 tests sur 27 (dont un test d'intégration qui rejoue le glisser-déposer dans le vrai éditeur sous jsdom), vite build OK.
Non vérifié : le ressenti à la souris et le rendu visuel dans un vrai navigateur, les glissements au doigt sur mobile (le clic sert d'alternative), les appels Gemini réels.

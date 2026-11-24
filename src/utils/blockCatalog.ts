import type { BlockDefinition, BlockType, SiteBlock } from '../types/site';
export { CURATED_FONT_PAIRINGS } from './artDirections';

export const STUDIO_MEDIA_LIBRARY = [
  {
    id: 'arch-studio',
    label: 'Atelier lumineux en chêne et pierre',
    url: '/src/assets/images/studio_hero_architecture_1795316956684.jpg',
    alt: 'Espace de travail architectural lumineux avec grande table en chêne et baies vitrées',
    aspect: '16:9',
  },
  {
    id: 'craft-vessels',
    label: 'Objets artisanaux sur travertin',
    url: '/src/assets/images/studio_craft_product_1795316957317.jpg',
    alt: 'Céramiques artisanales et emballages épurés posés sur une table en travertin',
    aspect: '4:3',
  },
  {
    id: 'team-workshop',
    label: 'Collaboration en atelier',
    url: '/src/assets/images/studio_team_collaboration_1795316957597.jpg',
    alt: 'Deux créateurs échangeant autour de plans et d’échantillons de matériaux',
    aspect: '4:3',
  },
  {
    id: 'founder-portrait',
    label: 'Portrait éditorial en studio',
    url: '/src/assets/images/studio_portrait_founder_1795316957021.jpg',
    alt: 'Portrait naturel d’une directrice de création dans un atelier baigné de lumière',
    aspect: '1:1',
  },
];

export function createBlockId(prefix = 'blk'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export const BLOCK_CATALOG: BlockDefinition[] = [
  {
    type: 'navbar',
    label: 'Barre de navigation',
    category: 'Navigation',
    description: 'En-tête du site avec nom de marque, liens de section et action principale.',
    variants: [
      { id: 'inline', label: 'Classique alignée', description: 'Marque à gauche, liens au centre, bouton à droite' },
      { id: 'centered', label: 'Marque centrée', description: 'Liens répartis de part et d’autre du logo' },
      { id: 'minimal', label: 'Épurée', description: 'Marque et action principale sans surcharge' },
    ],
    createDefaultContent: (siteName = 'Mon Atelier') => ({
      brandName: siteName,
      ctaLabel: 'Prendre rendez-vous',
      ctaHref: '#contact',
      items: [
        { id: createBlockId('nav'), title: 'À propos', linkHref: '#apropos' },
        { id: createBlockId('nav'), title: 'Services', linkHref: '#services' },
        { id: createBlockId('nav'), title: 'Réalisations', linkHref: '#galerie' },
        { id: createBlockId('nav'), title: 'Contact', linkHref: '#contact' },
      ],
    }),
  },
  {
    type: 'hero',
    label: 'Hero',
    category: 'Contenu',
    description: 'Section d’ouverture avec titre fort, proposition de valeur, bouton et visuel.',
    variants: [
      { id: 'split', label: 'Texte + Image côte à côte', description: 'Mise en page asymétrique équilibrée' },
      { id: 'centered', label: 'Centré avec grand visuel', description: 'Titre centré et image panoramique dessous' },
      { id: 'editorial', label: 'Éditorial asymétrique', description: 'Grand titre décalé et image pleine largeur' },
    ],
    createDefaultContent: (siteName = 'Mon Atelier') => ({
      kicker: 'Studio indépendant',
      heading: `${siteName} conçoit des espaces durables et chaleureux`,
      subheading:
        'De la première esquisse à la réception des travaux, nous accompagnons vos projets résidentiels et professionnels avec exigence.',
      ctaLabel: 'Voir notre démarche',
      ctaHref: '#services',
      secondaryCtaLabel: 'Demander un devis',
      secondaryCtaHref: '#contact',
      image: STUDIO_MEDIA_LIBRARY[0].url,
      imageAlt: STUDIO_MEDIA_LIBRARY[0].alt,
    }),
  },
  {
    type: 'about',
    label: 'À propos',
    category: 'Contenu',
    description: 'Présentation de votre histoire, de vos valeurs et de votre savoir-faire.',
    variants: [
      { id: 'media-left', label: 'Image à gauche', description: 'Visuel à gauche, récit détaillé à droite' },
      { id: 'media-right', label: 'Image à droite', description: 'Récit détaillé à gauche, visuel à droite' },
      { id: 'story-columns', label: 'Deux colonnes éditoriales', description: 'Grand titre et texte structuré en colonnes' },
    ],
    createDefaultContent: () => ({
      kicker: 'Notre démarche',
      heading: 'Un accompagnement sur mesure à chaque étape',
      body: 'Nous privilégions des matériaux bruts, locaux et réparables. Chaque projet démarre par une écoute attentive de vos usages quotidiens afin de créer un lieu juste, lumineux et pérenne.',
      ctaLabel: 'Nous contacter',
      ctaHref: '#contact',
      image: STUDIO_MEDIA_LIBRARY[2].url,
      imageAlt: STUDIO_MEDIA_LIBRARY[2].alt,
    }),
  },
  {
    type: 'services',
    label: 'Services / Fonctionnalités',
    category: 'Contenu',
    description: 'Présentation structurée de vos prestations ou savoir-faire.',
    variants: [
      { id: 'numbered-list', label: 'Liste éditoriale numérotée', description: 'Lignes structurées 01, 02, 03' },
      { id: 'bento', label: 'Grille asymétrique', description: 'Mise en avant d’un service principal' },
      { id: 'grid-3', label: 'Grille 3 colonnes', description: 'Colonnes sobres séparées par des filets' },
    ],
    createDefaultContent: () => ({
      kicker: 'Savoir-faire',
      heading: 'Des prestations pensées pour la clarté et la maîtrise',
      subheading: 'Chaque mission suit un cadre transparent adapté à vos besoins.',
      items: [
        {
          id: createBlockId('srv'),
          title: 'Diagnostic & Conception',
          description: 'Étude complète des volumes, de la lumière naturelle et des contraintes techniques dès la première visite.',
          meta: 'Phase d’étude',
        },
        {
          id: createBlockId('srv'),
          title: 'Sélection des matériaux',
          description: 'Cahier d’échantillons sourcés auprès d’artisans locaux avec estimation détaillée.',
          meta: 'Phase matières',
        },
        {
          id: createBlockId('srv'),
          title: 'Suivi de réalisation',
          description: 'Coordination régulière des intervenants et points d’étape documentés.',
          meta: 'Phase exécution',
        },
      ],
    }),
  },
  {
    type: 'gallery',
    label: 'Galerie',
    category: 'Contenu',
    description: 'Mise en valeur visuelle de vos réalisations ou créations.',
    variants: [
      { id: 'masonry-grid', label: 'Mosaïque asymétrique', description: 'Image vedette large et vignettes associées' },
      { id: 'showcase-2', label: 'Diptyque large', description: 'Deux grands formats côte à côte' },
      { id: 'uniform-3', label: 'Grille 3 colonnes', description: 'Images alignées avec légendes sobres' },
    ],
    createDefaultContent: () => ({
      kicker: 'Réalisations',
      heading: 'Sélection de travaux récents',
      subheading: 'Chaque réalisation présentée doit correspondre à vos propres photographies.',
      items: [
        {
          id: createBlockId('gal'),
          title: 'Projet d’aménagement intérieur',
          subtitle: 'À compléter avec le lieu et la date',
          image: STUDIO_MEDIA_LIBRARY[0].url,
          imageAlt: STUDIO_MEDIA_LIBRARY[0].alt,
        },
        {
          id: createBlockId('gal'),
          title: 'Objet ou pièce sur mesure',
          subtitle: 'À compléter avec la matière',
          image: STUDIO_MEDIA_LIBRARY[1].url,
          imageAlt: STUDIO_MEDIA_LIBRARY[1].alt,
        },
        {
          id: createBlockId('gal'),
          title: 'Espace collaboratif',
          subtitle: 'À compléter avec le contexte',
          image: STUDIO_MEDIA_LIBRARY[2].url,
          imageAlt: STUDIO_MEDIA_LIBRARY[2].alt,
        },
      ],
    }),
  },
  {
    type: 'products',
    label: 'Produits / Catalogue',
    category: 'Contenu',
    description: 'Catalogue d’articles ou offres avec tarif réel et bouton d’action.',
    variants: [
      { id: 'featured-list', label: 'Liste éditoriale', description: 'Présentation horizontale asymétrique' },
      { id: 'compact-grid', label: 'Grille 2 colonnes large', description: 'Grandes images pour pièces phares' },
      { id: 'cards-3', label: 'Cartes 3 colonnes', description: 'Fiches produits avec visuel et prix' },
    ],
    createDefaultContent: () => ({
      kicker: 'Catalogue',
      heading: 'Pièces et références disponibles',
      subheading: 'Renseignez uniquement vos vrais articles et vos tarifs en vigueur.',
      items: [
        {
          id: createBlockId('prd'),
          title: 'À compléter',
          price: 'À compléter',
          description: 'Décrivez les caractéristiques exactes, dimensions ou matières de cet article.',
          image: STUDIO_MEDIA_LIBRARY[1].url,
          imageAlt: STUDIO_MEDIA_LIBRARY[1].alt,
          linkLabel: 'Demander des renseignements',
          linkHref: '#contact',
        },
        {
          id: createBlockId('prd'),
          title: 'À compléter',
          price: 'À compléter',
          description: 'Décrivez les caractéristiques exactes de cette deuxième référence.',
          image: STUDIO_MEDIA_LIBRARY[1].url,
          imageAlt: STUDIO_MEDIA_LIBRARY[1].alt,
          linkLabel: 'Demander des renseignements',
          linkHref: '#contact',
        },
      ],
    }),
  },
  {
    type: 'pricing',
    label: 'Tarifs',
    category: 'Conversion',
    description: 'Grille tarifaire claire avec formules et montants fournis par vos soins.',
    variants: [
      { id: 'two-columns', label: '2 formules côte à côte', description: 'Idéal pour deux offres distinctes' },
      { id: 'three-tiers', label: '3 formules structurées', description: 'Comparaison lisible avec formule mise en avant' },
      { id: 'comparison-cards', label: 'Lignes comparatives', description: 'Présentation horizontale aérée' },
    ],
    createDefaultContent: () => ({
      kicker: 'Tarifs',
      heading: 'Formules et honoraires',
      subheading: 'Complétez avec vos véritables tarifs avant publication.',
      items: [
        {
          id: createBlockId('prc'),
          title: 'Formule 1',
          price: 'À compléter',
          meta: 'Préciser la durée ou le périmètre',
          description: 'Décrivez ce que comprend précisément cette première prestation.',
          features: ['À compléter : livrable principal', 'À compléter : suivi inclus'],
          linkLabel: 'Demander un devis',
          linkHref: '#contact',
        },
        {
          id: createBlockId('prc'),
          title: 'Formule 2',
          price: 'À compléter',
          meta: 'Préciser le périmètre',
          description: 'Décrivez votre prestation la plus complète sans engagement exagéré.',
          features: ['À compléter : étude complète', 'À compléter : accompagnement'],
          highlighted: true,
          linkLabel: 'Prendre contact',
          linkHref: '#contact',
        },
      ],
    }),
  },
  {
    type: 'testimonials',
    label: 'Témoignages',
    category: 'Preuve sociale',
    description: 'Retours clients authentiques uniquement (avec accord explicite des personnes).',
    variants: [
      { id: 'spotlight', label: 'Citation vedette', description: 'Une grande citation éditoriale mise en valeur' },
      { id: 'two-column-quotes', label: 'Diptyque de retours', description: 'Deux témoignages réels côte à côte' },
      { id: 'cards-3', label: '3 citations en grille', description: 'Cartes sobrement bordées' },
    ],
    createDefaultContent: () => ({
      kicker: 'Retours clients',
      heading: 'Paroles de clients',
      items: [
        {
          id: createBlockId('tst'),
          title: 'À compléter',
          subtitle: 'À compléter (fonction ou ville)',
          description: 'À compléter : insérez uniquement un vrai avis client avec son accord.',
        },
        {
          id: createBlockId('tst'),
          title: 'À compléter',
          subtitle: 'À compléter (fonction ou ville)',
          description: 'À compléter : insérez uniquement un vrai avis client avec son accord.',
        },
      ],
    }),
  },
  {
    type: 'faq',
    label: 'FAQ',
    category: 'Preuve sociale',
    description: 'Questions fréquentes avec réponses claires et accordéon interactif.',
    variants: [
      { id: 'accordion', label: 'Accordéon interactif', description: 'Questions dépliables une par une' },
      { id: 'two-columns', label: 'Grille 2 colonnes', description: 'Toutes les réponses visibles d’un coup d’œil' },
      { id: 'compact-list', label: 'Liste compacte', description: 'Présentation resserrée avec séparateurs fins' },
    ],
    createDefaultContent: () => ({
      kicker: 'Questions pratiques',
      heading: 'Réponses aux questions courantes',
      items: [
        {
          id: createBlockId('faq'),
          title: 'Comment se déroule un premier échange ?',
          description:
            'Nous prenons le temps d’écouter votre besoin, vos contraintes et votre calendrier afin de cadrer la suite.',
        },
        {
          id: createBlockId('faq'),
          title: 'Comment obtenir un devis précis ?',
          description:
            'Chaque proposition est établie après analyse de votre demande via le formulaire de contact ci-dessous.',
        },
        {
          id: createBlockId('faq'),
          title: 'Dans quel secteur intervenez-vous ?',
          description: 'À compléter avec votre zone d’intervention géographique exacte.',
        },
      ],
    }),
  },
  {
    type: 'stats',
    label: 'Statistiques',
    category: 'Preuve sociale',
    description: 'Indicateurs chiffrés réels et vérifiables uniquement.',
    variants: [
      { id: 'bar-4', label: 'Bandeau chiffré', description: 'Ligne horizontale claire avec alignement tabulaire' },
      { id: 'split-metrics', label: 'Texte + métriques', description: 'Introduction à gauche et chiffres à droite' },
      { id: 'cards-3', label: '3 repères encadrés', description: 'Métriques avec contexte explicite' },
    ],
    createDefaultContent: () => ({
      kicker: 'Repères vérifiés',
      heading: 'Quelques chiffres factuels',
      items: [
        { id: createBlockId('stt'), title: 'À compléter', subtitle: 'Indicateur réel n°1', meta: 'Source ou année' },
        { id: createBlockId('stt'), title: 'À compléter', subtitle: 'Indicateur réel n°2', meta: 'Source ou année' },
        { id: createBlockId('stt'), title: 'À compléter', subtitle: 'Indicateur réel n°3', meta: 'Source ou année' },
      ],
    }),
  },
  {
    type: 'team',
    label: 'Équipe',
    category: 'Preuve sociale',
    description: 'Membres réels de votre structure avec rôle et portrait autorisé.',
    variants: [
      { id: 'founder-spotlight', label: 'Portrait principal + équipe', description: 'Mise en avant asymétrique' },
      { id: 'list-2', label: '2 colonnes détaillées', description: 'Biographies développées' },
      { id: 'grid-3', label: 'Grille 3 portraits', description: 'Cartes équilibrées avec photo carrée' },
    ],
    createDefaultContent: () => ({
      kicker: 'L’équipe',
      heading: 'Les personnes derrière le projet',
      items: [
        {
          id: createBlockId('tm'),
          title: 'À compléter',
          subtitle: 'À compléter (poste / métier)',
          description: 'À compléter avec le parcours réel de la personne (avec son accord pour sa photo).',
          image: STUDIO_MEDIA_LIBRARY[3].url,
          imageAlt: STUDIO_MEDIA_LIBRARY[3].alt,
        },
      ],
    }),
  },
  {
    type: 'logos',
    label: 'Logos partenaires',
    category: 'Preuve sociale',
    description: 'Uniquement vos vrais clients, partenaires ou labels officiels.',
    variants: [
      { id: 'strip', label: 'Bandeau typographique', description: 'Noms ou sigles alignés sur un filet sobre' },
      { id: 'grid-4', label: 'Grille 4 encarts', description: 'Cases structurées avec bordure fine' },
      { id: 'editorial-list', label: 'Liste avec contexte', description: 'Nom du partenaire et nature du projet' },
    ],
    createDefaultContent: () => ({
      kicker: 'Partenaires & Clients réels',
      heading: 'Structures accompagnées',
      subheading: 'N’ajoutez ici que des organisations avec lesquelles vous avez réellement travaillé.',
      items: [
        { id: createBlockId('lg'), title: 'À compléter', subtitle: 'Nature de la collaboration' },
        { id: createBlockId('lg'), title: 'À compléter', subtitle: 'Nature de la collaboration' },
        { id: createBlockId('lg'), title: 'À compléter', subtitle: 'Nature de la collaboration' },
      ],
    }),
  },
  {
    type: 'cta',
    label: 'Appel à l’action (CTA)',
    category: 'Conversion',
    description: 'Bloc dédié pour inciter le visiteur à passer à l’action.',
    variants: [
      { id: 'card-split', label: 'Texte à gauche, action à droite', description: 'Disposition horizontale asymétrique' },
      { id: 'banner', label: 'Bandeau contrasté', description: 'Fond soutenu avec bouton net' },
      { id: 'minimal-center', label: 'Centré sobre', description: 'Beaucoup d’espace blanc autour du message' },
    ],
    createDefaultContent: () => ({
      kicker: 'Prochaine étape',
      heading: 'Échangeons sur votre projet',
      subheading: 'Précisez votre besoin et vos contraintes pour obtenir une réponse adaptée.',
      ctaLabel: 'Prendre rendez-vous',
      ctaHref: '#contact',
    }),
  },
  {
    type: 'contact',
    label: 'Formulaire de contact',
    category: 'Conversion',
    description: 'Formulaire qui envoie vraiment les messages (ou les demandes de devis), avec vos coordonnées réelles.',
    variants: [
      { id: 'split-info', label: 'Coordonnées + formulaire', description: 'Informations pratiques à gauche, formulaire à droite' },
      { id: 'centered-form', label: 'Formulaire centré', description: 'Colonne unique focalisée sur l’envoi' },
      { id: 'compact-inline', label: 'Compact encadré', description: 'Carte structurée pour prise de contact rapide' },
      { id: 'devis', label: 'Demande de devis', description: 'Service concerné, budget et délai en plus du message' },
    ],
    createDefaultContent: () => ({
      kicker: 'Contact',
      heading: 'Décrivez votre besoin en quelques lignes',
      subheading: 'Nous vous répondons dans les meilleurs délais selon nos disponibilités.',
      email: 'À compléter',
      phone: 'À compléter',
      address: 'À compléter',
      ctaLabel: 'Envoyer la demande',
    }),
  },
  {
    type: 'footer',
    label: 'Pied de page',
    category: 'Navigation',
    description: 'Bas de page structuré avec marque, liens utiles et mentions.',
    variants: [
      { id: 'multi-column', label: 'Colonnes structurées', description: 'Marque, liens de navigation et mentions' },
      { id: 'simple-row', label: 'Ligne simple', description: 'Copyright et liens sur une rangée' },
      { id: 'centered-brand', label: 'Centré sobre', description: 'Navigation et mentions centrées' },
    ],
    createDefaultContent: (siteName = 'Mon Atelier') => ({
      brandName: siteName,
      subheading: 'Savoir-faire indépendant et conception sur mesure.',
      copyright: `© ${new Date().getFullYear()} ${siteName}. Tous droits réservés.`,
      items: [
        { id: createBlockId('ft'), title: 'À propos', linkHref: '#apropos' },
        { id: createBlockId('ft'), title: 'Services', linkHref: '#services' },
        { id: createBlockId('ft'), title: 'Contact', linkHref: '#contact' },
      ],
    }),
  },
];

export function getBlockDefinition(type: BlockType): BlockDefinition {
  return BLOCK_CATALOG.find((item) => item.type === type) ?? BLOCK_CATALOG[0];
}

export function createBlockInstance(type: BlockType, siteName?: string, variant?: string): SiteBlock {
  const def = getBlockDefinition(type);
  return {
    id: createBlockId(type),
    type,
    variant: variant && def.variants.some((v) => v.id === variant) ? variant : def.variants[0].id,
    visible: true,
    content: def.createDefaultContent(siteName),
  };
}

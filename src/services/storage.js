const KEYS = {
  DEVIS: 'artisanpro_devis',
  CHANTIERS: 'artisanpro_chantiers',
}

const MOCK_DEVIS = [
  {
    id: 'd1',
    client: 'Martin Dubois',
    telephone: '06 12 34 56 78',
    description: 'Installation salle de bain complète – remplacement baignoire, lavabo et WC, pose de carrelage 15m²',
    montantHT: 3200,
    date: '2026-05-10',
    statut: 'accepte',
    createdAt: '2026-05-10T08:00:00.000Z',
  },
  {
    id: 'd2',
    client: 'Sophie Moreau',
    telephone: '07 98 76 54 32',
    description: 'Réfection électrique complète maison 120m² – mise aux normes NF C 15-100, remplacement tableau',
    montantHT: 8500,
    date: '2026-05-08',
    statut: 'envoye',
    createdAt: '2026-05-08T10:30:00.000Z',
  },
  {
    id: 'd3',
    client: 'Pierre Lambert',
    telephone: '06 55 44 33 22',
    description: 'Peinture façade extérieure et volets bois – préparation, sous-couche et 2 couches finition',
    montantHT: 2100,
    date: '2026-05-05',
    statut: 'envoye',
    createdAt: '2026-05-05T14:00:00.000Z',
  },
  {
    id: 'd4',
    client: 'Marie Lefebvre',
    telephone: '06 71 82 93 04',
    description: 'Carrelage cuisine et salle à manger – fourniture et pose 45m², joints époxy',
    montantHT: 4750,
    date: '2026-04-28',
    statut: 'refuse',
    createdAt: '2026-04-28T09:00:00.000Z',
  },
  {
    id: 'd5',
    client: 'Jean-Claude Petit',
    telephone: '07 23 45 67 89',
    description: 'Installation tableau électrique neuf 3x13 circuits + mise aux normes prises de courant',
    montantHT: 1850,
    date: '2026-04-20',
    statut: 'envoye',
    createdAt: '2026-04-20T11:00:00.000Z',
  },
  {
    id: 'd6',
    client: 'Isabelle Fontaine',
    telephone: '06 34 56 78 90',
    description: 'Rénovation complète salle de bain – démolition, plomberie, carrelage, sanitaires',
    montantHT: 6800,
    date: '2026-05-12',
    statut: 'accepte',
    createdAt: '2026-05-12T09:30:00.000Z',
  },
]

const MOCK_CHANTIERS = [
  {
    id: 'c1',
    nom: 'Rénovation appartement Dubois',
    client: 'Martin Dubois',
    dateDebut: '2026-05-15',
    notes: 'Accès par le garage. Chantier en journée uniquement (8h-18h). Clé déposée chez le gardien.',
    statut: 'en_cours',
    createdAt: '2026-05-10T08:00:00.000Z',
  },
  {
    id: 'c2',
    nom: 'Mise aux normes électriques – Villa Moreau',
    client: 'Sophie Moreau',
    dateDebut: '2026-05-20',
    notes: 'Prévoir 5 jours de travaux. Maison occupée, couper le courant par demi-journées. Contact : 07 98 76 54 32.',
    statut: 'en_cours',
    createdAt: '2026-05-08T10:30:00.000Z',
  },
  {
    id: 'c3',
    nom: 'Peinture extérieure Maison Garnier',
    client: 'Paul Garnier',
    dateDebut: '2026-04-01',
    notes: 'Travaux terminés le 15 avril. Client très satisfait. Réception signée.',
    statut: 'termine',
    createdAt: '2026-04-01T09:00:00.000Z',
  },
  {
    id: 'c4',
    nom: 'Plomberie immeuble – Rue des Fleurs',
    client: 'Syndicat de copropriété',
    dateDebut: '2026-03-15',
    notes: 'Remplacement colonnes montantes eau froide/chaude. Travaux réalisés en 3 phases de 2 jours.',
    statut: 'termine',
    createdAt: '2026-03-15T07:30:00.000Z',
  },
  {
    id: 'c5',
    nom: 'Salle de bain Fontaine',
    client: 'Isabelle Fontaine',
    dateDebut: '2026-05-18',
    notes: 'Attendre livraison carrelage prévu le 17/05. Prévoir benne pour évacuation gravats.',
    statut: 'en_cours',
    createdAt: '2026-05-12T09:30:00.000Z',
  },
]

// Plus de seed automatique des MOCK_DEVIS : ils étaient injectés sur
// localStorage vide et finissaient migrés vers Supabase, polluant la
// base avec des données fictives (Martin Dubois, Sophie Moreau…).
export function loadDevis() {
  try {
    const raw = localStorage.getItem(KEYS.DEVIS)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveDevis(devis) {
  try {
    localStorage.setItem(KEYS.DEVIS, JSON.stringify(devis))
  } catch (e) {
    console.error('Erreur sauvegarde devis:', e)
  }
}

// Plus de seed automatique des MOCK_CHANTIERS : voir loadDevis.
export function loadChantiers() {
  try {
    const raw = localStorage.getItem(KEYS.CHANTIERS)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveChantiers(chantiers) {
  try {
    localStorage.setItem(KEYS.CHANTIERS, JSON.stringify(chantiers))
  } catch (e) {
    console.error('Erreur sauvegarde chantiers:', e)
  }
}

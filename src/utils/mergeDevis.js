// Priorité des statuts pour la déduplication : le statut le plus "avancé" gagne.
// accepte > envoye > en_attente_validation > refuse > annule
const STATUT_RANK = {
  accepte:               5,
  envoye:                3,
  en_attente_validation: 2,
  refuse:                1,
  annule:                0,
}

function rank(d) {
  return STATUT_RANK[d.statut] ?? 3
}

// Retourne le "meilleur" devis entre deux ayant le même numéro.
// Règles :
//  1. Le statut le plus avancé prend la priorité (accepte > envoye…)
//  2. Si même statut : le devis ouvrier Supabase prend la priorité sur local
//  3. Sinon : on garde le plus récent
function best(a, b) {
  const ra = rank(a), rb = rank(b)
  if (ra !== rb) return ra > rb ? a : b
  if (b.createur?.role === 'ouvrier' && a.createur?.role !== 'ouvrier') return b
  if (a.createur?.role === 'ouvrier' && b.createur?.role !== 'ouvrier') return a
  return new Date(a.createdAt) >= new Date(b.createdAt) ? a : b
}

/**
 * Fusionne les devis localStorage (`localDevis`) et Supabase (`supabaseDevis`)
 * en un tableau dédupliqué sans aucun doublon par numéro.
 *
 * Règles d'or :
 *  - Un devis `accepte` gagne TOUJOURS sur un devis `envoye` ayant le même numéro
 *  - Plusieurs lignes Supabase pour le même numéro → on garde le meilleur statut
 *  - Devis ouvrier Supabase prime sur copie locale de même numéro
 */
export function mergeDevis(localDevis, supabaseDevis) {
  // Étape 1 : déduplication interne Supabase (plusieurs rows = 1 gagnant)
  const supabaseBest = {}
  for (const d of supabaseDevis) {
    const key = d.numero || d.id
    if (!supabaseBest[key]) {
      supabaseBest[key] = d
    } else {
      supabaseBest[key] = best(supabaseBest[key], d)
    }
  }
  const dedupedSupa = Object.values(supabaseBest)

  // Étape 2 : fusion locale vs Supabase
  const supaByToken  = new Map(dedupedSupa.filter((d) => d.tokenUnique).map((d) => [d.tokenUnique, d]))
  const supaByNumero = new Map(dedupedSupa.filter((d) => d.numero).map((d) => [d.numero, d]))

  const merged = {}

  // Ajouter les devis locaux, sauf si une version Supabase "meilleure" existe
  for (const local of localDevis) {
    const key = local.tokenUnique
      ? `t:${local.tokenUnique}`
      : local.numero
        ? `n:${local.numero}`
        : `id:${local.id}`

    // Version Supabase correspondante ?
    const supaVersion = local.tokenUnique
      ? supaByToken.get(local.tokenUnique)
      : local.numero
        ? supaByNumero.get(local.numero)
        : null

    if (supaVersion) {
      merged[key] = best(local, supaVersion)
    } else {
      merged[key] = local
    }
  }

  // Ajouter les devis Supabase qui n'ont pas d'équivalent local
  const localTokenSet  = new Set(localDevis.filter((d) => d.tokenUnique).map((d) => d.tokenUnique))
  const localNumeroSet = new Set(localDevis.filter((d) => d.numero).map((d) => d.numero))

  for (const supa of dedupedSupa) {
    if (supa.tokenUnique && localTokenSet.has(supa.tokenUnique)) continue // déjà traité
    if (supa.numero && localNumeroSet.has(supa.numero)) continue          // déjà traité
    merged[`s:${supa.id}`] = supa
  }

  return Object.values(merged)
}

import { supabase } from './supabase'
import { pushDevisSoumis, pushDevisStatut } from './pushTrigger'

// Embed du créateur via la FK explicite devis_cree_par_fkey.
// !left = LEFT JOIN : les devis sans cree_par (créés par le manager directement)
// sont inclus avec createur=null, au lieu d'être exclus par un INNER JOIN.
const SELECT_WITH_CREATOR = `
  *,
  createur:utilisateurs!devis_cree_par_fkey!left ( id, nom, prenom, role )
`

// Colonnes "riches" ajoutées par la migration d'unification. Si la migration
// n'a pas encore été exécutée, les écritures retombent sur les colonnes de base.
const RICH_COLS = ['prestations', 'total_ttc', 'conditions_paiement', 'acompte_pct', 'signed_at', 'signed_ville']

function stripRichCols(payload) {
  const p = { ...payload }
  for (const c of RICH_COLS) delete p[c]
  return p
}
function isMissingColumnError(error) {
  const m = (error?.message || '').toLowerCase()
  return m.includes('could not find') || m.includes('schema cache') ||
         (m.includes('column') && m.includes('does not exist')) || error?.code === 'PGRST204'
}

// Insert/Update résilients : tentent le payload complet, et en cas de colonne
// manquante (migration non faite) réessaient sans les colonnes riches.
async function insertDevisRow(payload) {
  let res = await supabase.from('devis').insert(payload).select(SELECT_WITH_CREATOR).single()
  if (res.error && isMissingColumnError(res.error)) {
    res = await supabase.from('devis').insert(stripRichCols(payload)).select(SELECT_WITH_CREATOR).single()
  }
  return res
}
async function updateDevisRow(id, payload) {
  let res = await supabase.from('devis').update(payload).eq('id', id).select(SELECT_WITH_CREATOR).single()
  if (res.error && isMissingColumnError(res.error)) {
    res = await supabase.from('devis').update(stripRichCols(payload)).eq('id', id).select(SELECT_WITH_CREATOR).single()
  }
  return res
}

// ── Listing ────────────────────────────────────────────────────────
// RLS : manager → tous les devis de l'entreprise ; ouvrier → les siens.
export async function listDevisAuthenticated() {
  const { data, error } = await supabase
    .from('devis')
    .select(SELECT_WITH_CREATOR)
    .order('created_at', { ascending: false })
  return { data: data ?? [], error }
}

export async function listMesDevisCreated() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: { message: 'Non authentifié' } }
  const { data, error } = await supabase
    .from('devis')
    .select(SELECT_WITH_CREATOR)
    .eq('cree_par', user.id)
    .order('created_at', { ascending: false })
  return { data: data ?? [], error }
}

// ── Normalisation (row Supabase → format UI camelCase) ──────────────
export function normalizeDevis(d) {
  if (!d) return d
  const montantHT = Number(d.montant_ht ?? 0)
  const tauxTVA   = Number(d.taux_tva   ?? 20)
  const totalTVA  = montantHT * tauxTVA / 100
  const totalTTC  = d.total_ttc != null ? Number(d.total_ttc) : montantHT + totalTVA

  // Prestations : détail complet si disponible (jsonb), sinon reconstruit
  // une ligne unique à partir de la description aplatie (anciens devis).
  let prestations
  if (Array.isArray(d.prestations) && d.prestations.length) {
    prestations = d.prestations
  } else {
    prestations = [{
      description:    d.description || '',
      quantite:       1,
      unite:          'u',
      prixUnitaireHT: montantHT,
      tauxTVA,
    }]
  }

  return {
    id:                 d.id,
    numero:             d.numero,
    client:             d.client_nom || '',
    clientTelephone:    d.client_telephone || '',
    clientEmail:        d.client_email || '',
    clientAdresse:      d.client_adresse || '',
    description:        d.description || '',
    dateEmission:       d.date_emission,
    date:               d.date_emission,
    dateValidite:       d.date_validite,
    statut:             normalizeStatut(d.statut),
    tokenUnique:        d.token_unique,
    montantHT, totalHT: montantHT, totalTVA, totalTTC,
    prestations,
    conditionsPaiement: d.conditions_paiement || '',
    acomptePct:         d.acompte_pct ?? null,
    signedAt:           d.signed_at || null,
    signedVille:        d.signed_ville || null,
    createdAt:          d.created_at,
    cree_par:           d.cree_par,
    entreprise_id:      d.entreprise_id,
    createur:           d.createur,
    _source:            'supabase',
  }
}

function normalizeStatut(s) {
  if (!s) return 'envoye'
  const lower = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (lower.includes('attente') || lower === 'en_attente_validation') return 'en_attente_validation'
  if (lower.includes('accept')) return 'accepte'
  if (lower.includes('refus'))  return 'refuse'
  if (lower.includes('annul'))  return 'annule'
  return 'envoye'
}

// ── Construction du payload depuis un devis UI ──────────────────────
function devisToPayload(devis) {
  // Description aplatie (compat anciens lecteurs + recherche)
  let description = devis.description || ''
  if (Array.isArray(devis.prestations) && devis.prestations.length) {
    description = devis.prestations.map((p) => p.description).filter(Boolean).join(' / ')
  }

  // Montant HT : explicite ou somme des prestations
  let montant_ht = Number(devis.totalHT ?? devis.montantHT ?? 0)
  if (!montant_ht && Array.isArray(devis.prestations)) {
    montant_ht = devis.prestations.reduce((s, p) =>
      s + Number(p.quantite ?? 1) * Number(p.prixUnitaireHT ?? 0), 0)
  }
  const taux_tva  = Number(devis.tauxTVA ?? devis.prestations?.[0]?.tauxTVA ?? 20)
  const total_ttc = devis.totalTTC != null
    ? Number(devis.totalTTC)
    : montant_ht + montant_ht * taux_tva / 100

  const adresseComplete = [devis.clientAdresse, devis.clientCodePostal, devis.clientVille]
    .filter(Boolean).join(', ') || devis.clientAdresse || ''

  return {
    numero:              devis.numero || '',
    client_nom:          devis.client || '',
    client_email:        devis.clientEmail || '',
    client_telephone:    devis.clientTelephone || devis.telephone || '',
    client_adresse:      adresseComplete,
    description,
    montant_ht,
    taux_tva,
    total_ttc,
    date_emission:       devis.dateEmission || devis.date || null,
    date_validite:       devis.dateValidite || null,
    conditions_paiement: devis.conditionsPaiement || null,
    acompte_pct:         devis.acomptePct ?? null,
    // Détail complet des lignes (jsonb)
    prestations:         Array.isArray(devis.prestations) ? devis.prestations : null,
  }
}

// ── Numéro de devis : généré depuis Supabase (source unique) ────────
// Évite les collisions entre appareils/utilisateurs (l'ancien compteur
// localStorage en générait par appareil → doublons possibles).
export async function getNextDevisNumero(entrepriseId) {
  // RPC SECURITY DEFINER : voit TOUS les devis de l'entreprise (manager +
  // ouvriers), contrairement à une requête directe limitée par RLS.
  const { data, error } = await supabase.rpc('next_devis_numero')
  if (!error && typeof data === 'string' && data) return data

  // Repli (avant exécution de la migration RPC) : requête directe.
  const year   = new Date().getFullYear()
  const prefix = `DEV-${year}-`
  const { data: rows } = await supabase
    .from('devis')
    .select('numero')
    .eq('entreprise_id', entrepriseId)
    .like('numero', `${prefix}%`)
    .order('numero', { ascending: false })
    .limit(1)
  let next = 1
  const last = rows?.[0]?.numero
  if (last) {
    const n = parseInt(String(last).slice(prefix.length), 10)
    if (Number.isFinite(n)) next = n + 1
  }
  return `${prefix}${String(next).padStart(3, '0')}`
}

function isUniqueViolation(error) {
  return error?.code === '23505' || (error?.message || '').toLowerCase().includes('duplicate')
}

// Insère un devis en garantissant un numéro unique : génère depuis Supabase
// si absent, et réessaie avec un nouveau numéro en cas de collision (course).
async function insertDevisWithNumero(devis, base, entrepriseId) {
  let numero = devis.numero
  for (let attempt = 0; attempt < 4; attempt++) {
    if (!numero) numero = await getNextDevisNumero(entrepriseId)
    const payload = { ...devisToPayload({ ...devis, numero }), ...base }
    const res = await insertDevisRow(payload)
    if (!res.error) return res
    if (isUniqueViolation(res.error)) { numero = null; continue } // numéro pris → régénère
    return res // autre erreur → on remonte
  }
  return { data: null, error: { message: 'Impossible d\'attribuer un numéro de devis unique.' } }
}

// ── Création par un OUVRIER → en attente de validation manager ──────
export async function createDevisComplet(devis) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Non authentifié' } }

  const { data: profile } = await supabase
    .from('utilisateurs').select('entreprise_id').eq('id', user.id).maybeSingle()
  if (!profile?.entreprise_id) return { data: null, error: { message: 'Entreprise non identifiée' } }

  const { data, error } = await insertDevisWithNumero(devis, {
    entreprise_id: profile.entreprise_id,
    cree_par:      user.id,
    statut:        'en_attente_validation',
  }, profile.entreprise_id)

  if (data && !error) pushDevisSoumis(data)
  return { data: data ? normalizeDevis(data) : null, error }
}

// ── Création par un MANAGER → directement "envoyé" (source de vérité) ─
export async function createDevisManager(devis) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Non authentifié' } }

  const { data: profile } = await supabase
    .from('utilisateurs').select('entreprise_id').eq('id', user.id).maybeSingle()
  if (!profile?.entreprise_id) return { data: null, error: { message: 'Entreprise non identifiée' } }

  const { data, error } = await insertDevisWithNumero(devis, {
    entreprise_id: profile.entreprise_id,
    cree_par:      user.id,
    statut:        devis.statut || 'envoye',
  }, profile.entreprise_id)

  return { data: data ? normalizeDevis(data) : null, error }
}

// ── Mise à jour du statut (+ notification selon transition) ─────────
export async function updateDevisStatut(id, statut, ancienStatut = null) {
  const { data, error } = await supabase
    .from('devis')
    .update({ statut })
    .eq('id', id)
    .select('id, numero, statut, cree_par, entreprise_id')
    .maybeSingle()
  if (data && !error && ancienStatut) pushDevisStatut(data, ancienStatut)
  return { error, data }
}

// ── Édition complète (manager corrige un devis avant validation) ────
export async function updateDevisEnAttente(id, devis) {
  const { data, error } = await updateDevisRow(id, devisToPayload(devis))
  return { data: data ? normalizeDevis(data) : null, error }
}

// ── Associe un token de signature à un devis EXISTANT (pas de doublon) ─
export async function setDevisToken(id, token) {
  const { data, error } = await supabase
    .from('devis')
    .update({ token_unique: token, statut: 'envoye' })
    .eq('id', id)
    .select(SELECT_WITH_CREATOR)
    .single()
  return { data: data ? normalizeDevis(data) : null, error }
}

// ── Marque un devis comme accepté (signature client reçue) ──────────
export async function markDevisAccepte(id, { signedAt, signedVille } = {}) {
  const payload = { statut: 'accepte', signed_at: signedAt || new Date().toISOString(), signed_ville: signedVille || null }
  const { data, error } = await updateDevisRow(id, payload)
  return { data: data ? normalizeDevis(data) : null, error }
}

// ── Migration one-shot : copie les devis localStorage vers Supabase ──
// Idempotente : ne ré-insère pas un numéro déjà présent. Ne supprime RIEN
// du localStorage (sécurité : aucune perte si quelque chose tourne mal).
export async function migrateLocalDevisToSupabase(localDevis) {
  if (!Array.isArray(localDevis) || !localDevis.length) return { migrated: 0 }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { migrated: 0 }
  const { data: profile } = await supabase
    .from('utilisateurs').select('entreprise_id').eq('id', user.id).maybeSingle()
  if (!profile?.entreprise_id) return { migrated: 0 }

  // Numéros déjà en base (pour ne pas dupliquer)
  const { data: existing } = await supabase
    .from('devis').select('numero, token_unique').eq('entreprise_id', profile.entreprise_id)
  const existingNumeros = new Set((existing || []).map((d) => d.numero).filter(Boolean))
  const existingTokens  = new Set((existing || []).map((d) => d.token_unique).filter(Boolean))

  let migrated = 0
  for (const d of localDevis) {
    // Déjà en base (par numéro ou par token) → on saute
    if (d.numero && existingNumeros.has(d.numero)) continue
    if (d.tokenUnique && existingTokens.has(d.tokenUnique)) continue

    const payload = {
      ...devisToPayload(d),
      entreprise_id: profile.entreprise_id,
      cree_par:      user.id,
      statut:        d.statut || 'envoye',
      token_unique:  d.tokenUnique || null,
      signed_at:     d.signedAt || null,
      signed_ville:  d.signedVille || null,
    }
    const { error } = await insertDevisRow(payload)
    if (!error) { migrated++; if (d.numero) existingNumeros.add(d.numero) }
  }
  return { migrated }
}

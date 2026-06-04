import { supabase } from './supabase'

// Embed du créateur via la FK explicite devis_cree_par_fkey.
const SELECT_WITH_CREATOR = `
  *,
  createur:utilisateurs!devis_cree_par_fkey ( id, nom, prenom, role )
`

// RLS filtre automatiquement :
//   - manager → tous les devis de son entreprise
//   - ouvrier → ses propres devis uniquement
// Utilisé par la page MANAGER (Devis.jsx) qui veut voir tout l'entreprise.
export async function listDevisAuthenticated() {
  const { data, error } = await supabase
    .from('devis')
    .select(SELECT_WITH_CREATOR)
    .order('created_at', { ascending: false })
  return { data: data ?? [], error }
}

// Variante stricte : filtre explicitement par cree_par = auth.uid().
// Défense en profondeur — utilisée par l'app OUVRIER pour garantir qu'un
// employé ne voit JAMAIS les devis d'autres utilisateurs, même si RLS
// est mal configuré.
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

// Normalise un row Supabase (snake_case) vers le format UI camelCase
// utilisé par les composants DevisCard / DevisForm.
export function normalizeDevis(d) {
  if (!d) return d
  const montantHT = Number(d.montant_ht ?? 0)
  const tauxTVA   = Number(d.taux_tva   ?? 20)
  const totalTVA  = montantHT * tauxTVA / 100
  const totalTTC  = montantHT + totalTVA
  return {
    id:                d.id,
    numero:            d.numero,
    client:            d.client_nom || '',
    clientTelephone:   d.client_telephone || '',
    clientEmail:       d.client_email || '',
    clientAdresse:     d.client_adresse || '',
    description:       d.description || '',
    dateEmission:      d.date_emission,
    date:              d.date_emission,
    dateValidite:      d.date_validite,
    statut:            normalizeStatut(d.statut),
    tokenUnique:       d.token_unique,
    montantHT, totalHT: montantHT, totalTVA, totalTTC,
    prestations: [{
      description:    d.description || '',
      quantite:       1,
      prixUnitaireHT: montantHT,
      tauxTVA,
    }],
    createdAt:         d.created_at,
    cree_par:          d.cree_par,
    entreprise_id:     d.entreprise_id,
    createur:          d.createur,   // { id, nom, prenom, role } ou null
    _source:           'supabase',
  }
}

// Le default Supabase est "Envoyé" (avec accent), l'UI utilise 'envoye'
// (minuscule sans accent). On normalise.
function normalizeStatut(s) {
  if (!s) return 'envoye'
  const lower = s.toLowerCase()
                 .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip accents
  if (lower.includes('attente') || lower === 'en_attente_validation') return 'en_attente_validation'
  if (lower.includes('accept')) return 'accepte'
  if (lower.includes('refus'))  return 'refuse'
  if (lower.includes('annul'))  return 'annule'
  return 'envoye'
}

// Crée un devis "complet" (pas seulement pour signature) avec entreprise_id
// et cree_par auto-déduits depuis la session.
export async function createDevisComplet(devis) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Non authentifié' } }

  // Récupère l'entreprise du créateur
  const { data: profile } = await supabase
    .from('utilisateurs')
    .select('entreprise_id')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile?.entreprise_id) return { data: null, error: { message: 'Entreprise non identifiée' } }

  // Construit la description depuis prestations
  let description = devis.description || ''
  if (Array.isArray(devis.prestations) && devis.prestations.length) {
    description = devis.prestations.map((p) => p.description).filter(Boolean).join(' / ')
  }

  // Montant HT (somme prestations OU valeur explicite)
  let montant_ht = Number(devis.totalHT ?? devis.montantHT ?? 0)
  if (!montant_ht && Array.isArray(devis.prestations)) {
    montant_ht = devis.prestations.reduce((s, p) => {
      return s + Number(p.quantite ?? 1) * Number(p.prixUnitaireHT ?? 0)
    }, 0)
  }
  const taux_tva = Number(devis.tauxTVA ?? devis.prestations?.[0]?.tauxTVA ?? 20)

  const adresseComplete = [devis.clientAdresse, devis.clientCodePostal, devis.clientVille]
    .filter(Boolean).join(', ')

  const payload = {
    entreprise_id:    profile.entreprise_id,
    cree_par:         user.id,
    numero:           devis.numero || '',
    client_nom:       devis.client || '',
    client_email:     devis.clientEmail || '',
    client_telephone: devis.clientTelephone || devis.telephone || '',
    client_adresse:   adresseComplete,
    description,
    montant_ht,
    taux_tva,
    date_emission:    devis.dateEmission || devis.date || null,
    date_validite:    devis.dateValidite || null,
    statut:           'en_attente_validation',   // toujours soumis à validation manager
  }

  const { data, error } = await supabase
    .from('devis')
    .insert(payload)
    .select(SELECT_WITH_CREATOR)
    .single()

  return { data: data ? normalizeDevis(data) : null, error }
}

export async function updateDevisStatut(id, statut) {
  const { error } = await supabase.from('devis').update({ statut }).eq('id', id)
  return { error }
}

// Permet au manager de corriger un devis encore en_attente_validation
// avant de l'approuver. Le statut reste inchangé.
export async function updateDevisEnAttente(id, devis) {
  let description = devis.description || ''
  if (Array.isArray(devis.prestations) && devis.prestations.length) {
    description = devis.prestations.map((p) => p.description).filter(Boolean).join(' / ')
  }

  let montant_ht = Number(devis.totalHT ?? devis.montantHT ?? 0)
  if (!montant_ht && Array.isArray(devis.prestations)) {
    montant_ht = devis.prestations.reduce((s, p) => {
      return s + Number(p.quantite ?? 1) * Number(p.prixUnitaireHT ?? 0)
    }, 0)
  }
  const taux_tva = Number(devis.tauxTVA ?? devis.prestations?.[0]?.tauxTVA ?? 20)

  const adresseComplete = [devis.clientAdresse, devis.clientCodePostal, devis.clientVille]
    .filter(Boolean).join(', ')

  const payload = {
    numero:           devis.numero || '',
    client_nom:       devis.client || '',
    client_email:     devis.clientEmail || '',
    client_telephone: devis.clientTelephone || devis.telephone || '',
    client_adresse:   adresseComplete,
    description,
    montant_ht,
    taux_tva,
    date_emission:    devis.dateEmission || devis.date || null,
    date_validite:    devis.dateValidite || null,
    // statut inchangé — reste 'en_attente_validation'
  }

  const { data, error } = await supabase
    .from('devis')
    .update(payload)
    .eq('id', id)
    .select(SELECT_WITH_CREATOR)
    .single()

  return { data: data ? normalizeDevis(data) : null, error }
}

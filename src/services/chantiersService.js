import { supabase } from './supabase'
import { loadChantiers as loadLegacyChantiers } from './storage'

const MIGRATION_FLAG = 'chantiers_migrated_to_supabase_v1'

// Mapping interne <-> UI : la table Supabase utilise snake_case, l'UI
// historique utilise camelCase. On expose les deux pour ne pas casser
// les composants existants.
function toUI(row) {
  if (!row) return row
  return {
    ...row,
    // alias camelCase
    dateDebut:  row.date_debut,
    dateFin:    row.date_fin,
    clientNom:  row.client_nom,
    codePostal: row.code_postal,
    // legacy "client" (free-text) utilise par ChantierForm/Chantiers
    client:     row.client_nom || '',
  }
}

function toPayload(form, entrepriseId) {
  return {
    entreprise_id: entrepriseId,
    nom:           form.nom || '',
    description:   form.description || null,
    client_nom:    form.client || form.clientNom || null,
    adresse:       form.adresse || null,
    code_postal:   form.codePostal || null,
    ville:         form.ville || null,
    date_debut:    form.dateDebut || null,
    date_fin:      form.dateFin || null,
    statut:        form.statut || 'en_cours',
    avancement:    Number.isFinite(Number(form.avancement)) ? Number(form.avancement) : 0,
    notes:         form.notes || null,
  }
}

export async function listChantiers() {
  const { data, error } = await supabase
    .from('chantiers')
    .select('*')
    .order('date_debut', { ascending: false, nullsFirst: false })
  return { data: (data ?? []).map(toUI), error }
}

// Tous les chantiers actifs (planifie + en_cours) — utilisé pour le dropdown
// d'assignation. Exclut termine/annule pour ne pas polluer la liste.
export async function listChantiersActifs() {
  const { data, error } = await supabase
    .from('chantiers')
    .select('*')
    .in('statut', ['planifie', 'en_cours'])
    .order('date_debut', { ascending: false, nullsFirst: false })
  return { data: (data ?? []).map(toUI), error }
}

export async function createChantier(entrepriseId, form) {
  if (!entrepriseId) return { data: null, error: { message: 'Entreprise non identifiée' } }
  const payload = toPayload(form, entrepriseId)
  const { data, error } = await supabase
    .from('chantiers')
    .insert(payload)
    .select()
    .single()
  return { data: toUI(data), error }
}

// Création "rapide" depuis le panel d'assignation (champs minimaux)
export async function createChantierRapide(entrepriseId, { nom, ville, adresse, codePostal }) {
  return createChantier(entrepriseId, {
    nom, ville, adresse, codePostal,
    statut: 'planifie',
  })
}

// IMPORTANT : un UPDATE doit modifier UNIQUEMENT les champs explicitement
// fournis dans `form`. Sinon, un appel comme updateChantier(id, { statut: 'X' })
// reconstruirait un payload complet avec nom='', client_nom=null, etc., et
// écraserait toutes les autres colonnes.
export async function updateChantier(id, form) {
  const payload = { updated_at: new Date().toISOString() }
  if ('nom'          in form) payload.nom          = form.nom
  if ('description'  in form) payload.description  = form.description || null
  if ('client'       in form) payload.client_nom   = form.client       || null
  if ('clientNom'    in form) payload.client_nom   = form.clientNom    || null
  if ('adresse'      in form) payload.adresse      = form.adresse      || null
  if ('codePostal'   in form) payload.code_postal  = form.codePostal   || null
  if ('code_postal'  in form) payload.code_postal  = form.code_postal  || null
  if ('ville'        in form) payload.ville        = form.ville        || null
  if ('dateDebut'    in form) payload.date_debut   = form.dateDebut    || null
  if ('date_debut'   in form) payload.date_debut   = form.date_debut   || null
  if ('dateFin'      in form) payload.date_fin     = form.dateFin      || null
  if ('date_fin'     in form) payload.date_fin     = form.date_fin     || null
  if ('statut'       in form) payload.statut       = form.statut
  if ('avancement'   in form) payload.avancement   = Number.isFinite(Number(form.avancement)) ? Number(form.avancement) : 0
  if ('notes'        in form) payload.notes        = form.notes || null

  const { data, error } = await supabase
    .from('chantiers')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  return { data: toUI(data), error }
}

export async function deleteChantier(id) {
  const { error } = await supabase.from('chantiers').delete().eq('id', id)
  return { error }
}

// Vérifie si un chantier issu de ce devis existe déjà (cherche par numéro
// de devis présent dans le nom du chantier). Évite les doublons quand on
// re-crée plusieurs fois un devis annule-et-remplace.
export async function chantierExisteDejaPourDevis(devisNumero) {
  if (!devisNumero) return false
  const { data } = await supabase
    .from('chantiers')
    .select('id')
    .ilike('nom', `%${devisNumero}%`)
    .limit(1)
  return (data || []).length > 0
}

// Pré-remplit les champs d'un nouveau chantier à partir d'un devis accepté.
// Retourne un objet form utilisable par ChantierForm — pas d'INSERT ici.
export function chantierFromDevis(devis) {
  if (!devis) return null
  const adresseComplete = [
    devis.clientAdresse, devis.client_adresse,
  ].filter(Boolean)[0] || ''
  const description = devis.description
    || (Array.isArray(devis.prestations)
        ? devis.prestations.map((p) => p.description).filter(Boolean).join(' / ')
        : '')
  return {
    nom:         `Chantier ${devis.numero || ''} — ${devis.client || devis.client_nom || ''}`.trim(),
    client:      devis.client || devis.client_nom || '',
    description,
    adresse:     adresseComplete,
    codePostal:  devis.clientCodePostal || devis.client_code_postal || '',
    ville:       devis.clientVille || devis.client_ville || '',
    dateDebut:   new Date().toISOString().split('T')[0],
    statut:      'planifie',
    notes:       `Issu du devis ${devis.numero || ''} accepté le ${devis.signedAt ? new Date(devis.signedAt).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}.`,
    _devisId:    devis.id,          // utile pour la traçabilité côté UI
  }
}

// ─── Migration one-shot localStorage -> Supabase ─────────────────
// Idempotente : protégée par un flag localStorage. Peut être appelée
// depuis n'importe quelle page (useChantiers, OuvrierPlanningPanel…)
// avant de lister les chantiers.
export async function migrateLegacyChantiers(entrepriseId) {
  if (!entrepriseId) return { migrated: 0, attempted: false }
  if (localStorage.getItem(MIGRATION_FLAG)) return { migrated: 0, attempted: false }

  // Si Supabase contient déjà des chantiers, on marque migré sans rien faire.
  const { data: existing } = await listChantiers()
  if ((existing || []).length > 0) {
    localStorage.setItem(MIGRATION_FLAG, '1')
    return { migrated: 0, attempted: false }
  }

  const legacy = loadLegacyChantiers()
  if (!Array.isArray(legacy) || legacy.length === 0) {
    localStorage.setItem(MIGRATION_FLAG, '1')
    return { migrated: 0, attempted: false }
  }

  console.log(`[migrateLegacyChantiers] ${legacy.length} chantier(s) à migrer vers Supabase…`)
  let migrated = 0, failed = 0
  for (const c of legacy) {
    const { data, error } = await createChantier(entrepriseId, c)
    if (data) migrated++
    else { failed++; console.warn('[migrateLegacyChantiers]', error?.message) }
  }
  console.log(`[migrateLegacyChantiers] Résultat : ${migrated} migrés, ${failed} échec(s)`)
  localStorage.setItem(MIGRATION_FLAG, '1')
  return { migrated, attempted: true, failed }
}

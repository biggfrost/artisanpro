import { supabase } from './supabase'
import { pushAssignation } from './pushTrigger'

// On JOIN sur chantiers pour récupérer le nom/ville/statut directement.
// La syntaxe `chantier:chantiers (col1, col2…)` est l'embedding PostgREST.
const SELECT_WITH_CHANTIER = `
  id, ouvrier_id, chantier_id, date_debut, date_fin, notes, created_at,
  chantier:chantiers ( id, nom, statut, adresse, code_postal, ville, avancement )
`

export async function listAssignationsForOuvrier(ouvrierId) {
  const { data, error } = await supabase
    .from('assignations')
    .select(SELECT_WITH_CHANTIER)
    .eq('ouvrier_id', ouvrierId)
    .order('date_debut', { ascending: false })
  return { data: data ?? [], error }
}

export async function createAssignation({ ouvrierId, chantierId, dateDebut, dateFin, notes }) {
  const { data, error } = await supabase
    .from('assignations')
    .insert({
      ouvrier_id:  ouvrierId,
      chantier_id: chantierId,
      date_debut:  dateDebut,
      date_fin:    dateFin || null,
      notes:       notes || null,
    })
    .select(SELECT_WITH_CHANTIER)
    .single()

  // Notifie l'ouvrier : nouveau chantier assigné (planning)
  if (data && !error) pushAssignation({ ouvrier_id: ouvrierId, chantier_id: chantierId })

  return { data, error }
}

export async function updateAssignation(id, { chantierId, dateDebut, dateFin, notes }) {
  const { data, error } = await supabase
    .from('assignations')
    .update({
      chantier_id: chantierId,
      date_debut:  dateDebut,
      date_fin:    dateFin || null,
      notes:       notes || null,
    })
    .eq('id', id)
    .select(SELECT_WITH_CHANTIER)
    .single()
  return { data, error }
}

export async function deleteAssignation(id) {
  const { error } = await supabase.from('assignations').delete().eq('id', id)
  return { error }
}

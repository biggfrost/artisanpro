import { supabase } from './supabase'

// Liste tous les utilisateurs de l'entreprise courante (RLS filtre déjà
// par entreprise_id via current_entreprise_id()).
export async function listOuvriers() {
  const { data, error } = await supabase
    .from('utilisateurs')
    .select('*')
    .eq('role', 'ouvrier')
    .order('nom', { ascending: true })
  return { data: data ?? [], error }
}

export async function listAllUtilisateurs() {
  const { data, error } = await supabase
    .from('utilisateurs')
    .select('*')
    .order('role', { ascending: true })
  return { data: data ?? [], error }
}

export async function updateUtilisateur(id, updates) {
  const payload = {
    nom:       updates.nom,
    prenom:    updates.prenom,
    telephone: updates.telephone || null,
    metier:    updates.metier || null,
    statut:    updates.statut || 'actif',
  }
  const { data, error } = await supabase
    .from('utilisateurs')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

// Comptage rapide d'assignations actives par ouvrier (pour le statut
// "en chantier" vs "disponible").
export async function getAssignationsActivesParOuvrier() {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('assignations')
    .select('ouvrier_id, chantier_id, date_debut, date_fin')
    .or(`date_fin.is.null,date_fin.gte.${now}`)
  if (error) return { map: {}, error }
  const map = {}
  for (const a of (data || [])) {
    map[a.ouvrier_id] = (map[a.ouvrier_id] || 0) + 1
  }
  return { map, error: null }
}

import { supabase } from './supabase'

// Tous les inserts/updates passent l'entreprise_id en clair pour que RLS
// puisse comparer avec current_entreprise_id().

export async function listClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })
  return { data, error }
}

export async function createClient(entrepriseId, client) {
  const payload = {
    entreprise_id:  entrepriseId,
    nom:            client.nom || '',
    prenom:         client.prenom || null,
    raison_sociale: client.raisonSociale || null,
    type:           client.type || 'particulier',
    email:          client.email || null,
    telephone:      client.telephone || null,
    adresse:        client.adresse || null,
    code_postal:    client.codePostal || null,
    ville:          client.ville || null,
    notes:          client.notes || null,
  }
  const { data, error } = await supabase
    .from('clients')
    .insert(payload)
    .select()
    .single()
  return { data, error }
}

export async function updateClient(id, updates) {
  const payload = {
    nom:            updates.nom,
    prenom:         updates.prenom || null,
    raison_sociale: updates.raisonSociale || null,
    type:           updates.type || 'particulier',
    email:          updates.email || null,
    telephone:      updates.telephone || null,
    adresse:        updates.adresse || null,
    code_postal:    updates.codePostal || null,
    ville:          updates.ville || null,
    notes:          updates.notes || null,
    updated_at:     new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('clients')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function deleteClient(id) {
  const { error } = await supabase.from('clients').delete().eq('id', id)
  return { error }
}

// Recherche un client existant par nom dans l'entreprise courante (RLS filtre).
// - Si form.clientId est fourni (vient du picker), on retourne le client existant.
// - Sinon, recherche par nom (case-insensitive). Trouvé → retourné tel quel.
// - Pas trouvé → création silencieuse à partir des infos du devis.
// Best-effort : si quelque chose échoue, on retourne null sans bloquer.
export async function findOrCreateClient(entrepriseId, devisForm) {
  if (!entrepriseId) return { data: null, error: null }

  const nom = (devisForm.client || '').trim()
  if (!nom) return { data: null, error: null }

  // Cas 1 : un id explicite a été passé (sélection depuis le picker)
  if (devisForm.clientId) {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('id', devisForm.clientId)
      .maybeSingle()
    if (data) return { data, error: null }
  }

  // Cas 2 : recherche par nom (case-insensitive, exact)
  const { data: existing } = await supabase
    .from('clients')
    .select('*')
    .ilike('nom', nom)
    .limit(1)
    .maybeSingle()

  if (existing) return { data: existing, error: null }

  // Cas 3 : pas trouvé → création
  return createClient(entrepriseId, {
    nom,
    type:        'particulier',
    email:       devisForm.clientEmail || '',
    telephone:   devisForm.clientTelephone || devisForm.telephone || '',
    adresse:     devisForm.clientAdresse || '',
    codePostal:  devisForm.clientCodePostal || '',
    ville:       devisForm.clientVille || '',
  })
}

// Renvoie la liste des devis associés à un client (à venir : par client_id).
// Pour l'instant on cherche par client_nom (legacy).
export async function listDevisForClient(clientNom) {
  if (!clientNom) return { data: [], error: null }
  const { data, error } = await supabase
    .from('devis')
    .select('id, numero, client_nom, montant_ht, statut, date_emission, token_unique')
    .eq('client_nom', clientNom)
    .order('date_emission', { ascending: false })
    .limit(10)
  return { data: data ?? [], error }
}

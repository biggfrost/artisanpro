import { supabase } from './supabase'

// Assure que l'utilisateur authentifié (manager) est correctement lié à une
// entreprise.
//   1. Si profil + entreprise_id valide  -> retourne l'entreprise existante.
//   2. Sinon                             -> appelle la RPC SECURITY DEFINER
//      repair_manager_entreprise() qui crée l'entreprise + le lien
//      utilisateurs en bypassant RLS de manière contrôlée.
//
// Retourne { entreprise, profile, repaired, error }
export async function ensureManagerEntreprise(user, defaults = {}) {
  if (!user) return { entreprise: null, profile: null, repaired: false }

  // 1) Profil
  const { data: profile } = await supabase
    .from('utilisateurs')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  // 2) Si entreprise_id valide, on charge et on retourne
  if (profile?.entreprise_id) {
    const { data: ent } = await supabase
      .from('entreprise')
      .select('*')
      .eq('id', profile.entreprise_id)
      .maybeSingle()
    if (ent) return { entreprise: ent, profile, repaired: false, error: null }
  }

  // 3) Réparation via RPC (bypass RLS)
  const { data: newEntId, error: rpcErr } = await supabase.rpc(
    'repair_manager_entreprise',
    {
      p_nom:   defaults.nom   || 'Mon entreprise',
      p_email: defaults.email || user.email || null,
    }
  )

  if (rpcErr || !newEntId) {
    console.error('[ensureManagerEntreprise] RPC error:', rpcErr)
    return { entreprise: null, profile, repaired: false, error: rpcErr }
  }

  // 4) Recharge l'entreprise + le profil fraîchement créés/liés
  const [entRes, profRes] = await Promise.all([
    supabase.from('entreprise').select('*').eq('id', newEntId).maybeSingle(),
    supabase.from('utilisateurs').select('*').eq('id', user.id).maybeSingle(),
  ])

  return {
    entreprise: entRes.data,
    profile:    profRes.data ?? profile,
    repaired:   true,
    error:      null,
  }
}

// Mise à jour des champs de l'entreprise (manager seulement, RLS s'en charge).
export async function updateEntreprise(id, updates) {
  const payload = {
    nom:              updates.nom,
    siret:            updates.siret,
    adresse:          updates.adresse,
    code_postal:      updates.codePostal,
    ville:            updates.ville,
    telephone:        updates.telephone,
    email:            updates.email,
    logo_url:         updates.logoUrl,
    couleur_primaire: updates.couleurPrimaire,
    updated_at:       new Date().toISOString(),
  }
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k])
  const { data, error } = await supabase
    .from('entreprise')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

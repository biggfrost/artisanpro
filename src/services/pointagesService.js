import { supabase } from './supabase'
import { triggerPush } from './pushTrigger'

// Soft fail si géolocalisation indispo / refusée
export function tryGeolocate() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 6000, enableHighAccuracy: false, maximumAge: 60000 }
    )
  })
}

// Liste des pointages de l'ouvrier connecté entre 2 dates (RLS filtre par auth.uid())
export async function listMesPointages(fromISO, toISO) {
  let q = supabase
    .from('pointages')
    .select('id, ouvrier_id, chantier_id, heure_arrivee, heure_depart, notes, chantier:chantiers (id, nom, ville)')
    .order('heure_arrivee', { ascending: false })
  if (fromISO) q = q.gte('heure_arrivee', fromISO)
  if (toISO)   q = q.lte('heure_arrivee', toISO)
  const { data, error } = await q
  return { data: data ?? [], error }
}

// Retourne le pointage en cours (heure_depart IS NULL) s'il existe
export async function getPointageEnCours() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: null }
  const { data, error } = await supabase
    .from('pointages')
    .select('id, chantier_id, heure_arrivee, chantier:chantiers (id, nom, ville)')
    .eq('ouvrier_id', user.id)
    .is('heure_depart', null)
    .order('heure_arrivee', { ascending: false })
    .limit(1)
    .maybeSingle()
  return { data, error }
}

// Démarre un pointage : "Je suis arrivé"
export async function startPointage(chantierId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Non authentifié' } }
  const coords = await tryGeolocate()
  const payload = {
    ouvrier_id:        user.id,
    chantier_id:       chantierId,
    heure_arrivee:     new Date().toISOString(),
    latitude_arrivee:  coords?.lat ?? null,
    longitude_arrivee: coords?.lng ?? null,
  }
  const { data, error } = await supabase
    .from('pointages')
    .insert(payload)
    .select('id, chantier_id, heure_arrivee, chantier:chantiers (id, nom, ville)')
    .single()

  // Notifie les managers : ouvrier arrivé sur chantier.
  // On passe ouvrier_id → l'Edge Function résout l'entreprise.
  if (data && !error) {
    triggerPush({ type: 'INSERT', table: 'pointages', record: { ouvrier_id: user.id, chantier_id: chantierId } })
  }

  return { data, error }
}

// Termine un pointage : "Je suis parti"
export async function endPointage(pointageId) {
  const coords = await tryGeolocate()
  const payload = {
    heure_depart:     new Date().toISOString(),
    latitude_depart:  coords?.lat ?? null,
    longitude_depart: coords?.lng ?? null,
  }
  const { data, error } = await supabase
    .from('pointages')
    .update(payload)
    .eq('id', pointageId)
    .select()
    .single()
  return { data, error }
}

// ─── Côté manager : pointages d'un ouvrier précis ─────────────
// RLS autorise un manager à lire les pointages des ouvriers de son entreprise
// (policy point_select avec user_in_my_entreprise).

export async function listPointagesForOuvrier(ouvrierId, fromISO, toISO) {
  let q = supabase
    .from('pointages')
    .select('id, ouvrier_id, chantier_id, heure_arrivee, heure_depart, notes, latitude_arrivee, longitude_arrivee, chantier:chantiers (id, nom, ville)')
    .eq('ouvrier_id', ouvrierId)
    .order('heure_arrivee', { ascending: false })
  if (fromISO) q = q.gte('heure_arrivee', fromISO)
  if (toISO)   q = q.lte('heure_arrivee', toISO)
  const { data, error } = await q
  return { data: data ?? [], error }
}

export async function getPointageEnCoursForOuvrier(ouvrierId) {
  const { data, error } = await supabase
    .from('pointages')
    .select('id, chantier_id, heure_arrivee, chantier:chantiers (id, nom, ville)')
    .eq('ouvrier_id', ouvrierId)
    .is('heure_depart', null)
    .order('heure_arrivee', { ascending: false })
    .limit(1)
    .maybeSingle()
  return { data, error }
}

// Calcule la durée d'un pointage en minutes
export function dureeMinutes(pointage) {
  if (!pointage.heure_arrivee) return 0
  const start = new Date(pointage.heure_arrivee).getTime()
  const end   = pointage.heure_depart ? new Date(pointage.heure_depart).getTime() : Date.now()
  return Math.max(0, Math.round((end - start) / 60000))
}

export function fmtDuree(minutes) {
  if (!minutes) return '0h'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

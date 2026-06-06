import { supabase } from './supabase'
import { triggerPush } from './pushTrigger'
import { enqueue, isNetworkError } from './offlineQueue'

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

// Construit un pointage optimiste (affiché immédiatement hors-ligne)
function optimisticPointage(chantierId, heure) {
  return {
    id:            `pending-${Date.now()}`,
    chantier_id:   chantierId,
    heure_arrivee: heure,
    chantier:      null,
    _pending:      true,
  }
}

// Démarre un pointage : "Je suis arrivé"
export async function startPointage(chantierId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Non authentifié' } }
  const heure  = new Date().toISOString()
  const coords = await tryGeolocate()

  // Hors-ligne → on enfile et on renvoie un pointage optimiste (jamais perdu)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueue('pointage_start', { chantierId, heure, lat: coords?.lat, lng: coords?.lng })
    return { data: optimisticPointage(chantierId, heure), error: null, pending: true }
  }

  const payload = {
    ouvrier_id:        user.id,
    chantier_id:       chantierId,
    heure_arrivee:     heure,
    latitude_arrivee:  coords?.lat ?? null,
    longitude_arrivee: coords?.lng ?? null,
  }
  try {
    const { data, error } = await supabase
      .from('pointages')
      .insert(payload)
      .select('id, chantier_id, heure_arrivee, chantier:chantiers (id, nom, ville)')
      .single()
    if (error) throw error
    triggerPush({ type: 'INSERT', table: 'pointages', record: { ouvrier_id: user.id, chantier_id: chantierId } })
    return { data, error: null }
  } catch (e) {
    // Échec réseau → on enfile + optimiste plutôt que de perdre le pointage
    if (isNetworkError(e)) {
      enqueue('pointage_start', { chantierId, heure, lat: coords?.lat, lng: coords?.lng })
      return { data: optimisticPointage(chantierId, heure), error: null, pending: true }
    }
    return { data: null, error: e }
  }
}

// Termine un pointage : "Je suis parti"
export async function endPointage(pointageId) {
  const heure  = new Date().toISOString()
  const coords = await tryGeolocate()

  // Hors-ligne (ou pointage encore en attente de sync) → on enfile le départ
  if ((typeof navigator !== 'undefined' && !navigator.onLine) || String(pointageId).startsWith('pending-')) {
    enqueue('pointage_end', { heure, lat: coords?.lat, lng: coords?.lng })
    return { data: { id: pointageId, heure_depart: heure, _pending: true }, error: null, pending: true }
  }

  const payload = {
    heure_depart:     heure,
    latitude_depart:  coords?.lat ?? null,
    longitude_depart: coords?.lng ?? null,
  }
  try {
    const { data, error } = await supabase
      .from('pointages').update(payload).eq('id', pointageId).select().single()
    if (error) throw error
    return { data, error: null }
  } catch (e) {
    if (isNetworkError(e)) {
      enqueue('pointage_end', { heure, lat: coords?.lat, lng: coords?.lng })
      return { data: { id: pointageId, heure_depart: heure, _pending: true }, error: null, pending: true }
    }
    return { data: null, error: e }
  }
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

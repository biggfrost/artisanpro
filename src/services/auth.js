import { supabase } from './supabase'

// Wrap a promise with a hard timeout so the UI never hangs forever.
function withTimeout(promise, ms, label = 'op') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`[auth] timeout ${label} (${ms}ms)`)), ms)
    ),
  ])
}

export async function signUpManager({ email, password, entrepriseNom, prenom, nom, telephone }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role:           'manager',
        entreprise_nom: entrepriseNom,
        nom,
        prenom,
        telephone,
      },
    },
  })
  return { data, error }
}

export async function signInWithPassword({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

// Cache d'authentification (pour rester connecté hors-ligne sans appel réseau)
const AUTH_CACHE = 'artisanpro_auth_cache'
function saveAuthCache(state) {
  try { localStorage.setItem(AUTH_CACHE, JSON.stringify(state)) } catch { /* quota */ }
}
function loadAuthCache() {
  try { return JSON.parse(localStorage.getItem(AUTH_CACHE) || 'null') } catch { return null }
}
export function clearAuthCache() {
  try { localStorage.removeItem(AUTH_CACHE) } catch { /* noop */ }
}

export async function signOut() {
  clearAuthCache()   // important : ne pas restaurer une session après déconnexion
  const { error } = await supabase.auth.signOut()
  return { error }
}

// Charge le profil métier (utilisateurs + entreprise) du user authentifié.
// Robuste : si les tables n'existent pas encore (SQL setup pas exécuté),
// ou si la requête traîne, on retourne quand même un état utilisable.
export async function fetchSessionProfile() {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine

  // Hors-ligne : on s'appuie sur le cache d'auth pour rester connecté SANS
  // appel réseau (qui resterait bloqué). L'utilisateur garde l'accès à l'app.
  if (offline) {
    const cache = loadAuthCache()
    if (cache?.user) return cache
  }

  let session = null
  try {
    const result = await withTimeout(supabase.auth.getSession(), 5000, 'getSession')
    session = result?.data?.session ?? null
  } catch (e) {
    console.warn(e.message)
    // getSession a échoué (réseau ?) → on retombe sur le cache si disponible
    const cache = loadAuthCache()
    if (cache?.user) return cache
    return { user: null, profile: null, entreprise: null }
  }

  if (!session?.user) {
    // Pas de session locale valide → vraiment déconnecté
    return { user: null, profile: null, entreprise: null }
  }

  const cache = loadAuthCache()

  let profile = null
  try {
    const { data, error } = await withTimeout(
      supabase.from('utilisateurs').select('*').eq('id', session.user.id).maybeSingle(),
      5000, 'fetch utilisateurs'
    )
    if (error) console.warn('[auth] utilisateurs:', error.message)
    profile = data
  } catch (e) {
    console.warn(e.message)
  }
  // Repli sur le profil mis en cache si le réseau a échoué
  if (!profile && cache?.profile) profile = cache.profile

  let entreprise = null
  if (profile?.entreprise_id) {
    try {
      const { data } = await withTimeout(
        supabase.from('entreprise').select('*').eq('id', profile.entreprise_id).maybeSingle(),
        5000, 'fetch entreprise'
      )
      entreprise = data
    } catch (e) {
      console.warn(e.message)
    }
  }
  if (!entreprise && cache?.entreprise) entreprise = cache.entreprise

  const state = { user: session.user, profile, entreprise }
  // Met à jour le cache uniquement si on a un profil complet (état fiable)
  if (profile) saveAuthCache(state)
  return state
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session))
}

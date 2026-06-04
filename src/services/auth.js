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

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

// Charge le profil métier (utilisateurs + entreprise) du user authentifié.
// Robuste : si les tables n'existent pas encore (SQL setup pas exécuté),
// ou si la requête traîne, on retourne quand même un état utilisable.
export async function fetchSessionProfile() {
  let session = null
  try {
    const result = await withTimeout(supabase.auth.getSession(), 5000, 'getSession')
    session = result?.data?.session ?? null
  } catch (e) {
    console.warn(e.message)
    return { user: null, profile: null, entreprise: null }
  }

  if (!session?.user) return { user: null, profile: null, entreprise: null }

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

  return { user: session.user, profile, entreprise }
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session))
}

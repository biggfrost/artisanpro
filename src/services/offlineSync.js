import { supabase } from './supabase'
import { flushQueue } from './offlineQueue'
import { envoyerMessage } from './mesMessagesService'

// Registre des handlers : comment rejouer chaque type d'action en file.
const HANDLERS = {
  // Pointage arrivée
  pointage_start: async ({ chantierId, heure, lat, lng }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('no-user')
    const { error } = await supabase.from('pointages').insert({
      ouvrier_id:        user.id,
      chantier_id:       chantierId,
      heure_arrivee:     heure || new Date().toISOString(),
      latitude_arrivee:  lat ?? null,
      longitude_arrivee: lng ?? null,
    })
    if (error) throw error
  },

  // Pointage départ (par chantier en cours de l'ouvrier)
  pointage_end: async ({ heure, lat, lng }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('no-user')
    // Termine le pointage ouvert le plus récent
    const { data: open } = await supabase
      .from('pointages')
      .select('id')
      .eq('ouvrier_id', user.id)
      .is('heure_depart', null)
      .order('heure_arrivee', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!open) return // rien à fermer
    const { error } = await supabase.from('pointages').update({
      heure_depart:     heure || new Date().toISOString(),
      latitude_depart:  lat ?? null,
      longitude_depart: lng ?? null,
    }).eq('id', open.id)
    if (error) throw error
  },

  // Message texte (noQueue: ne pas ré-enfiler en cas d'échec pendant la synchro)
  message_send: async ({ destinataireId, contenu }) => {
    const { error } = await envoyerMessage(destinataireId, contenu, null, { noQueue: true })
    if (error) throw error
  },
}

export function flushOfflineQueue() {
  return flushQueue(HANDLERS)
}

// Branche la synchro automatique : à la reconnexion, au focus, et au démarrage.
export function startOfflineSync() {
  const run = () => { if (navigator.onLine) flushOfflineQueue() }
  window.addEventListener('online', run)
  window.addEventListener('focus', run)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) run() })
  // Premier essai au démarrage (léger délai pour laisser la session se charger)
  setTimeout(run, 2500)
  return () => {
    window.removeEventListener('online', run)
    window.removeEventListener('focus', run)
  }
}

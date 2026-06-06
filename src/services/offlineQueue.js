// File d'attente hors-ligne générique.
// Les actions qui échouent faute de réseau sont stockées en localStorage,
// puis rejouées automatiquement à la reconnexion.
//
// Principe : le chemin EN LIGNE reste inchangé. On n'enfile QUE si l'appareil
// est hors-ligne ou si l'appel échoue sur une erreur réseau.

const KEY = 'artisanpro_offline_queue'
const EVENT = 'offline-queue-changed'

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function write(q) {
  localStorage.setItem(KEY, JSON.stringify(q))
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT))
}

// Ajoute une action à la file. `type` identifie le handler, `payload` les args.
export function enqueue(type, payload) {
  const q = read()
  const item = {
    id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
  }
  q.push(item)
  write(q)
  return item
}

export function pendingCount() { return read().length }
export function getQueue()     { return read() }
export function clearQueue()   { write([]) }

// Détecte une erreur "réseau" (à enfiler) vs une vraie erreur métier (à remonter).
export function isNetworkError(error) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const m = (error?.message || '').toLowerCase()
  return m.includes('failed to fetch') || m.includes('networkerror') ||
         m.includes('network request failed') || m.includes('load failed') ||
         m.includes('fetch')
}

let flushing = false

// Rejoue la file avec un registre de handlers { type: async (payload) => {...} }.
// S'arrête au 1er échec réseau (on retentera plus tard). Supprime les actions
// réussies ou de type inconnu.
export async function flushQueue(handlers) {
  if (flushing) return { flushed: 0 }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { flushed: 0 }
  flushing = true
  let flushed = 0
  try {
    const items = read()
    for (const item of items) {
      const handler = handlers[item.type]
      if (!handler) {
        // type inconnu → on retire pour ne pas bloquer la file
        write(read().filter((x) => x.id !== item.id))
        continue
      }
      try {
        await handler(item.payload)
        write(read().filter((x) => x.id !== item.id))
        flushed++
      } catch (e) {
        if (isNetworkError(e)) break        // toujours hors-ligne → on garde le reste
        // erreur métier définitive → on retire pour ne pas boucler
        write(read().filter((x) => x.id !== item.id))
      }
    }
  } finally {
    flushing = false
  }
  return { flushed }
}

export const OFFLINE_QUEUE_EVENT = EVENT

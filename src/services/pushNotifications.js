import { supabase } from './supabase'

// Clé publique VAPID (sûre à exposer côté client).
// La clé PRIVÉE correspondante est stockée comme secret dans l'Edge Function.
export const VAPID_PUBLIC_KEY = 'BKqb8vYZ6OvM9SKQ8XyohFmiBouhiCjrBgv6-oroyNVCj2-6ABCn4MHcGy4XN5Mp-S342lzvmtRGtQ_KmPXKEjU'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// Demande la permission + crée/enregistre l'abonnement push pour l'utilisateur courant.
// Idempotent : ré-enregistre proprement l'abonnement existant.
export async function subscribeToPush() {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' }

  // Permission
  let perm = Notification.permission
  if (perm === 'default') perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, reason: 'denied' }

  // Service worker prêt
  const reg = await navigator.serviceWorker.ready

  // Abonnement existant ou nouveau
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  // Sauvegarde côté Supabase
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'no-user' }

  const json = sub.toJSON()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id:    user.id,
      endpoint:   json.endpoint,
      p256dh:     json.keys?.p256dh,
      auth:       json.keys?.auth,
      user_agent: navigator.userAgent.slice(0, 200),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' })

  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}

// Désabonnement (paramètres → couper les notifications)
export async function unsubscribeFromPush() {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe().catch(() => {})
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).catch(() => {})
}

// État courant : l'utilisateur est-il abonné ?
export async function isPushSubscribed() {
  if (!pushSupported()) return false
  if (Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return !!sub
}

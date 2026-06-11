// Service Worker ArtisanPro — basé sur Workbox (via vite-plugin-pwa).
// Workbox gère le préchargement VERSIONNÉ et le nettoyage ATOMIQUE des
// anciens caches → l'app ne se dégrade plus avec le temps.
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { clientsClaim } from 'workbox-core'

// Active la nouvelle version dès qu'elle est prête + prend le contrôle.
self.skipWaiting()
clientsClaim()

// ── Précache : tous les fichiers du build (injecté par vite-plugin-pwa) ──
// Chaque fichier est versionné (revision) → pas de mélange entre builds.
precacheAndRoute(self.__WB_MANIFEST || [])
cleanupOutdatedCaches()

// Nettoie les anciens caches faits main (versions précédentes de l'app)
// pour repartir totalement propre sur les appareils déjà installés.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('artisanpro-')).map((k) => caches.delete(k)))
    )
  )
})

// ── SPA : toute navigation → index.html précaché (fonctionne hors-ligne) ──
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), {
  // Ne pas intercepter les ressources/API
  denylist: [/^\/api\//, /^\/auth\//],
}))

// ── Données Supabase (hors authentification) : réseau d'abord, repli cache ──
registerRoute(
  ({ url }) => url.hostname.includes('supabase') && !url.pathname.startsWith('/auth/'),
  new NetworkFirst({ cacheName: 'supabase-data', networkTimeoutSeconds: 6 })
)

// ── Météo : réseau d'abord, repli cache ──
registerRoute(
  ({ url }) => url.hostname.includes('open-meteo'),
  new NetworkFirst({ cacheName: 'weather', networkTimeoutSeconds: 6 })
)

// NB : les requêtes Supabase /auth/ n'ont AUCUNE route → gérées nativement par
// le navigateur (jamais de fausse réponse hors-ligne qui corromprait la session).

// ── Push : notification reçue (app fermée ou en arrière-plan) ───────
self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} }
  catch { payload = { title: 'ArtisanPro', body: event.data ? event.data.text() : '' } }
  event.waitUntil(self.registration.showNotification(payload.title || 'ArtisanPro', {
    body:    payload.body || '',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-72.png',
    tag:     payload.tag || undefined,
    data:    { url: payload.url || '/' },
    vibrate: [60, 30, 60],
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if ('focus' in win) {
          win.focus()
          if ('navigate' in win && targetUrl) win.navigate(targetUrl).catch(() => {})
          return
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    })
  )
})

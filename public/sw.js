// Service Worker ArtisanPro
// Les marqueurs ci-dessous sont remplacés au build par
// scripts/inject-sw-assets.mjs (liste réelle des fichiers générés).
// En dev, ils restent tels quels → on retombe sur des valeurs sûres.

const BUILD_ID = 'BUILD_ID_PLACEHOLDER'
let PRECACHE = []
try { PRECACHE = PRECACHE_MANIFEST_PLACEHOLDER } catch (_e) { PRECACHE = [] }

const STATIC_CACHE = `artisanpro-static-${BUILD_ID}`
const DATA_CACHE   = `artisanpro-data-${BUILD_ID}`

// Toujours s'assurer que l'app shell minimal est là
const SHELL = ['/', '/index.html', '/manifest.json']
const TO_PRECACHE = Array.from(new Set([...SHELL, ...PRECACHE]))

// ── Install : précharge TOUT le build (résilient : un échec ne bloque pas) ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      Promise.allSettled(
        TO_PRECACHE.map((url) =>
          fetch(url, { cache: 'no-cache' })
            .then((res) => { if (res.ok) return cache.put(url, res) })
            .catch(() => {})
        )
      )
    ).then(() => self.skipWaiting())
  )
})

// ── Activate : supprime les anciens caches (autres build) ──────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== STATIC_CACHE && k !== DATA_CACHE).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch ───────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Navigation (SPA) : réseau d'abord, repli sur l'index.html en cache (hors-ligne)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () =>
        (await caches.match('/index.html')) || (await caches.match('/')) ||
        new Response('Hors-ligne', { status: 503, headers: { 'Content-Type': 'text/plain' } })
      )
    )
    return
  }

  // API Supabase / météo : réseau d'abord, repli cache
  if (url.hostname.includes('supabase') || url.hostname.includes('open-meteo')) {
    event.respondWith(networkFirst(request))
    return
  }

  // Assets de l'app (même origine) : cache d'abord (préchargés → dispo hors-ligne)
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Autres (CDN polices…) : stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request))
})

// ── Mise à jour silencieuse ────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// ── Push : notification reçue (app fermée ou en arrière-plan) ───────
self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} }
  catch { payload = { title: 'ArtisanPro', body: event.data ? event.data.text() : '' } }
  const title = payload.title || 'ArtisanPro'
  event.waitUntil(self.registration.showNotification(title, {
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
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if ('focus' in win) {
          win.focus()
          if ('navigate' in win && targetUrl) win.navigate(targetUrl).catch(() => {})
          return
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl)
    })
  )
})

// ── Stratégies ────────────────────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const res = await fetch(request)
    if (res && res.status === 200) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, res.clone())
    }
    return res
  } catch {
    // Hors-ligne et non caché : on tente l'index (utile pour les chunks de route)
    return (await caches.match('/index.html')) ||
           new Response('', { status: 504 })
  }
}

async function networkFirst(request) {
  try {
    const res = await fetch(request)
    if (res && res.status === 200) {
      const cache = await caches.open(DATA_CACHE)
      cache.put(request, res.clone())
    }
    return res
  } catch {
    return (await caches.match(request)) || new Response('[]', {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  const fetchPromise = fetch(request)
    .then((res) => { if (res && res.status === 200) cache.put(request, res.clone()); return res })
    .catch(() => cached)
  return cached || fetchPromise
}

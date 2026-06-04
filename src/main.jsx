import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { testSupabaseConnection } from './services/supabase'

// ── Service Worker — mise à jour agressive ────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none', // force le navigateur à toujours vérifier le SW sur le serveur
      })

      // Dès qu'un nouveau SW est trouvé, on l'active immédiatement
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing
        if (!newSW) return

        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed') {
            // Envoie SKIP_WAITING qu'il y ait un ancien SW actif ou non
            newSW.postMessage({ type: 'SKIP_WAITING' })
          }
        })
      })

      // Quand le SW prend le contrôle, recharge la page pour servir les nouveaux fichiers
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true
          window.location.reload()
        }
      })

      // Vérifie immédiatement si une mise à jour est disponible
      reg.update().catch(() => {})

    } catch { /* silencieux si SW non supporté */ }
  })
}

testSupabaseConnection()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

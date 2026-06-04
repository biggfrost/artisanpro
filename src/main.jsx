import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { testSupabaseConnection } from './services/supabase'

// Service Worker avec mise à jour automatique en arrière-plan
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Mise à jour silencieuse quand un nouveau SW est disponible
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing
        newSW?.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            newSW.postMessage({ type: 'SKIP_WAITING' })
          }
        })
      })
    }).catch(() => {})
  })
}

// Vérification des tables Supabase au démarrage
testSupabaseConnection()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

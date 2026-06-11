import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'
import { testSupabaseConnection } from './services/supabase'
import { startOfflineSync } from './services/offlineSync'

// Enregistrement du service worker (géré par Workbox via vite-plugin-pwa).
// La mise à jour s'applique proprement, sans mélange d'anciens fichiers en cache.
registerSW({ immediate: true })

// Vérification des tables Supabase au démarrage
testSupabaseConnection()

// Synchro auto des actions hors-ligne (pointages, messages) à la reconnexion
startOfflineSync()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

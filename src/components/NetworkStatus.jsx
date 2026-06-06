import { useEffect, useState } from 'react'
import { WifiOff, Wifi, RefreshCw } from 'lucide-react'
import { pendingCount, OFFLINE_QUEUE_EVENT } from '../services/offlineQueue'

export default function NetworkStatus() {
  const [isOnline,   setIsOnline]   = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [showOnline, setShowOnline] = useState(false)
  const [pending,    setPending]    = useState(pendingCount())

  useEffect(() => {
    function onOnline() {
      setIsOnline(true)
      setShowOnline(true)
      setTimeout(() => setShowOnline(false), 3000)
    }
    function onOffline() {
      setIsOnline(false)
      setShowOnline(false)
    }
    function onQueueChange() { setPending(pendingCount()) }

    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener(OFFLINE_QUEUE_EVENT, onQueueChange)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener(OFFLINE_QUEUE_EVENT, onQueueChange)
    }
  }, [])

  // Rien à afficher : en ligne, sans flash récent, et aucune action en attente
  if (isOnline && !showOnline && pending === 0) return null

  // Bannière hors-ligne
  if (!isOnline) {
    return (
      <Banner color="bg-red-600">
        <WifiOff size={13} />
        Hors-ligne · vos actions sont enregistrées
        {pending > 0 && <span className="font-bold"> · {pending} en attente</span>}
      </Banner>
    )
  }

  // En ligne avec des actions encore en cours de synchro
  if (pending > 0) {
    return (
      <Banner color="bg-amber-500">
        <RefreshCw size={13} className="animate-spin" />
        Synchronisation… {pending} action{pending > 1 ? 's' : ''}
      </Banner>
    )
  }

  // Flash "connexion rétablie"
  return (
    <Banner color="bg-emerald-600">
      <Wifi size={13} />
      Connexion rétablie — synchronisation terminée
    </Banner>
  )
}

function Banner({ color, children }) {
  return (
    <div className={`fixed top-0 left-0 right-0 z-[9999] flex justify-center transition-all duration-300 ${color}`}>
      <div className="flex items-center gap-2 max-w-lg w-full px-4 py-2 text-xs font-bold text-white">
        {children}
      </div>
    </div>
  )
}

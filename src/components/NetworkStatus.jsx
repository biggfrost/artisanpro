import { useEffect, useState } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

export default function NetworkStatus() {
  const [isOnline,   setIsOnline]   = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [showOnline, setShowOnline] = useState(false)

  useEffect(() => {
    function onOnline() {
      setIsOnline(true)
      setShowOnline(true)
      setTimeout(() => setShowOnline(false), 2500)
    }
    function onOffline() {
      setIsOnline(false)
      setShowOnline(false)
    }
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  if (isOnline && !showOnline) return null

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] flex justify-center transition-all duration-300 ${
        isOnline ? 'bg-emerald-600' : 'bg-red-600'
      }`}
    >
      <div className="flex items-center gap-2 max-w-lg w-full px-4 py-2 text-xs font-bold text-white">
        {isOnline
          ? <><Wifi size={13} />Connexion rétablie — synchronisation en cours…</>
          : <><WifiOff size={13} />Hors-ligne · Les données déjà chargées restent accessibles</>
        }
      </div>
    </div>
  )
}

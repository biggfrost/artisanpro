import { useEffect, useState } from 'react'

export default function SplashScreen({ onDone }) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 1500)
    const t2 = setTimeout(onDone, 1900)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  return (
    <div
      style={{ transition: 'opacity 400ms ease' }}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-primary-900 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Logo */}
      <div className="flex flex-col items-center gap-5 animate-splash-in">
        <div className="w-24 h-24 rounded-[2rem] bg-accent-500 flex items-center justify-center shadow-2xl">
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
            {/* Casque stylisé */}
            <path d="M10 40L26 12L42 40H10Z" fill="white" fillOpacity="0.95" />
            <circle cx="26" cy="33" r="5" fill="#1e3a5f" />
            <rect x="20" y="38" width="12" height="3" rx="1.5" fill="white" fillOpacity="0.5" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-white tracking-tight">ArtisanPro</p>
          <p className="text-sm text-blue-300 mt-1 font-medium">Devis · Chantiers · Équipe</p>
        </div>
      </div>

      {/* Barre de chargement */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-36">
        <div className="h-[3px] bg-white/15 rounded-full overflow-hidden">
          <div className="h-full bg-accent-500 rounded-full animate-splash-bar" />
        </div>
      </div>

      {/* Version */}
      <p className="absolute bottom-8 text-[11px] text-white/30 font-medium tracking-wide">v2.0</p>
    </div>
  )
}

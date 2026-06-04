import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

// Affiche un bandeau discret si l'app n'est pas encore installée en PWA
export default function InstallBanner() {
  const [prompt, setPrompt]     = useState(null)
  const [visible, setVisible]   = useState(false)
  const [dismissed, setDismissed] = useState(
    () => !!localStorage.getItem('artisanpro_install_dismissed')
  )

  useEffect(() => {
    if (dismissed) return
    // L'app est déjà installée — on ne montre rien
    if (window.matchMedia('(display-mode: standalone)').matches) return

    function onBeforeInstall(e) {
      e.preventDefault()
      setPrompt(e)
      // Délai pour laisser l'app se charger
      setTimeout(() => setVisible(true), 8000)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [dismissed])

  async function install() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setVisible(false)
      setPrompt(null)
    }
  }

  function dismiss() {
    setVisible(false)
    localStorage.setItem('artisanpro_install_dismissed', '1')
    setDismissed(true)
  }

  if (!visible || !prompt) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[300] max-w-lg mx-auto animate-slide-up">
      <div className="bg-primary-900 text-white rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-2xl">
        <div className="w-9 h-9 rounded-xl bg-accent-500 flex items-center justify-center flex-shrink-0">
          <Download size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">Installez ArtisanPro</p>
          <p className="text-xs text-blue-300 mt-0.5">Accès direct depuis votre écran d'accueil</p>
        </div>
        <button
          onClick={install}
          className="flex-shrink-0 bg-accent-500 text-white text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-transform"
        >
          Installer
        </button>
        <button onClick={dismiss} className="flex-shrink-0 text-white/50 hover:text-white/80 transition-colors">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

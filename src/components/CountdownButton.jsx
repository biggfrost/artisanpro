import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

// Bouton qui ne devient cliquable qu'après un compte à rebours.
// Utile pour les actions destructrices (suppression) : prévient les clics
// accidentels et donne le temps d'annuler.
//
// Props :
//   - countdown : nombre de secondes avant activation (défaut 3)
//   - loading   : affiche un spinner à la place du texte si true
//   - onClick   : handler du clic, appelé seulement après le countdown
//   - children  : contenu du bouton (texte)
//   - className : classes Tailwind, doit gérer le style disabled:
//   - resetKey  : changer cette valeur pour relancer le countdown (par ex.
//                 à chaque ouverture de modal)
export default function CountdownButton({
  countdown = 3,
  loading = false,
  onClick,
  children,
  className = '',
  resetKey,
}) {
  const [remaining, setRemaining] = useState(countdown)

  // Reset lorsque le resetKey change ou au montage
  useEffect(() => {
    setRemaining(countdown)
  }, [countdown, resetKey])

  // Décrémentation chaque seconde
  useEffect(() => {
    if (remaining <= 0) return
    const id = setTimeout(() => setRemaining((r) => Math.max(0, r - 1)), 1000)
    return () => clearTimeout(id)
  }, [remaining])

  const ready = remaining === 0
  const isDisabled = !ready || loading

  return (
    <button
      type="button"
      onClick={ready ? onClick : undefined}
      disabled={isDisabled}
      className={className}
    >
      {loading ? (
        <Loader2 size={15} className="animate-spin" />
      ) : ready ? (
        children
      ) : (
        <span className="inline-flex items-center gap-1.5">
          {children}
          <span className="text-[10px] opacity-80 tabular-nums">({remaining})</span>
        </span>
      )}
    </button>
  )
}

import { Plus } from 'lucide-react'

// Bouton flottant principal pour l'action contextuelle de la page.
// Positionné dans la bande max-w-lg du layout.
export default function FloatingActionButton({
  onClick,
  icon: Icon = Plus,
  label = 'Ajouter',
  variant = 'accent',   // 'accent' (orange) | 'primary' (bleu)
}) {
  const palette = variant === 'primary'
    ? 'bg-primary-900 hover:bg-primary-800'
    : 'bg-accent-500 hover:bg-accent-600'

  return (
    // Le wrapper fixed + max-w-lg permet de rester dans le conteneur centré
    <div className="fixed bottom-20 left-0 right-0 z-40 pointer-events-none max-w-lg mx-auto">
      <div className="relative pointer-events-none">
        <button
          onClick={onClick}
          aria-label={label}
          title={label}
          className={`absolute right-5 bottom-0 pointer-events-auto w-14 h-14 rounded-full text-white shadow-xl active:scale-95 transition-all flex items-center justify-center ${palette}`}
        >
          <Icon size={24} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

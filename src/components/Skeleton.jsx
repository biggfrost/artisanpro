// Placeholders animés pour le chargement des listes/cartes.
// Plus engageant qu'un spinner — donne une idée de la structure à venir.

// Re-export pour compatibilité
export { SkeletonCard as Skeleton }

const baseCls = 'bg-slate-200 animate-pulse rounded-md'

export function SkeletonBox({ className = '' }) {
  return <div className={`${baseCls} ${className}`} />
}

// Card type devis/chantier/client : 4 lignes, ~120px de haut
export function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-card space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonBox className="h-4 w-1/2" />
        <SkeletonBox className="h-5 w-16 rounded-full" />
      </div>
      <SkeletonBox className="h-3 w-2/3" />
      <SkeletonBox className="h-3 w-3/4" />
      <div className="flex items-center justify-between pt-1">
        <SkeletonBox className="h-5 w-20" />
        <div className="flex gap-1.5">
          <SkeletonBox className="h-8 w-8 rounded-xl" />
          <SkeletonBox className="h-8 w-8 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

// Liste verticale de cards
export function SkeletonCardList({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )
}

// Ligne compacte (pour Messages, Pointages, etc.)
export function SkeletonRow() {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-3 flex items-center gap-3">
      <SkeletonBox className="w-11 h-11 rounded-xl" />
      <div className="flex-1 space-y-1.5">
        <SkeletonBox className="h-3.5 w-1/2" />
        <SkeletonBox className="h-3 w-3/4" />
      </div>
    </div>
  )
}

export function SkeletonRowList({ count = 4 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  )
}

// Stat card du dashboard
export function SkeletonStat() {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-card">
      <SkeletonBox className="w-7 h-7 rounded-lg mb-2" />
      <SkeletonBox className="h-5 w-12 mb-1" />
      <SkeletonBox className="h-3 w-20" />
    </div>
  )
}

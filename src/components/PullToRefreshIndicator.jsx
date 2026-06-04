import { Loader2, ArrowDown } from 'lucide-react'

export default function PullToRefreshIndicator({ pullDistance, refreshing, isTriggered }) {
  if (pullDistance === 0 && !refreshing) return null

  return (
    <div
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] pointer-events-none transition-opacity duration-150"
      style={{
        opacity: Math.min(pullDistance / 50, 1),
        transform: `translate(-50%, ${Math.min(pullDistance / 2, 30)}px)`,
      }}
    >
      <div className="bg-white shadow-lg rounded-full px-4 py-2 flex items-center gap-2 text-xs font-semibold text-primary-900 border border-slate-200">
        {refreshing ? (
          <><Loader2 size={14} className="animate-spin" />Actualisation…</>
        ) : isTriggered ? (
          <><ArrowDown size={14} className="rotate-180 transition-transform" />Lâcher pour rafraîchir</>
        ) : (
          <><ArrowDown size={14} className="transition-transform" />Tirer pour rafraîchir</>
        )}
      </div>
    </div>
  )
}

import { Plus } from 'lucide-react'

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Icon size={24} className="text-slate-400" strokeWidth={1.5} />
        </div>
      )}
      <p className="text-base font-semibold text-slate-700 mb-1">{title}</p>
      {description && <p className="text-sm text-slate-400 mb-6">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus size={16} />
          {action.label}
        </button>
      )}
    </div>
  )
}

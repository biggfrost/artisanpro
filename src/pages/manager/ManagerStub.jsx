import { Construction } from 'lucide-react'

// Stub Manager Phase 1 — sections "Ouvriers" et "Clients" à implémenter
// dans les Phases 2-3. La structure auth + routing reste validée.
export default function ManagerStub({ title, subtitle }) {
  return (
    <div className="px-4 pt-12 pb-6">
      <h1 className="text-2xl font-bold text-primary-900 mb-1">{title}</h1>
      {subtitle && <p className="text-sm text-slate-500 mb-5">{subtitle}</p>}

      <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center mt-4">
        <Construction size={32} className="mx-auto text-slate-300 mb-3" />
        <p className="text-sm font-semibold text-slate-700">Bientôt disponible</p>
        <p className="text-xs text-slate-400 mt-1">
          Cette section sera activée dans la prochaine phase.
        </p>
      </div>
    </div>
  )
}


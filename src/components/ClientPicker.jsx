import { useMemo, useState } from 'react'
import { Search, Loader2, User, Building2, MapPin, Users, X } from 'lucide-react'
import { useClients } from '../hooks/useClients'

// Modal de sélection d'un client existant. Renvoie l'objet client complet
// (avec id, nom, prenom, raison_sociale, telephone, email, adresse…)
// via le callback onSelect.
export default function ClientPicker({ isOpen, onClose, onSelect }) {
  const { clients, loading } = useClients()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = (search || '').toLowerCase().trim()
    if (!q) return clients
    return clients.filter((c) => {
      return (
        (c.nom || '').toLowerCase().includes(q) ||
        (c.prenom || '').toLowerCase().includes(q) ||
        (c.raison_sociale || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.ville || '').toLowerCase().includes(q)
      )
    })
  }, [clients, search])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Choisir un client</h2>
            <p className="text-xs text-slate-500">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-100">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, ville, email…"
              autoFocus
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-primary-700 focus:ring-2 focus:ring-primary-900/10"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="py-10 flex justify-center">
              <Loader2 size={20} className="animate-spin text-primary-700" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center">
              <Users size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">
                {search ? 'Aucun client ne correspond' : 'Aucun client enregistré'}
              </p>
              {!search && (
                <p className="text-xs text-slate-400 mt-1">
                  Créez vos clients depuis l'onglet « Clients »
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((c) => {
                const isPro = c.type === 'professionnel'
                const displayName = isPro && c.raison_sociale
                  ? c.raison_sociale
                  : [c.prenom, c.nom].filter(Boolean).join(' ') || c.nom || '—'
                return (
                  <button key={c.id}
                    onClick={() => { onSelect(c); onClose() }}
                    className="w-full flex items-center gap-3 bg-white border border-slate-100 hover:border-primary-200 hover:bg-slate-50 rounded-xl p-3 text-left transition-colors">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isPro ? 'bg-violet-50' : 'bg-blue-50'
                    }`}>
                      {isPro
                        ? <Building2 size={16} className="text-violet-600" />
                        : <User      size={16} className="text-blue-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
                      <div className="flex flex-wrap gap-x-2 gap-y-0">
                        {c.email && <span className="text-xs text-slate-500 truncate">{c.email}</span>}
                        {c.ville && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-slate-500">
                            <MapPin size={9} />{c.ville}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import {
  HardHat, MapPin, ChevronRight, Loader2, X, FileText, Save,
  Construction, CheckCircle, AlertCircle,
} from 'lucide-react'
import { useMesAssignations } from '../../hooks/useMesAssignations'
import { supabase } from '../../services/supabase'

const STATUTS = {
  planifie: { label: 'Planifié',  color: 'bg-amber-50 text-amber-700 border-amber-200',     dot: 'bg-amber-500'   },
  en_cours: { label: 'En cours',  color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  termine:  { label: 'Terminé',   color: 'bg-slate-100 text-slate-600 border-slate-200',    dot: 'bg-slate-400'   },
  annule:   { label: 'Annulé',    color: 'bg-red-50 text-red-600 border-red-200',           dot: 'bg-red-400'     },
}

export default function OuvrierChantiers() {
  const { assignations, loading, refresh } = useMesAssignations()
  const [detail, setDetail] = useState(null)

  // Dé-doublonne par chantier_id : un chantier n'apparaît qu'une fois même
  // avec plusieurs assignations.
  const chantiers = useMemo(() => {
    const map = new Map()
    for (const a of assignations) {
      if (!a.chantier) continue
      if (a.chantier.statut === 'annule' || a.chantier.statut === 'termine') continue
      if (!map.has(a.chantier.id)) map.set(a.chantier.id, a.chantier)
    }
    return Array.from(map.values())
  }, [assignations])

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="mb-5">
        <p className="text-sm text-slate-500 font-medium">Travaux assignés</p>
        <h1 className="text-2xl font-bold text-primary-900">Mes chantiers</h1>
        <p className="text-xs text-slate-400 mt-0.5">{chantiers.length} chantier{chantiers.length > 1 ? 's' : ''} en cours</p>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 size={24} className="animate-spin text-primary-700" /></div>
      ) : chantiers.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-8 text-center">
          <Construction size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-700">Aucun chantier en cours</p>
          <p className="text-xs text-slate-400 mt-1">Demandez à votre manager de vous en assigner un.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {chantiers.map((c) => (
            <ChantierCard key={c.id} chantier={c} onClick={() => setDetail(c)} />
          ))}
        </div>
      )}

      {detail && (
        <ChantierDetailModal
          chantier={detail}
          onClose={() => setDetail(null)}
          onSaved={() => { refresh(); setDetail(null) }}
        />
      )}
    </div>
  )
}

function ChantierCard({ chantier, onClick }) {
  const statut = STATUTS[chantier.statut] || STATUTS.planifie
  const avancement = chantier.avancement ?? 0
  return (
    <button onClick={onClick}
      className="w-full bg-white border border-slate-100 rounded-2xl p-4 shadow-card text-left hover:border-accent-200 active:scale-[0.99] transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-slate-900 truncate">{chantier.nom}</h3>
          {chantier.client_nom && <p className="text-xs text-slate-500 mt-0.5">{chantier.client_nom}</p>}
          {chantier.ville && (
            <p className="text-xs text-slate-500 inline-flex items-center gap-1 mt-1">
              <MapPin size={11} />{chantier.ville}
            </p>
          )}
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${statut.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statut.dot}`} />
          {statut.label}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-accent-500 to-accent-600 transition-all" style={{ width: `${avancement}%` }} />
        </div>
        <span className="text-xs font-bold text-slate-700 tabular-nums">{avancement}%</span>
        <ChevronRight size={16} className="text-slate-400" />
      </div>
    </button>
  )
}

// ── Modal de détail + édition avancement + notes terrain ──
function ChantierDetailModal({ chantier, onClose, onSaved }) {
  const [avancement, setAvancement] = useState(chantier.avancement ?? 0)
  const [notesTerrain, setNotesTerrain] = useState(chantier.notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const [saved, setSaved]   = useState(false)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('chantiers')
      .update({
        avancement,
        notes:      notesTerrain || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chantier.id)
    setSaving(false)
    if (error) {
      setError(error.message)
    } else {
      setSaved(true)
      setTimeout(() => { onSaved?.() }, 800)
    }
  }

  const adresseComplete = [chantier.adresse, chantier.code_postal, chantier.ville].filter(Boolean).join(', ')

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between z-10">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 truncate">{chantier.nom}</h2>
            {chantier.client_nom && <p className="text-xs text-slate-500">{chantier.client_nom}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {adresseComplete && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Adresse</p>
              <p className="text-sm text-slate-800 inline-flex items-start gap-1.5">
                <MapPin size={14} className="text-accent-600 mt-0.5 flex-shrink-0" />
                <span>{adresseComplete}</span>
              </p>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresseComplete)}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-block mt-2 text-xs font-bold text-primary-700 hover:text-primary-900">
                Ouvrir dans Maps →
              </a>
            </div>
          )}

          {chantier.description && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1 inline-flex items-center gap-1">
                <FileText size={11} />Travaux à effectuer
              </p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{chantier.description}</p>
            </div>
          )}

          {/* Slider avancement éditable */}
          <div className="bg-white border border-accent-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-slate-800 inline-flex items-center gap-1.5">
                <HardHat size={14} className="text-accent-600" />
                Avancement du chantier
              </p>
              <span className="text-lg font-bold text-accent-600 tabular-nums">{avancement}%</span>
            </div>
            <input type="range" min="0" max="100" step="5" value={avancement}
              onChange={(e) => setAvancement(Number(e.target.value))}
              className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-accent-500" />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 font-bold">
              <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
            </div>
          </div>

          {/* Notes terrain */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Notes de terrain
            </label>
            <textarea value={notesTerrain} onChange={(e) => setNotesTerrain(e.target.value)}
              rows={4} placeholder="Observations, problèmes rencontrés, matériaux à prévoir…"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/15 resize-none" />
            <p className="text-[10px] text-slate-400 mt-1">Visibles par votre manager</p>
          </div>

          {error && (
            <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button onClick={handleSave} disabled={saving || saved}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-base shadow-sm active:scale-95 transition-all disabled:opacity-70 ${
              saved
                ? 'bg-emerald-500 text-white'
                : 'bg-accent-500 hover:bg-accent-600 text-white'
            }`}>
            {saving
              ? <><Loader2 size={20} className="animate-spin" />Enregistrement…</>
              : saved
                ? <><CheckCircle size={20} />Enregistré !</>
                : <><Save size={18} />Enregistrer</>}
          </button>
        </div>
      </div>
    </div>
  )
}


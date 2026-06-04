import { useEffect, useMemo, useState } from 'react'
import {
  Clock, Loader2, MapPin, ChevronDown, ChevronUp, TrendingUp,
} from 'lucide-react'
import {
  listPointagesForOuvrier, getPointageEnCoursForOuvrier,
  dureeMinutes, fmtDuree,
} from '../services/pointagesService'

function startOfWeek(d) {
  const x = new Date(d)
  const day = x.getDay()
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day))
  x.setHours(0, 0, 0, 0)
  return x
}
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function fmtHeure(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
function fmtDateJour(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

export default function OuvrierPointagesPanel({ ouvrier }) {
  const [pointages, setPointages] = useState([])
  const [enCours,   setEnCours]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState(false)   // afficher l'historique complet

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      // 30 derniers jours, suffisant pour les stats hebdo et mensuelles
      const from = new Date()
      from.setDate(from.getDate() - 31)
      const [{ data: list }, { data: active }] = await Promise.all([
        listPointagesForOuvrier(ouvrier.id, from.toISOString()),
        getPointageEnCoursForOuvrier(ouvrier.id),
      ])
      if (cancelled) return
      setPointages(list || [])
      setEnCours(active || null)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [ouvrier.id])

  // Stats : total cette semaine, ce mois
  const stats = useMemo(() => {
    const now = new Date()
    const weekStart  = startOfWeek(now).getTime()
    const monthStart = startOfMonth(now).getTime()
    let semaine = 0, mois = 0, totalDernier30j = 0
    for (const p of pointages) {
      const dur = dureeMinutes(p)
      const t   = new Date(p.heure_arrivee).getTime()
      totalDernier30j += dur
      if (t >= monthStart) mois += dur
      if (t >= weekStart)  semaine += dur
    }
    return { semaine, mois, totalDernier30j }
  }, [pointages])

  const itemsToShow = expanded ? pointages : pointages.slice(0, 5)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock size={14} className="text-accent-600" />
        <h3 className="text-sm font-bold text-slate-800">Pointages & heures</h3>
      </div>

      {/* ── Pointage en cours ────────────────────── */}
      {enCours && (
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-xl p-3 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
            <Clock size={14} className="text-white animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-100">En cours</p>
            <p className="text-sm font-bold truncate">{enCours.chantier?.nom || 'Chantier'}</p>
            <p className="text-[11px] text-emerald-100">Pointé depuis {fmtHeure(enCours.heure_arrivee)}</p>
          </div>
        </div>
      )}

      {/* ── Stats hebdo / mensuel ───────────────── */}
      {loading ? (
        <div className="py-4 flex justify-center"><Loader2 size={18} className="animate-spin text-slate-300" /></div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatBox label="Cette semaine" value={fmtDuree(stats.semaine)} color="emerald" />
            <StatBox label="Ce mois"       value={fmtDuree(stats.mois)}    color="blue" />
            <StatBox label="30 derniers j." value={fmtDuree(stats.totalDernier30j)} color="amber" />
          </div>

          {/* ── Liste pointages ──────────────── */}
          {pointages.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3 italic">Aucun pointage enregistré</p>
          ) : (
            <>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {itemsToShow.map((p) => (
                  <PointageLine key={p.id} pointage={p} />
                ))}
              </div>

              {pointages.length > 5 && (
                <button onClick={() => setExpanded((v) => !v)}
                  className="w-full flex items-center justify-center gap-1 py-1.5 text-xs font-semibold text-primary-700 hover:text-primary-900 transition-colors">
                  {expanded
                    ? <><ChevronUp size={13} />Réduire</>
                    : <><ChevronDown size={13} />Voir tous ({pointages.length})</>}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function PointageLine({ pointage: p }) {
  const dur = dureeMinutes(p)
  const enCoursP = !p.heure_depart
  const hasGps = p.latitude_arrivee != null && p.longitude_arrivee != null
  return (
    <div className="bg-white border border-slate-100 rounded-xl p-2.5 flex items-center gap-2">
      <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${enCoursP ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-slate-900 truncate">
            {p.chantier?.nom || 'Chantier supprimé'}
          </p>
          {hasGps && (
            <span title="Position GPS enregistrée">
              <MapPin size={9} className="text-slate-400" />
            </span>
          )}
        </div>
        <p className="text-[10px] text-slate-500">
          {fmtDateJour(p.heure_arrivee)} · {fmtHeure(p.heure_arrivee)}
          {p.heure_depart ? ` → ${fmtHeure(p.heure_depart)}` : ' → en cours'}
        </p>
      </div>
      <div className={`text-right flex-shrink-0 ${enCoursP ? 'text-emerald-600' : 'text-slate-700'}`}>
        <p className="text-xs font-bold tabular-nums">{fmtDuree(dur)}</p>
      </div>
    </div>
  )
}

function StatBox({ label, value, color }) {
  const palette = {
    emerald: 'bg-emerald-50 text-emerald-700',
    blue:    'bg-blue-50 text-blue-700',
    amber:   'bg-amber-50 text-amber-700',
  }
  return (
    <div className="bg-white border border-slate-100 rounded-xl p-2.5">
      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide leading-none">{label}</p>
      <p className={`text-base font-bold tabular-nums mt-1 ${palette[color]?.split(' ')[1] || 'text-slate-800'}`}>
        {value}
      </p>
    </div>
  )
}

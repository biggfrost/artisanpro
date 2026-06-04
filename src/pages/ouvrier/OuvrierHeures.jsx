import { useMemo, useState } from 'react'
import {
  Clock, PlayCircle, StopCircle, Loader2, ChevronLeft, ChevronRight,
  Construction, Calendar, TrendingUp,
} from 'lucide-react'
import { usePointages } from '../../hooks/usePointages'
import { fmtDuree, dureeMinutes } from '../../services/pointagesService'

function startOfWeek(d) {
  const x = new Date(d)
  const day = x.getDay()
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day))
  x.setHours(0, 0, 0, 0)
  return x
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function fmtDateShort(d) { return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) }
function fmtHeure(iso)   { return iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '' }
function fmtDateJour(iso) {
  return iso ? new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : ''
}
const JOUR_COURT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export default function OuvrierHeures() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart])

  const { pointages, enCours, loading, refresh, end } = usePointages({
    fromISO: weekStart.toISOString(),
    toISO:   weekEnd.toISOString(),
  })

  const [pointing, setPointing] = useState(false)

  async function handleStop() {
    setPointing(true)
    await end()
    setPointing(false)
  }

  // Aggrégats par jour de la semaine
  const stats = useMemo(() => {
    const byDay = Array.from({ length: 7 }, () => 0)   // minutes par jour
    let totalMinutes = 0
    let chantiersDistinct = new Set()
    for (const p of pointages) {
      const dur = dureeMinutes(p)
      if (!dur) continue
      const dayIdx = Math.floor((new Date(p.heure_arrivee) - weekStart) / 86400000)
      if (dayIdx >= 0 && dayIdx < 7) byDay[dayIdx] += dur
      totalMinutes += dur
      if (p.chantier_id) chantiersDistinct.add(p.chantier_id)
    }
    const maxDay = Math.max(...byDay, 60)   // 60 min mini pour échelle
    return {
      byDay, totalMinutes, maxDay,
      chantiersCount: chantiersDistinct.size,
      pointagesCount: pointages.length,
    }
  }, [pointages, weekStart])

  const today = startOfWeek(new Date())
  const isCurrentWeek = today.getTime() === weekStart.getTime()

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="mb-5">
        <p className="text-sm text-slate-500 font-medium">Pointage et récap</p>
        <h1 className="text-2xl font-bold text-primary-900">Mes heures</h1>
      </div>

      {/* ── Pointage en cours sticky ─────────────────── */}
      {enCours ? (
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl p-4 mb-5 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Clock size={22} className="text-white animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-100">Pointage en cours</p>
              <p className="text-base font-bold truncate">{enCours.chantier?.nom || 'Chantier'}</p>
              <p className="text-xs text-emerald-100">Depuis {fmtHeure(enCours.heure_arrivee)}</p>
            </div>
          </div>
          <button onClick={handleStop} disabled={pointing}
            className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-emerald-700 font-bold text-sm shadow-sm hover:bg-emerald-50 active:scale-95 transition-all disabled:opacity-60">
            {pointing ? <Loader2 size={18} className="animate-spin" /> : <StopCircle size={18} />}
            Je pars maintenant
          </button>
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-4 mb-5 text-center">
          <p className="text-xs text-slate-500">
            Aucun pointage en cours. Démarrez-en un depuis l'écran <strong>Planning</strong> en cliquant sur un chantier du jour.
          </p>
        </div>
      )}

      {/* ── KPIs récap ─────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <MiniKPI icon={Clock}    label="Total" value={fmtDuree(stats.totalMinutes)} color="emerald" />
        <MiniKPI icon={Construction} label="Chantiers" value={stats.chantiersCount} color="blue" />
        <MiniKPI icon={Calendar} label="Pointages" value={stats.pointagesCount} color="amber" />
      </div>

      {/* ── Navigation semaine ─────────────────────── */}
      <div className="flex items-center justify-between bg-slate-50 rounded-xl px-2 py-1.5 mb-3">
        <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Semaine précédente"
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white transition-colors">
          <ChevronLeft size={16} className="text-slate-600" />
        </button>
        <div className="text-center flex-1">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Semaine du</p>
          <p className="text-sm font-bold text-slate-800">{fmtDateShort(weekStart)} — {fmtDateShort(addDays(weekStart, 6))}</p>
          {!isCurrentWeek && (
            <button type="button" onClick={() => setWeekStart(today)}
              className="text-[10px] font-bold text-accent-600 hover:text-accent-700 mt-0.5">
              ← Aujourd'hui
            </button>
          )}
        </div>
        <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Semaine suivante"
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white transition-colors">
          <ChevronRight size={16} className="text-slate-600" />
        </button>
      </div>

      {/* ── Bar chart hebdo ────────────────────────── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 mb-5 shadow-card">
        <div className="flex items-center gap-1.5 mb-3">
          <TrendingUp size={13} className="text-slate-400" />
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Heures par jour</h2>
        </div>
        <div className="flex items-end justify-between gap-2" style={{ height: 100 }}>
          {stats.byDay.map((minutes, idx) => {
            const heightPct = stats.maxDay > 0 ? (minutes / stats.maxDay) * 100 : 0
            const isToday = addDays(weekStart, idx).toDateString() === new Date().toDateString()
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full">
                <p className="text-[9px] font-bold text-slate-600 tabular-nums">
                  {minutes > 0 ? fmtDuree(minutes) : '—'}
                </p>
                <div className="w-full flex-1 flex items-end">
                  <div className={`w-full rounded-md transition-all ${isToday ? 'bg-gradient-to-t from-accent-500 to-accent-400' : 'bg-gradient-to-t from-primary-700 to-primary-500'}`}
                    style={{ height: `${Math.max(heightPct, 2)}%` }} />
                </div>
                <p className={`text-[10px] font-bold uppercase ${isToday ? 'text-accent-600' : 'text-slate-400'}`}>
                  {JOUR_COURT[idx]}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Liste détaillée ────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Pointages de la semaine</h2>
        {loading ? (
          <div className="py-6 flex justify-center"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
        ) : pointages.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-6 text-center">
            <Clock size={26} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">Aucun pointage cette semaine</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pointages.map((p) => {
              const dur = dureeMinutes(p)
              const enCoursP = !p.heure_depart
              return (
                <div key={p.id} className="bg-white border border-slate-100 rounded-2xl p-3 flex items-center gap-3 shadow-card">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${enCoursP ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                    <Clock size={15} className={enCoursP ? 'text-emerald-600' : 'text-slate-500'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {p.chantier?.nom || 'Chantier supprimé'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {fmtDateJour(p.heure_arrivee)} · {fmtHeure(p.heure_arrivee)}
                      {p.heure_depart ? ` → ${fmtHeure(p.heure_depart)}` : ' → en cours'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold tabular-nums ${enCoursP ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {fmtDuree(dur)}
                    </p>
                    {enCoursP && <span className="text-[9px] font-bold text-emerald-600 uppercase">en cours</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function MiniKPI({ icon: Icon, label, value, color }) {
  const palette = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-600' },
  }
  const c = palette[color] ?? palette.blue
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-card">
      <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center mb-1`}>
        <Icon size={13} className={c.text} strokeWidth={2.2} />
      </div>
      <p className="text-base font-bold text-slate-900 tabular-nums leading-none mt-1">{value}</p>
      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  )
}


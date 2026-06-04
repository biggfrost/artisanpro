import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Euro, Target, ShoppingCart,
  ChevronLeft, AlertTriangle, Award, Clock, Receipt,
} from 'lucide-react'
import { useDevis } from '../hooks/useDevis'
import { formatCurrency, formatDate } from '../utils/formatters'
import { loadParametres } from '../services/parametres'

// ── Helpers ──────────────────────────────────────────────────────
function amountHT(d) {
  return Number(d.totalHT ?? d.montantHT ?? 0)
}
function devisDate(d) {
  return new Date(d.dateEmission || d.date || d.createdAt || 0)
}

// ── Page ─────────────────────────────────────────────────────────
export default function DashboardPro() {
  const { devis } = useDevis()
  const navigate  = useNavigate()
  const artisan   = useMemo(loadParametres, [])
  const prenom    = artisan.nom?.split(' ')[0] || artisan.raisonSociale || ''

  const stats = useMemo(() => {
    const now           = new Date()
    const yearStart     = new Date(now.getFullYear(), 0, 1)
    const monthStart    = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart= new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const acceptes = devis.filter((d) => d.statut === 'accepte')
    const envoyes  = devis.filter((d) => d.statut === 'envoye')
    const refuses  = devis.filter((d) => d.statut === 'refuse')

    const caTotal = acceptes.reduce((s, d) => s + amountHT(d), 0)
    const caAnnee = acceptes
      .filter((d) => devisDate(d) >= yearStart)
      .reduce((s, d) => s + amountHT(d), 0)
    const caMois = acceptes
      .filter((d) => devisDate(d) >= monthStart)
      .reduce((s, d) => s + amountHT(d), 0)
    const caMoisPrec = acceptes
      .filter((d) => {
        const dt = devisDate(d)
        return dt >= prevMonthStart && dt < monthStart
      })
      .reduce((s, d) => s + amountHT(d), 0)

    const variationPct = caMoisPrec > 0
      ? ((caMois - caMoisPrec) / caMoisPrec) * 100
      : null

    const decidesTotal = acceptes.length + refuses.length
    const tauxTransfo  = decidesTotal > 0
      ? (acceptes.length / decidesTotal) * 100
      : 0

    const panierMoyen = acceptes.length > 0 ? caTotal / acceptes.length : 0

    // Expirent dans les 7 prochains jours
    const in7Days = new Date()
    in7Days.setDate(in7Days.getDate() + 7)
    const expirentBientot = envoyes.filter((d) => {
      if (!d.dateValidite) return false
      const v = new Date(d.dateValidite)
      return v > now && v < in7Days
    })

    // Évolution 6 derniers mois (mois courant inclus)
    const monthly = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const ca    = acceptes
        .filter((d) => {
          const dt = devisDate(d)
          return dt >= start && dt < end
        })
        .reduce((s, d) => s + amountHT(d), 0)
      monthly.push({
        label: start.toLocaleDateString('fr-FR', { month: 'short' }),
        value: ca,
      })
    }
    const maxMonthly = Math.max(...monthly.map((m) => m.value), 1)

    return {
      caTotal, caAnnee, caMois, variationPct, tauxTransfo, panierMoyen,
      expirentBientot, monthly, maxMonthly,
      acceptesCount: acceptes.length,
      envoyesCount:  envoyes.length,
      refusesCount:  refuses.length,
    }
  }, [devis])

  return (
    <div className="px-4 pt-12 pb-6">
      {/* ── Header avec retour ── */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate('/manager/dashboard')}
          aria-label="Retour"
          className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
        >
          <ChevronLeft size={18} className="text-slate-600" />
        </button>
        <div>
          <p className="text-xs text-slate-500 font-medium">Statistiques détaillées</p>
          <h1 className="text-xl font-bold text-primary-900">Tableau de bord Pro</h1>
        </div>
      </div>

      {/* ── Hero : CA du mois en cours ── */}
      <div className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 rounded-3xl p-5 mb-4 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute -right-12 -bottom-12 w-32 h-32 rounded-full bg-white/5" />
        <div className="relative">
          <p className="text-[10px] text-blue-200 font-semibold uppercase tracking-widest">
            Chiffre d'affaires accepté · {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </p>
          <p className="text-3xl font-bold mt-1 tabular-nums">{formatCurrency(stats.caMois)}</p>
          {stats.variationPct !== null ? (
            <div className="flex items-center gap-1.5 mt-2">
              {stats.variationPct >= 0
                ? <TrendingUp   size={14} className="text-emerald-300" />
                : <TrendingDown size={14} className="text-red-300"     />}
              <span className={`text-xs font-medium ${stats.variationPct >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {stats.variationPct >= 0 ? '+' : ''}{stats.variationPct.toFixed(0)} %
              </span>
              <span className="text-xs text-blue-200">vs mois précédent</span>
            </div>
          ) : (
            <p className="text-xs text-blue-200 mt-2">Pas d'historique sur le mois précédent</p>
          )}
        </div>
      </div>

      {/* ── 4 mini KPIs ── */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <KpiCard
          icon={Euro}
          label="CA accepté année"
          value={formatCurrency(stats.caAnnee)}
          color="emerald"
        />
        <KpiCard
          icon={Target}
          label="Taux transformation"
          value={`${stats.tauxTransfo.toFixed(0)} %`}
          color="blue"
          hint={`${stats.acceptesCount} acceptés / ${stats.acceptesCount + stats.refusesCount} décidés`}
        />
        <KpiCard
          icon={ShoppingCart}
          label="Panier moyen"
          value={formatCurrency(stats.panierMoyen)}
          color="amber"
        />
        <KpiCard
          icon={Award}
          label="Devis remportés"
          value={stats.acceptesCount}
          color="violet"
        />
      </div>

      {/* ── Évolution mensuelle ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Évolution sur 6 mois</h2>
          <span className="text-[10px] text-slate-400 font-medium uppercase">CA HT</span>
        </div>
        <div className="flex items-end justify-between gap-2" style={{ height: 128 }}>
          {stats.monthly.map((m, i) => {
            const heightPct = stats.maxMonthly > 0 ? (m.value / stats.maxMonthly) * 100 : 0
            const isLast    = i === stats.monthly.length - 1
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={`w-full rounded-md transition-all ${
                      isLast
                        ? 'bg-gradient-to-t from-accent-500 to-accent-400'
                        : 'bg-gradient-to-t from-primary-900 to-primary-600'
                    }`}
                    style={{ height: `${Math.max(heightPct, 3)}%` }}
                    title={`${m.label} : ${formatCurrency(m.value)}`}
                  />
                </div>
                <p className={`text-[10px] font-semibold uppercase ${isLast ? 'text-accent-600' : 'text-slate-400'}`}>
                  {m.label}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Devis qui expirent bientôt ── */}
      {stats.expirentBientot.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-900">
              {stats.expirentBientot.length} devis {stats.expirentBientot.length > 1 ? 'expirent' : 'expire'} sous 7 jours
            </h2>
          </div>
          <p className="text-xs text-amber-700 mb-3">
            Pensez à relancer ces clients avant la fin de validité.
          </p>
          <div className="space-y-1.5">
            {stats.expirentBientot.slice(0, 4).map((d) => (
              <button
                key={d.id}
                onClick={() => navigate('/manager/devis')}
                className="w-full flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-amber-100 hover:border-amber-300 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Clock size={12} className="text-amber-500 flex-shrink-0" />
                  <span className="text-sm text-slate-700 truncate">{d.client}</span>
                </div>
                <span className="text-xs text-amber-600 font-semibold flex-shrink-0 ml-2">
                  {formatDate(d.dateValidite)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Répartition statuts ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-card mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Receipt size={15} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700">Répartition des devis</h2>
        </div>
        <div className="space-y-3">
          <StatusBar label="Acceptés"   count={stats.acceptesCount} total={stats.acceptesCount + stats.envoyesCount + stats.refusesCount} color="bg-emerald-500" />
          <StatusBar label="En attente" count={stats.envoyesCount}  total={stats.acceptesCount + stats.envoyesCount + stats.refusesCount} color="bg-blue-500"    />
          <StatusBar label="Refusés"    count={stats.refusesCount}  total={stats.acceptesCount + stats.envoyesCount + stats.refusesCount} color="bg-red-400"     />
        </div>
      </div>

      {/* ── CA cumulé total ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-card">
        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
          CA accepté cumulé · tous exercices
        </p>
        <p className="text-2xl font-bold text-primary-900 mt-1 tabular-nums">
          {formatCurrency(stats.caTotal)}
        </p>
        {prenom && (
          <p className="text-xs text-slate-500 mt-1">Beau travail, {prenom} 👏</p>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, color, hint }) {
  const palette = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600'    },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-600'   },
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-600'  },
  }
  const c = palette[color] ?? palette.blue

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-3.5 shadow-card">
      <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center mb-2`}>
        <Icon size={15} className={c.text} strokeWidth={2.2} />
      </div>
      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-base font-bold text-slate-900 mt-0.5 tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  )
}

function StatusBar({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-600 font-medium">{label}</span>
        <span className="text-xs text-slate-500 tabular-nums">
          {count} <span className="text-slate-400">({pct.toFixed(0)} %)</span>
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}


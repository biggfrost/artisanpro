import { useMemo, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Euro, Target, ShoppingCart,
  ChevronLeft, AlertTriangle, Award, Clock, Receipt,
  HardHat, Users, RefreshCw,
} from 'lucide-react'
import { useDevis } from '../hooks/useDevis'
import { useChantiers } from '../hooks/useChantiers'
import { useOuvriers } from '../hooks/useOuvriers'
import { listDevisAuthenticated, normalizeDevis } from '../services/devisService'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDate } from '../utils/formatters'
import { loadParametres } from '../services/parametres'
import { mergeDevis } from '../utils/mergeDevis'

// ── Helpers ──────────────────────────────────────────────────────
function amountHT(d) { return Number(d.totalHT ?? d.montantHT ?? 0) }
function devisDate(d) { return new Date(d.dateEmission || d.date || d.createdAt || 0) }

// ── Page ─────────────────────────────────────────────────────────
export default function DashboardPro() {
  const { devis }                  = useDevis()
  const { chantiers, loading: loadingChantiers, refresh: refreshChantiers } = useChantiers()
  const { ouvriers }               = useOuvriers()
  const navigate                   = useNavigate()
  const { entreprise }             = useAuth()
  const artisan                    = useMemo(loadParametres, [])
  const prenom                     = artisan.nom?.split(' ')[0] || artisan.raisonSociale || ''

  // ── Devis Supabase (ouvriers + manager) ─────────────────────────
  const [supabaseDevis, setSupabaseDevis] = useState([])
  const [loadingDevis, setLoadingDevis]   = useState(true)
  const [lastUpdate, setLastUpdate]       = useState(null)

  const fetchDevis = useCallback(async () => {
    setLoadingDevis(true)
    const { data } = await listDevisAuthenticated()
    setSupabaseDevis(data.map(normalizeDevis))
    setLoadingDevis(false)
    setLastUpdate(new Date())
  }, [])

  useEffect(() => { fetchDevis() }, [fetchDevis])

  // Realtime : se met à jour dès qu'un devis est modifié
  useEffect(() => {
    if (!entreprise?.id) return
    const channel = supabase
      .channel(`dashpro-${entreprise.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'devis', filter: `entreprise_id=eq.${entreprise.id}` },
        () => { fetchDevis(); refreshChantiers() }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'chantiers', filter: `entreprise_id=eq.${entreprise.id}` },
        refreshChantiers
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [entreprise?.id, fetchDevis, refreshChantiers])

  // ── Fusion devis local + Supabase ────────────────────────────────
  // mergeDevis garantit qu'un devis 'accepte' gagne toujours sur 'envoye',
  // même si les deux sources ont des copies du même numéro.
  const allDevis = useMemo(() => mergeDevis(devis, supabaseDevis), [devis, supabaseDevis])

  // ── Calculs stats ────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now            = new Date()
    const yearStart      = new Date(now.getFullYear(), 0, 1)
    const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const acceptes  = allDevis.filter((d) => d.statut === 'accepte')
    const envoyes   = allDevis.filter((d) => d.statut === 'envoye')
    const refuses   = allDevis.filter((d) => d.statut === 'refuse')
    const enAttente = allDevis.filter((d) => d.statut === 'en_attente_validation')

    // CA = uniquement les devis formellement acceptés via signature électronique.
    // Un devis "envoyé" n'est pas du CA — le client n'a pas encore accepté.
    const caTotal    = acceptes.reduce((s, d) => s + amountHT(d), 0)
    const caAnnee    = acceptes.filter((d) => devisDate(d) >= yearStart).reduce((s, d) => s + amountHT(d), 0)
    const caMois     = acceptes.filter((d) => devisDate(d) >= monthStart).reduce((s, d) => s + amountHT(d), 0)
    const caMoisPrec = acceptes
      .filter((d) => { const dt = devisDate(d); return dt >= prevMonthStart && dt < monthStart })
      .reduce((s, d) => s + amountHT(d), 0)

    const variationPct  = caMoisPrec > 0 ? ((caMois - caMoisPrec) / caMoisPrec) * 100 : null
    const decidesTotal  = acceptes.length + refuses.length
    const tauxTransfo   = decidesTotal > 0 ? (acceptes.length / decidesTotal) * 100 : 0
    const panierMoyen   = acceptes.length > 0 ? caTotal / acceptes.length : 0

    // Devis expirant sous 7 jours
    const in7Days = new Date(); in7Days.setDate(in7Days.getDate() + 7)
    const expirentBientot = envoyes.filter((d) => {
      if (!d.dateValidite) return false
      const v = new Date(d.dateValidite)
      return v > now && v < in7Days
    })

    // Évolution CA 6 derniers mois
    const monthly = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const ca    = acceptes.filter((d) => { const dt = devisDate(d); return dt >= start && dt < end })
                           .reduce((s, d) => s + amountHT(d), 0)
      monthly.push({ label: start.toLocaleDateString('fr-FR', { month: 'short' }), value: ca })
    }
    const maxMonthly = Math.max(...monthly.map((m) => m.value), 1)

    // Stats chantiers — seuls les chantiers issus d'un devis signé sont légitimes
    const estLegitime = (c) => c.notes?.includes('Issu du devis')
    const chantiersEnCours   = chantiers.filter((c) => c.statut === 'en_cours' && estLegitime(c)).length
    const chantiersTermines  = chantiers.filter((c) => c.statut === 'termine'  && estLegitime(c)).length
    const chantiersPlanifies = chantiers.filter((c) => c.statut === 'planifie').length

    // Ouvriers actifs = ceux qui ont une assignation récente
    const ouvrierCount = ouvriers.length

    return {
      caTotal, caAnnee, caMois, caMoisPrec, variationPct,
      tauxTransfo, panierMoyen, expirentBientot, monthly, maxMonthly,
      acceptesCount:   acceptes.length,
      envoyesCount:    envoyes.length,
      refusesCount:    refuses.length,
      enAttenteCount:  enAttente.length,
      totalDevis:      allDevis.length,
      chantiersEnCours, chantiersTermines, chantiersPlanifies,
      ouvrierCount,
    }
  }, [allDevis, chantiers, ouvriers])

  const loading = loadingDevis || loadingChantiers

  return (
    <div className="px-4 pt-12 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/manager/dashboard')} aria-label="Retour"
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-card">
            <ChevronLeft size={18} className="text-slate-600" />
          </button>
          <div>
            <p className="text-xs text-slate-500 font-medium">Statistiques détaillées</p>
            <h1 className="text-xl font-bold text-primary-900">Tableau de bord Pro</h1>
          </div>
        </div>
        <button onClick={() => { fetchDevis(); refreshChantiers() }}
          className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-card"
          title="Actualiser">
          <RefreshCw size={15} className={`text-slate-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Dernière mise à jour */}
      {lastUpdate && (
        <p className="text-[10px] text-slate-400 text-right -mt-3 mb-4">
          Mis à jour à {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      {loading ? <DashboardSkeleton /> : (
        <>
          {/* Hero CA du mois */}
          <div className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 rounded-3xl p-5 mb-4 text-white shadow-lg relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/5" />
            <div className="absolute -right-12 -bottom-12 w-32 h-32 rounded-full bg-white/5" />
            <div className="relative">
              <p className="text-[10px] text-blue-200 font-semibold uppercase tracking-widest">
                CA accepté (devis signés) · {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </p>
              <p className="text-3xl font-bold mt-1 tabular-nums">{formatCurrency(stats.caMois)}</p>
              {stats.variationPct !== null ? (
                <div className="flex items-center gap-1.5 mt-2">
                  {stats.variationPct >= 0
                    ? <TrendingUp   size={14} className="text-emerald-300" />
                    : <TrendingDown size={14} className="text-red-300" />}
                  <span className={`text-xs font-medium ${stats.variationPct >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {stats.variationPct >= 0 ? '+' : ''}{stats.variationPct.toFixed(0)} %
                  </span>
                  <span className="text-xs text-blue-200">vs mois précédent ({formatCurrency(stats.caMoisPrec)})</span>
                </div>
              ) : (
                <p className="text-xs text-blue-200 mt-2">Premier mois enregistré</p>
              )}
              {stats.envoyesCount > 0 && (
                <p className="text-[10px] text-blue-300 mt-1">
                  + {stats.envoyesCount} devis envoyés en attente de signature client
                </p>
              )}
            </div>
          </div>

          {/* 4 KPIs devis — cliquables */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <KpiCard icon={Euro}         label="CA annuel signé"        value={formatCurrency(stats.caAnnee)}                              color="emerald" onClick={() => navigate('/manager/devis', { state: { filter: 'accepte' } })} />
            <KpiCard icon={Target}       label="Taux de transformation" value={`${stats.tauxTransfo.toFixed(0)} %`}                        color="blue"    onClick={() => navigate('/manager/devis')}
              hint={`${stats.acceptesCount} signés / ${stats.acceptesCount + stats.refusesCount} décidés`} />
            <KpiCard icon={ShoppingCart} label="Panier moyen signé"    value={formatCurrency(stats.panierMoyen)}                           color="amber"   onClick={() => navigate('/manager/devis', { state: { filter: 'accepte' } })} />
            <KpiCard icon={Award}        label="Devis signés"          value={`${stats.acceptesCount}`}                                    color="violet"  onClick={() => navigate('/manager/devis', { state: { filter: 'accepte' } })} />
          </div>

          {/* Stats chantiers — cliquables */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <ChantierKpi label="En cours"  count={stats.chantiersEnCours}   color="text-accent-600"  bg="bg-orange-50"   onClick={() => navigate('/manager/chantiers', { state: { filter: 'en_cours' } })} />
            <ChantierKpi label="Planifiés" count={stats.chantiersPlanifies} color="text-amber-600"   bg="bg-amber-50"    onClick={() => navigate('/manager/chantiers', { state: { filter: 'planifie' } })} />
            <ChantierKpi label="Terminés"  count={stats.chantiersTermines}  color="text-emerald-600" bg="bg-emerald-50"  onClick={() => navigate('/manager/chantiers', { state: { filter: 'termine' } })} />
          </div>

          {/* Équipe + devis en attente de validation */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button onClick={() => navigate('/manager/ouvriers')}
              className="bg-white rounded-2xl border border-slate-100 p-3.5 shadow-card text-left active:scale-95 transition-transform">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center mb-2">
                <Users size={15} className="text-violet-600" />
              </div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Équipe</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{stats.ouvrierCount}</p>
              <p className="text-[10px] text-slate-400">ouvrier{stats.ouvrierCount !== 1 ? 's' : ''}</p>
            </button>
            <button onClick={() => navigate('/manager/devis')}
              className={`rounded-2xl border p-3.5 shadow-card text-left active:scale-95 transition-transform ${
                stats.enAttenteCount > 0
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-white border-slate-100'
              }`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${stats.enAttenteCount > 0 ? 'bg-amber-100' : 'bg-slate-100'}`}>
                <Clock size={15} className={stats.enAttenteCount > 0 ? 'text-amber-600' : 'text-slate-400'} />
              </div>
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${stats.enAttenteCount > 0 ? 'text-amber-700' : 'text-slate-400'}`}>À valider</p>
              <p className={`text-xl font-bold mt-0.5 ${stats.enAttenteCount > 0 ? 'text-amber-900' : 'text-slate-900'}`}>{stats.enAttenteCount}</p>
              <p className={`text-[10px] ${stats.enAttenteCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>devis ouvriers</p>
            </button>
          </div>

          {/* Évolution CA 6 mois */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700">Évolution CA sur 6 mois</h2>
              <span className="text-[10px] text-slate-400 font-medium uppercase">HT</span>
            </div>
            {stats.monthly.every((m) => m.value === 0) ? (
              <p className="text-xs text-slate-400 text-center py-8">Aucun devis accepté sur cette période</p>
            ) : (
              <div className="flex items-end justify-between gap-2" style={{ height: 128 }}>
                {stats.monthly.map((m, i) => {
                  const pct    = stats.maxMonthly > 0 ? (m.value / stats.maxMonthly) * 100 : 0
                  const isLast = i === stats.monthly.length - 1
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full">
                      <div className="w-full flex-1 flex flex-col justify-end">
                        {m.value > 0 && (
                          <p className="text-[9px] text-center text-slate-400 mb-1 tabular-nums leading-tight">
                            {formatCurrency(m.value).replace('€', '').trim()}
                          </p>
                        )}
                        <div
                          className={`w-full rounded-md transition-all ${isLast ? 'bg-gradient-to-t from-accent-500 to-accent-400' : 'bg-gradient-to-t from-primary-900 to-primary-600'}`}
                          style={{ height: `${Math.max(pct, 3)}%` }}
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
            )}
          </div>

          {/* Devis expirant bientôt */}
          {stats.expirentBientot.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <h2 className="text-sm font-semibold text-amber-900">
                  {stats.expirentBientot.length} devis {stats.expirentBientot.length > 1 ? 'expirent' : 'expire'} sous 7 jours
                </h2>
              </div>
              <p className="text-xs text-amber-700 mb-3">Relancez ces clients avant expiration.</p>
              <div className="space-y-1.5">
                {stats.expirentBientot.slice(0, 4).map((d) => (
                  <button key={d.id} onClick={() => navigate('/manager/devis', { state: { filter: 'envoye' } })}
                    className="w-full flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-amber-100 hover:border-amber-300 transition-colors active:scale-[0.99]">
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock size={12} className="text-amber-500 flex-shrink-0" />
                      <span className="text-sm text-slate-700 truncate">{d.client}</span>
                      <span className="text-xs text-slate-400 font-mono flex-shrink-0">{d.numero}</span>
                    </div>
                    <span className="text-xs text-amber-600 font-semibold flex-shrink-0 ml-2">
                      {formatDate(d.dateValidite)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Répartition statuts */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-card mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Receipt size={15} className="text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-700">Répartition des devis</h2>
              </div>
              <span className="text-xs text-slate-400">{stats.totalDevis} au total</span>
            </div>
            <div className="space-y-3">
              <StatusBar label="Signés par client" count={stats.acceptesCount}  total={stats.totalDevis} color="bg-emerald-500" onClick={() => navigate('/manager/devis', { state: { filter: 'accepte' } })} />
              <StatusBar label="Envoyés (en attente signature)" count={stats.envoyesCount} total={stats.totalDevis} color="bg-blue-500" onClick={() => navigate('/manager/devis', { state: { filter: 'envoye' } })} />
              <StatusBar label="En attente valid." count={stats.enAttenteCount} total={stats.totalDevis} color="bg-amber-400"  onClick={() => navigate('/manager/devis')} />
              <StatusBar label="Refusés"          count={stats.refusesCount}    total={stats.totalDevis} color="bg-red-400"    onClick={() => navigate('/manager/devis', { state: { filter: 'refuse' } })} />
            </div>
          </div>

          {/* CA cumulé */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-card">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
              CA accepté cumulé · tous exercices
            </p>
            <p className="text-2xl font-bold text-primary-900 mt-1 tabular-nums">{formatCurrency(stats.caTotal)}</p>
            {prenom && <p className="text-xs text-slate-500 mt-1">Beau travail, {prenom} 👏</p>}
          </div>
        </>
      )}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-28 bg-primary-900/20 rounded-3xl" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-2xl" />)}
      </div>
      <div className="h-40 bg-slate-100 rounded-2xl" />
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, color, hint, onClick }) {
  const palette = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600'    },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-600'   },
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-600'  },
  }
  const c = palette[color] ?? palette.blue
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-100 p-3.5 shadow-card text-left w-full transition-all ${onClick ? 'active:scale-95 cursor-pointer hover:shadow-card-hover' : ''}`}>
      <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center mb-2`}>
        <Icon size={15} className={c.text} strokeWidth={2.2} />
      </div>
      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-base font-bold text-slate-900 mt-0.5 tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </Tag>
  )
}

function ChantierKpi({ label, count, color, bg, onClick }) {
  return (
    <button onClick={onClick}
      className={`${bg} rounded-2xl border border-slate-100 p-3 shadow-card text-center active:scale-95 transition-transform w-full`}>
      <div className="flex items-center justify-center mb-1">
        <HardHat size={14} className={color} />
      </div>
      <p className={`text-xl font-bold ${color}`}>{count}</p>
      <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{label}</p>
    </button>
  )
}

function StatusBar({ label, count, total, color, onClick }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={`w-full text-left ${onClick ? 'active:scale-[0.99] transition-transform' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-600 font-medium">{label}</span>
        <span className="text-xs text-slate-500 tabular-nums">
          {count} <span className="text-slate-400">({pct.toFixed(0)} %)</span>
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </Tag>
  )
}

import { useMemo, useEffect, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, CheckCircle, HardHat, Bell,
  TrendingUp, ChevronRight, BarChart3, ArrowUpRight, Settings, UserCircle2,
  AlertTriangle,
} from 'lucide-react'
import { useDevis } from '../hooks/useDevis'
import { useChantiers } from '../hooks/useChantiers'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import { formatDate, formatCurrency, formatDateRelative } from '../utils/formatters'
import { loadParametres } from '../services/parametres'
import { supabase } from '../services/supabase'
import { listDevisAuthenticated, normalizeDevis } from '../services/devisService'
import { mergeDevis } from '../utils/mergeDevis'
import { acceptedDevisNumeros, isChantierLegitime } from '../utils/chantierLogic'
import { useAuth } from '../contexts/AuthContext'

export default function Dashboard() {
  const { devis }               = useDevis()
  const { chantiers, refresh: refreshChantiers } = useChantiers()
  const navigate                = useNavigate()
  const artisan                 = useMemo(loadParametres, [])
  const prenom                  = artisan.nom?.split(' ')[0] || artisan.raisonSociale || ''
  const { entreprise }          = useAuth()

  // ── Devis Supabase pour le CA réel ────────────────────────────────
  const [supabaseDevis, setSupabaseDevis] = useState([])
  const fetchDevis = useCallback(async () => {
    const { data } = await listDevisAuthenticated()
    setSupabaseDevis(data.map(normalizeDevis))
  }, [])

  useEffect(() => { fetchDevis() }, [fetchDevis])

  // Tous les devis (local + Supabase, dédupliqués, statut le plus avancé gagne)
  const allDevis = useMemo(() => mergeDevis(devis, supabaseDevis), [devis, supabaseDevis])

  // Temps réel
  const handleRealtimeChange = useCallback(() => {
    refreshChantiers?.()
    fetchDevis()
  }, [refreshChantiers, fetchDevis])

  useEffect(() => {
    if (!entreprise?.id) return
    const channel = supabase
      .channel(`dashboard-${entreprise.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devis',    filter: `entreprise_id=eq.${entreprise.id}` }, handleRealtimeChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chantiers', filter: `entreprise_id=eq.${entreprise.id}` }, handleRealtimeChange)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [entreprise?.id, handleRealtimeChange])

  const stats = useMemo(() => {
    const enAttente = allDevis.filter((d) => d.statut === 'envoye').length
    const acceptes  = allDevis.filter((d) => d.statut === 'accepte').length

    // Croise réellement chantier ↔ devis : un chantier est légitime SSI son
    // devis d'origine est accepté (signé). Ne se fie PAS aux notes seules.
    const acceptes_nums = acceptedDevisNumeros(allDevis)
    const estLegitime = (c) => isChantierLegitime(c, acceptes_nums)

    // "Chantiers en cours" ne compte QUE les chantiers légitimes (devis signé).
    const enCours = chantiers.filter((c) => c.statut === 'en_cours' && estLegitime(c)).length

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const relances = allDevis.filter((d) => {
      if (d.statut !== 'envoye') return false
      return new Date(d.date || d.dateEmission || 0) < sevenDaysAgo
    }).length

    const monthStart = new Date()
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

    // CA = uniquement devis signés électroniquement (statut accepte)
    const caMois = allDevis
      .filter((d) => d.statut === 'accepte' && new Date(d.dateEmission || d.date || 0) >= monthStart)
      .reduce((sum, d) => sum + Number(d.totalHT ?? d.montantHT ?? 0), 0)

    // Chantiers orphelins (actifs/terminés sans devis signé) → à régulariser
    const chantiersOrphelins = chantiers.filter(
      (c) => ['en_cours', 'termine'].includes(c.statut) && !estLegitime(c)
    )

    return { enAttente, acceptes, enCours, relances, caMois, chantiersOrphelins }
  }, [allDevis, chantiers])

  const recentActivity = useMemo(() => {
    const items = [
      ...allDevis.map((d) => ({ ...d, _type: 'devis' })),
      ...chantiers.map((c) => ({ ...c, _type: 'chantier' })),
    ]
    return items
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
  }, [allDevis, chantiers])

  return (
    <div className="px-4 pt-12 pb-4">
      {/* Header */}
      <div className="mb-5">
        <p className="text-sm text-slate-500 font-medium mb-0.5">
          Bonjour{prenom ? ` ${prenom}` : ''} 👋
        </p>
        <h1 className="text-2xl font-bold text-primary-900">ArtisanPro</h1>
      </div>

      {/* ⚠️ Avertissement chantiers sans devis signé */}
      {stats.chantiersOrphelins.length > 0 && (
        <button
          onClick={() => navigate('/manager/chantiers')}
          className="w-full flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 mb-4 text-left active:scale-[0.99] transition-transform"
        >
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900">
              {stats.chantiersOrphelins.length} chantier{stats.chantiersOrphelins.length > 1 ? 's' : ''} sans devis signé
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Un chantier ne peut être "en cours" ou "terminé" que si le client a signé le devis correspondant.
            </p>
          </div>
        </button>
      )}

      {/* Bannière Tableau de bord Pro */}
      <button
        onClick={() => navigate('/manager/dashboard-pro')}
        className="w-full bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 rounded-2xl p-4 mb-5 text-white shadow-card active:scale-[0.99] transition-transform relative overflow-hidden text-left"
      >
        <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-white/5" />
        <div className="absolute right-6 bottom-2 w-14 h-14 rounded-full bg-white/5" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 size={13} className="text-blue-200" />
              <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest">
                Tableau de bord Pro
              </p>
            </div>
            <p className="text-[11px] text-blue-200 mb-0.5">CA accepté ce mois</p>
            <p className="text-xl font-bold tabular-nums">{formatCurrency(stats.caMois)}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <ArrowUpRight size={18} className="text-white" strokeWidth={2.5} />
          </div>
        </div>
      </button>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard icon={FileText}    label="Devis en attente"  value={stats.enAttente} iconColor="text-blue-600"    iconBg="bg-blue-50"   onClick={() => navigate('/manager/devis',     { state: { filter: 'envoye'   } })} />
        <StatCard icon={CheckCircle} label="Devis acceptés"    value={stats.acceptes}  iconColor="text-emerald-600" iconBg="bg-emerald-50" onClick={() => navigate('/manager/devis',     { state: { filter: 'accepte'  } })} />
        <StatCard icon={HardHat}     label="Chantiers en cours" value={stats.enCours}  iconColor="text-accent-500"  iconBg="bg-orange-50"  onClick={() => navigate('/manager/chantiers', { state: { filter: 'en_cours' } })} />
        <StatCard icon={Bell}        label="Relances à faire"   value={stats.relances} iconColor="text-red-500"     iconBg="bg-red-50"     onClick={() => navigate('/manager/devis',     { state: { filter: 'relance'  } })} />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <button onClick={() => navigate('/manager/devis')}
          className="flex items-center justify-between bg-primary-900 text-white rounded-2xl px-4 py-3.5 shadow-sm active:scale-95 transition-transform">
          <div className="text-left">
            <p className="text-xs text-blue-300 font-medium">Gérer</p>
            <p className="text-sm font-bold">Mes devis</p>
          </div>
          <ChevronRight size={18} className="text-blue-300" />
        </button>
        <button onClick={() => navigate('/manager/chantiers')}
          className="flex items-center justify-between bg-accent-500 text-white rounded-2xl px-4 py-3.5 shadow-sm active:scale-95 transition-transform">
          <div className="text-left">
            <p className="text-xs text-orange-200 font-medium">Suivre</p>
            <p className="text-sm font-bold">Mes chantiers</p>
          </div>
          <ChevronRight size={18} className="text-orange-200" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button onClick={() => navigate('/manager/clients')}
          className="flex items-center gap-2.5 bg-white border border-slate-100 rounded-2xl px-3.5 py-2.5 shadow-card hover:border-primary-200 transition-colors active:scale-95">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
            <UserCircle2 size={15} className="text-violet-600" />
          </div>
          <span className="text-sm font-semibold text-slate-700">Clients</span>
        </button>
        <button onClick={() => navigate('/manager/parametres')}
          className="flex items-center gap-2.5 bg-white border border-slate-100 rounded-2xl px-3.5 py-2.5 shadow-card hover:border-primary-200 transition-colors active:scale-95">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <Settings size={15} className="text-slate-600" />
          </div>
          <span className="text-sm font-semibold text-slate-700">Réglages</span>
        </button>
      </div>

      {/* Recent activity */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Activité récente
          </h2>
        </div>

        {recentActivity.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
            <p className="text-sm text-slate-400">Aucune activité pour l'instant</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((item) => (
              <ActivityItem key={`${item._type}-${item.id}`} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ActivityItem({ item }) {
  const isDevis = item._type === 'devis'
  return (
    <div className="bg-white rounded-2xl p-3.5 shadow-card border border-slate-100 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDevis ? 'bg-blue-50' : 'bg-orange-50'}`}>
        {isDevis ? <FileText size={15} className="text-blue-600" /> : <HardHat size={15} className="text-accent-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">
          {isDevis ? item.client : item.nom}
        </p>
        <p className="text-xs text-slate-400 truncate">
          {isDevis
            ? `${formatCurrency(item.montantHT)} HT · ${formatDate(item.date)}`
            : `${item.client} · ${formatDate(item.dateDebut)}`}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <Badge statut={item.statut} />
        <span className="text-[10px] text-slate-300">{formatDateRelative(item.createdAt)}</span>
      </div>
    </div>
  )
}

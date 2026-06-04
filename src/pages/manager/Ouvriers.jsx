import { useEffect, useMemo, useState } from 'react'
import {
  UserPlus, Phone, Mail, Users, Briefcase, Loader2, AlertCircle,
  CheckCircle, Clock, XCircle, Copy, Check as CheckIcon, Info, Wrench,
} from 'lucide-react'
import { useOuvriers } from '../../hooks/useOuvriers'
import { useAuth } from '../../contexts/AuthContext'
import { ensureManagerEntreprise } from '../../services/entrepriseService'
import { supabase } from '../../services/supabase'
import Modal from '../../components/Modal'
import { SkeletonRowList } from '../../components/Skeleton'
import OuvrierPlanningPanel  from '../../components/OuvrierPlanningPanel'
import OuvrierPointagesPanel from '../../components/OuvrierPointagesPanel'

// Statut "disponibilité" déduit du nombre d'assignations actives
const STATUT_BADGES = {
  disponible:   { label: 'Disponible',  color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500',  Icon: CheckCircle },
  en_chantier:  { label: 'En chantier', color: 'bg-blue-50    text-blue-700',    dot: 'bg-blue-500',     Icon: Clock },
  inactif:      { label: 'Inactif',     color: 'bg-slate-100  text-slate-500',   dot: 'bg-slate-400',    Icon: XCircle },
}

export default function Ouvriers() {
  const { ouvriers, activeMap, loading, error, refresh, getStatutDispo } = useOuvriers()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [detailTarget, setDetailTarget] = useState(null)

  const stats = useMemo(() => {
    let dispo = 0, enChantier = 0, inactif = 0
    for (const o of ouvriers) {
      const s = getStatutDispo(o.id, o.statut)
      if (s === 'disponible')   dispo++
      else if (s === 'en_chantier') enChantier++
      else inactif++
    }
    return { dispo, enChantier, inactif, total: ouvriers.length }
  }, [ouvriers, getStatutDispo])

  return (
    <div className="px-4 pt-12 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Mon équipe</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {stats.total} ouvrier{stats.total > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-1.5 bg-accent-500 hover:bg-accent-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors"
        >
          <UserPlus size={16} strokeWidth={2.5} />
          Inviter
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <MiniStat icon={CheckCircle} label="Disponibles" value={stats.dispo} color="emerald" />
        <MiniStat icon={Clock}       label="En chantier" value={stats.enChantier} color="blue" />
        <MiniStat icon={XCircle}     label="Inactifs"   value={stats.inactif}   color="slate" />
      </div>

      {/* Error */}
      {error && (
        <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 text-xs text-red-700 mb-3">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* List */}
      {loading ? (
        <SkeletonRowList count={4} />
      ) : ouvriers.length === 0 ? (
        <EmptyState onInvite={() => setInviteOpen(true)} />
      ) : (
        <div className="space-y-2.5">
          {ouvriers.map((o) => (
            <OuvrierCard
              key={o.id}
              ouvrier={o}
              activeCount={activeMap[o.id] || 0}
              statutDispo={getStatutDispo(o.id, o.statut)}
              onClick={() => setDetailTarget(o)}
            />
          ))}
        </div>
      )}

      {/* Invite modal */}
      <Modal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} title="Inviter un ouvrier">
        <InviteOuvrierPanel onClose={() => setInviteOpen(false)} />
      </Modal>

      {/* Detail modal */}
      <Modal isOpen={!!detailTarget} onClose={() => setDetailTarget(null)} title={detailTarget ? fullName(detailTarget) : ''}>
        {detailTarget && (
          <OuvrierDetail
            ouvrier={detailTarget}
            activeCount={activeMap[detailTarget.id] || 0}
            statutDispo={getStatutDispo(detailTarget.id, detailTarget.statut)}
            onChange={refresh}
          />
        )}
      </Modal>
    </div>
  )
}

// ── Card ────────────────────────────────────────────────────────

function OuvrierCard({ ouvrier, activeCount, statutDispo, onClick }) {
  const badge = STATUT_BADGES[statutDispo]
  const initials = ((ouvrier.prenom?.[0] || '') + (ouvrier.nom?.[0] || '')).toUpperCase() || '?'

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl p-3.5 shadow-card border border-slate-100 text-left flex items-center gap-3 hover:border-primary-200 transition-colors"
    >
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-800 to-primary-600 flex items-center justify-center flex-shrink-0">
        <span className="text-white text-sm font-bold">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-900 truncate">{fullName(ouvrier)}</p>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
          {ouvrier.metier && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Briefcase size={11} />{ouvrier.metier}
            </span>
          )}
          {ouvrier.telephone && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Phone size={11} />{ouvrier.telephone}
            </span>
          )}
        </div>
      </div>
      {activeCount > 0 && (
        <div className="flex flex-col items-center bg-blue-50 px-2 py-1 rounded-lg">
          <span className="text-sm font-bold text-blue-700 leading-none">{activeCount}</span>
          <span className="text-[9px] text-blue-600 font-semibold uppercase">chantier{activeCount > 1 ? 's' : ''}</span>
        </div>
      )}
    </button>
  )
}

// ── Detail ──────────────────────────────────────────────────────

function OuvrierDetail({ ouvrier, activeCount, statutDispo, onChange }) {
  const badge = STATUT_BADGES[statutDispo]
  return (
    <div className="space-y-4">
      {/* Identité + statut */}
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-800 to-primary-600 flex items-center justify-center">
          <span className="text-white text-lg font-bold">
            {((ouvrier.prenom?.[0] || '') + (ouvrier.nom?.[0] || '')).toUpperCase() || '?'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-slate-900">{fullName(ouvrier)}</p>
          {ouvrier.metier && <p className="text-sm text-slate-500">{ouvrier.metier}</p>}
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${badge.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>
        </div>
      </div>

      {/* Contact + résumé */}
      <div className="bg-slate-50 rounded-xl p-3.5 space-y-2">
        {ouvrier.email && (
          <p className="text-sm text-slate-700 inline-flex items-center gap-2">
            <Mail size={14} className="text-slate-400" />{ouvrier.email}
          </p>
        )}
        {ouvrier.telephone && (
          <p className="text-sm text-slate-700 inline-flex items-center gap-2">
            <Phone size={14} className="text-slate-400" />{ouvrier.telephone}
          </p>
        )}
        <p className="text-sm text-slate-700 inline-flex items-center gap-2">
          <Briefcase size={14} className="text-slate-400" />
          {activeCount} chantier{activeCount > 1 ? 's' : ''} en cours
        </p>
      </div>

      {/* Pointages & heures travaillées */}
      <OuvrierPointagesPanel ouvrier={ouvrier} />

      {/* Séparateur visuel */}
      <div className="border-t border-slate-100" />

      {/* Planning hebdomadaire + assignations */}
      <OuvrierPlanningPanel ouvrier={ouvrier} onChange={onChange} />
    </div>
  )
}

// ── Invite panel : robuste avec fallback + auto-réparation ──────

function InviteOuvrierPanel({ onClose }) {
  const { entreprise: ctxEnt, user, refresh } = useAuth()

  // Si l'entreprise est dans le contexte, c'est bon. Sinon on tente une
  // requête directe (utilisateurs.entreprise_id), et en dernier recours
  // on propose un bouton "Réparer" qui crée l'entreprise + le lien.
  const [entreprise, setEntreprise] = useState(ctxEnt || null)
  const [phase,      setPhase]      = useState(ctxEnt ? 'ready' : 'loading')
  const [error,      setError]      = useState(null)
  const [copied,     setCopied]     = useState(false)
  const [repairing,  setRepairing]  = useState(false)

  useEffect(() => {
    if (ctxEnt) { setEntreprise(ctxEnt); setPhase('ready'); return }
    if (!user)  { setPhase('no_user');   return }

    let cancelled = false
    ;(async () => {
      try {
        const { data: profile } = await supabase
          .from('utilisateurs')
          .select('entreprise_id')
          .eq('id', user.id)
          .maybeSingle()

        if (cancelled) return

        if (!profile?.entreprise_id) {
          setPhase('needs_repair')
          return
        }

        const { data: ent } = await supabase
          .from('entreprise')
          .select('*')
          .eq('id', profile.entreprise_id)
          .maybeSingle()

        if (cancelled) return

        if (!ent) {
          setPhase('needs_repair')
        } else {
          setEntreprise(ent)
          setPhase('ready')
        }
      } catch (e) {
        if (cancelled) return
        setError(e?.message || 'Erreur de chargement')
        setPhase('error')
      }
    })()
    return () => { cancelled = true }
  }, [ctxEnt, user])

  async function handleRepair() {
    setRepairing(true)
    setError(null)
    const { entreprise: ent, error: e } = await ensureManagerEntreprise(user, {
      nom: 'Mon entreprise',
      email: user?.email,
    })
    setRepairing(false)
    if (e || !ent) {
      setError(e?.message || 'La réparation a échoué')
      return
    }
    setEntreprise(ent)
    setPhase('ready')
    refresh()   // met à jour le contexte global pour les prochains accès
  }

  const inviteUrl = entreprise?.id
    ? `${window.location.origin}/rejoindre/${entreprise.id}`
    : null

  function copy() {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  // ── États ────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="py-8 flex justify-center">
        <Loader2 size={20} className="animate-spin text-primary-700" />
      </div>
    )
  }

  if (phase === 'needs_repair') {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
          <div className="flex items-start gap-2">
            <Wrench size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900 mb-1">
                Votre compte n'est pas encore lié à une entreprise
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Cela arrive pour les comptes créés avant la configuration du trigger d'inscription.
                Cliquez ci-dessous pour créer votre entreprise et la lier à votre profil — ça ne prend qu'une seconde.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 text-xs text-red-700">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors">
            Annuler
          </button>
          <button onClick={handleRepair} disabled={repairing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent-500 hover:bg-accent-600 text-white font-semibold text-sm transition-colors disabled:opacity-60">
            {repairing
              ? <><Loader2 size={15} className="animate-spin" />Réparation…</>
              : <><Wrench size={14} />Réparer le lien</>}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'error' || phase === 'no_user') {
    return (
      <div className="space-y-4">
        <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 text-xs text-red-700">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <span>{error || 'Session expirée. Reconnectez-vous.'}</span>
        </div>
        <button onClick={onClose}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors">
          Fermer
        </button>
      </div>
    )
  }

  // phase === 'ready'
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5">
        <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-1">
          Lien d'inscription ouvrier
        </p>
        <p className="text-xs text-blue-700 leading-relaxed">
          Partagez ce lien à votre ouvrier (SMS, email, WhatsApp…). Il créera son compte
          et rejoindra automatiquement <strong>{entreprise.nom}</strong>. Il aura accès uniquement
          à son planning, ses chantiers et le pointage — pas aux chiffres de l'entreprise.
        </p>
      </div>

      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
        <p className="text-xs text-primary-700 font-mono flex-1 truncate">{inviteUrl}</p>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-900 transition-colors"
        >
          {copied ? <CheckIcon size={13} /> : <Copy size={13} />}
          {copied ? 'Copié' : 'Copier'}
        </button>
      </div>

      <button onClick={onClose}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors">
        Fermer
      </button>
    </div>
  )
}

// ── Misc ────────────────────────────────────────────────────────

function MiniStat({ icon: Icon, label, value, color }) {
  const palette = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600' },
    slate:   { bg: 'bg-slate-100',  text: 'text-slate-500' },
  }
  const c = palette[color] ?? palette.blue
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-card">
      <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center mb-1`}>
        <Icon size={13} className={c.text} strokeWidth={2.2} />
      </div>
      <p className="text-lg font-bold text-slate-900 tabular-nums">{value}</p>
      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{label}</p>
    </div>
  )
}

function EmptyState({ onInvite }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
      <Users size={32} className="mx-auto text-slate-300 mb-3" />
      <p className="text-sm font-semibold text-slate-700">Aucun ouvrier dans votre équipe</p>
      <p className="text-xs text-slate-400 mt-1 mb-4">Invitez votre premier collaborateur pour commencer.</p>
      <button onClick={onInvite}
        className="inline-flex items-center gap-1.5 bg-accent-500 hover:bg-accent-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
        <UserPlus size={14} />
        Inviter un ouvrier
      </button>
    </div>
  )
}

function fullName(u) {
  return [u.prenom, u.nom].filter(Boolean).join(' ') || u.email || '—'
}


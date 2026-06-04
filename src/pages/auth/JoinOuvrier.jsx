import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Mail, Lock, User, Briefcase, Phone, Loader2, AlertCircle,
  ArrowRight, CheckCircle, Building2, HardHat,
} from 'lucide-react'
import { supabase } from '../../services/supabase'

// Page d'inscription dediee aux ouvriers, accessible via un lien partage
// par le manager : /rejoindre/<entreprise_id>
// L'inscription cree un compte auth.users + une ligne utilisateurs avec
// role='ouvrier' rattache a l'entreprise (via le trigger SQL).
export default function JoinOuvrier() {
  const { entrepriseId } = useParams()
  const navigate = useNavigate()

  const [entreprise, setEntreprise] = useState(null)
  const [loadingEnt, setLoadingEnt] = useState(true)
  const [entErr,     setEntErr]     = useState(null)

  const [form, setForm] = useState({
    prenom: '', nom: '', email: '', telephone: '', metier: '', password: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState(null)
  const [done,       setDone]       = useState(false)

  // Charge le nom de l'entreprise via une fonction SECURITY DEFINER
  // (RLS bloque la lecture directe par un user non authentifie).
  useEffect(() => {
    if (!entrepriseId) {
      setEntErr('Lien d\'invitation invalide')
      setLoadingEnt(false)
      return
    }
    supabase.rpc('get_entreprise_public_info', { p_id: entrepriseId })
      .then(({ data, error }) => {
        if (error) {
          setEntErr(error.message)
        } else if (!data || data.length === 0) {
          setEntErr('Entreprise introuvable ou lien invalide')
        } else {
          setEntreprise(data[0])
        }
        setLoadingEnt(false)
      })
  }, [entrepriseId])

  function set(k, v) { setForm((p) => ({ ...p, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    setSubmitting(true)
    setError(null)

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email:    form.email.trim(),
      password: form.password,
      options: {
        data: {
          role:          'ouvrier',
          entreprise_id: entrepriseId,
          nom:           form.nom.trim(),
          prenom:        form.prenom.trim(),
          telephone:     form.telephone.trim(),
          metier:        form.metier.trim(),
        },
      },
    })

    setSubmitting(false)

    if (signUpErr) {
      setError(translateAuthError(signUpErr.message))
      return
    }

    if (data?.session) {
      // Session immediate (Confirm email desactive) -> on redirige.
      navigate('/ouvrier/planning', { replace: true })
    } else {
      // Confirmation email requise.
      setDone(true)
    }
  }

  // ── États ──────────────────────────────────────────────────────

  if (loadingEnt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 size={26} className="animate-spin text-primary-700" />
      </div>
    )
  }

  if (entErr) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-card p-7 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-3">
            <AlertCircle size={26} className="text-red-500" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-1">Lien invalide</h1>
          <p className="text-sm text-slate-600">{entErr}</p>
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-900 mt-5">
            Aller à la connexion <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-card p-7 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-3">
            <CheckCircle size={28} className="text-emerald-500" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Compte créé</h1>
          <p className="text-sm text-slate-600 mt-2">
            Un email de confirmation a été envoyé à <strong>{form.email}</strong>.
            Cliquez sur le lien pour activer votre compte, puis revenez vous connecter.
          </p>
          <Link to="/login" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-900">
            Aller à la connexion <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    )
  }

  // ── Formulaire ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent-50 via-slate-50 to-slate-100 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-accent-600 to-accent-500 flex items-center justify-center mb-3 shadow-lg">
            <HardHat size={26} className="text-white" />
          </div>
          <p className="text-xs font-semibold text-accent-700 uppercase tracking-widest mb-1">
            Inscription ouvrier
          </p>
          <h1 className="text-xl font-bold text-primary-900">Rejoindre l'équipe</h1>
          {entreprise?.nom && (
            <div className="inline-flex items-center gap-1.5 mt-2 bg-white rounded-full border border-slate-200 px-3 py-1">
              <Building2 size={12} className="text-slate-500" />
              <span className="text-xs font-semibold text-slate-700">{entreprise.nom}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-card p-6 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <FormField icon={User} label="Prénom">
              <input type="text" required autoComplete="given-name"
                value={form.prenom} onChange={(e) => set('prenom', e.target.value)}
                placeholder="Jean" className={inp} />
            </FormField>
            <FormField label="Nom">
              <input type="text" required autoComplete="family-name"
                value={form.nom} onChange={(e) => set('nom', e.target.value)}
                placeholder="Dupont" className={inp} />
            </FormField>
          </div>

          <FormField icon={Briefcase} label="Métier (optionnel)">
            <input type="text"
              value={form.metier} onChange={(e) => set('metier', e.target.value)}
              placeholder="Ex : Plombier, Électricien" className={inp} />
          </FormField>

          <FormField icon={Mail} label="Email">
            <input type="email" required autoComplete="email"
              value={form.email} onChange={(e) => set('email', e.target.value)}
              placeholder="vous@email.fr" className={inp} />
          </FormField>

          <FormField icon={Phone} label="Téléphone (optionnel)">
            <input type="tel" autoComplete="tel"
              value={form.telephone} onChange={(e) => set('telephone', e.target.value)}
              placeholder="06 12 34 56 78" className={inp} />
          </FormField>

          <FormField icon={Lock} label="Mot de passe">
            <input type="password" required autoComplete="new-password"
              value={form.password} onChange={(e) => set('password', e.target.value)}
              placeholder="8 caractères minimum" className={inp} />
          </FormField>

          {error && (
            <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 text-xs text-red-700">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent-500 hover:bg-accent-600 text-white font-semibold text-sm shadow-sm transition-colors disabled:opacity-60">
            {submitting
              ? <><Loader2 size={16} className="animate-spin" />Création…</>
              : <>Rejoindre l'équipe<ArrowRight size={15} /></>}
          </button>

          <p className="text-[10px] text-slate-400 text-center pt-1">
            Espace ouvrier : planning, chantiers, pointage et messages avec votre manager.
          </p>
        </form>

        <p className="text-center text-sm text-slate-500 mt-5">
          Déjà inscrit ?{' '}
          <Link to="/login" className="text-primary-700 font-semibold hover:text-primary-900">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}

const inp = 'w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/15'

function FormField({ icon: Icon, label, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
        {Icon && <Icon size={12} />}
        {label}
      </label>
      {children}
    </div>
  )
}

function translateAuthError(msg) {
  const m = (msg || '').toLowerCase()
  if (m.includes('already registered') || m.includes('already been registered')) return 'Cet email est déjà utilisé.'
  if (m.includes('weak password'))      return 'Mot de passe trop faible (minimum 8 caractères).'
  if (m.includes('invalid email'))      return 'Email invalide.'
  if (m.includes('rate limit'))         return 'Trop de tentatives. Réessayez dans quelques minutes.'
  return msg || 'Erreur lors de l\'inscription'
}

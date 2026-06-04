import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, Building2, Loader2, AlertCircle, ArrowRight, CheckCircle } from 'lucide-react'
import { signUpManager, signInWithPassword, fetchSessionProfile } from '../../services/auth'

export default function Signup() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    entrepriseNom: '',
    prenom:        '',
    nom:           '',
    email:         '',
    telephone:     '',
    password:      '',
  })
  const [loading, setLoading]   = useState(false)
  const [error,   setError]     = useState(null)
  const [done,    setDone]      = useState(false)   // signup OK mais email à confirmer

  function set(k, v) { setForm((p) => ({ ...p, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError(null)

    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      setLoading(false)
      return
    }

    const { data, error: signupErr } = await signUpManager({
      email:        form.email.trim(),
      password:     form.password,
      entrepriseNom: form.entrepriseNom.trim(),
      prenom:       form.prenom.trim(),
      nom:          form.nom.trim(),
      telephone:    form.telephone.trim(),
    })

    if (signupErr) {
      setError(translateAuthError(signupErr.message))
      setLoading(false)
      return
    }

    // Si la session est immédiate (confirmation désactivée) → on connecte direct.
    if (data?.session) {
      // Le trigger SQL a déjà créé entreprise + utilisateurs.
      await new Promise((r) => setTimeout(r, 400))
      await fetchSessionProfile()
      navigate('/manager/dashboard', { replace: true })
      return
    }

    // Confirmation par email requise.
    setDone(true)
    setLoading(false)
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
          <Link
            to="/login"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-900"
          >
            Aller à la connexion <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-[1.25rem] bg-accent-500 flex items-center justify-center mb-4 shadow-xl">
            <svg width="36" height="36" viewBox="0 0 52 52" fill="none" aria-hidden="true">
              <path d="M10 40L26 12L42 40H10Z" fill="white" fillOpacity="0.95" />
              <circle cx="26" cy="33" r="5" fill="#1e3a5f" />
              <rect x="20" y="38" width="12" height="3" rx="1.5" fill="white" fillOpacity="0.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-primary-900">Créer mon entreprise</h1>
          <p className="text-sm text-slate-500 mt-1">Inscription en 30 secondes</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-card p-6 space-y-3.5">
          <FormField icon={Building2} label="Nom de l'entreprise">
            <input
              type="text" required autoComplete="organization"
              value={form.entrepriseNom}
              onChange={(e) => set('entrepriseNom', e.target.value)}
              placeholder="Dupont Plomberie"
              className={inp}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField icon={User} label="Prénom">
              <input
                type="text" required autoComplete="given-name"
                value={form.prenom}
                onChange={(e) => set('prenom', e.target.value)}
                placeholder="Jean"
                className={inp}
              />
            </FormField>
            <FormField label="Nom">
              <input
                type="text" required autoComplete="family-name"
                value={form.nom}
                onChange={(e) => set('nom', e.target.value)}
                placeholder="Dupont"
                className={inp}
              />
            </FormField>
          </div>

          <FormField icon={Mail} label="Email professionnel">
            <input
              type="email" required autoComplete="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="contact@dupont-plomberie.fr"
              className={inp}
            />
          </FormField>

          <FormField label="Téléphone (optionnel)">
            <input
              type="tel" autoComplete="tel"
              value={form.telephone}
              onChange={(e) => set('telephone', e.target.value)}
              placeholder="06 12 34 56 78"
              className={inp}
            />
          </FormField>

          <FormField icon={Lock} label="Mot de passe">
            <input
              type="password" required autoComplete="new-password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder="8 caractères minimum"
              className={inp}
            />
          </FormField>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 text-xs text-red-700 space-y-2">
              <div className="flex gap-2">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{error.message}</span>
              </div>
              {error.fix && (
                <div className="bg-white rounded-lg px-3 py-2 border border-red-100 text-slate-700 space-y-1">
                  <p className="text-[11px] font-semibold text-slate-800 uppercase tracking-wide">Comment corriger</p>
                  {error.fix.map((step, i) => (
                    <p key={i} className="text-[11px] leading-relaxed">{i + 1}. {step}</p>
                  ))}
                  {error.link && (
                    <a href={error.link} target="_blank" rel="noopener noreferrer"
                       className="inline-block text-[11px] font-semibold text-primary-700 hover:text-primary-900 mt-1">
                      Ouvrir le dashboard Supabase →
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent-500 hover:bg-accent-600 text-white font-semibold text-sm shadow-sm transition-colors disabled:opacity-60"
          >
            {loading
              ? <><Loader2 size={16} className="animate-spin" />Création…</>
              : <>Créer mon compte<ArrowRight size={15} /></>}
          </button>

          <p className="text-[10px] text-slate-400 text-center pt-1">
            En créant un compte vous acceptez nos conditions d'utilisation.
          </p>
        </form>

        <p className="text-center text-sm text-slate-500 mt-5">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-primary-700 font-semibold hover:text-primary-900">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}

const inp = 'w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-primary-700 focus:ring-2 focus:ring-primary-900/10'

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

function translateAuthError(rawMsg) {
  const msg = (rawMsg || '').toLowerCase()

  if (msg.includes('email rate limit exceeded') || msg.includes('rate limit')) {
    return {
      message: 'Le quota d\'emails de Supabase est atteint (limite gratuite : ~4 emails/heure).',
      fix: [
        'Ouvrez votre dashboard Supabase → projet zptxycatjuhjhjpsctot',
        'Allez dans Authentication → Providers → Email',
        'Décochez « Confirm email » puis cliquez sur Save',
        'Revenez ici et réessayez : aucun email ne sera envoyé.',
      ],
      link: 'https://supabase.com/dashboard/project/zptxycatjuhjhjpsctot/auth/providers',
    }
  }

  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return { message: 'Cet email est déjà utilisé. Connectez-vous ou utilisez une autre adresse.' }
  }
  if (msg.includes('weak password') || msg.includes('password should be')) {
    return { message: 'Mot de passe trop faible (minimum 8 caractères, mélangez lettres et chiffres).' }
  }
  if (msg.includes('invalid email')) {
    return { message: 'Adresse email invalide.' }
  }
  if (msg.includes('database error') || msg.includes('unexpected_failure')) {
    return {
      message: 'Erreur côté base de données : le trigger d\'inscription a échoué.',
      fix: [
        'Vérifiez que le script supabase-setup.sql a bien été exécuté dans l\'éditeur SQL Supabase',
        'En particulier la fonction handle_new_manager_signup et le trigger on_auth_user_created',
      ],
      link: 'https://supabase.com/dashboard/project/zptxycatjuhjhjpsctot/sql/new',
    }
  }
  return { message: rawMsg || 'Erreur lors de l\'inscription.' }
}

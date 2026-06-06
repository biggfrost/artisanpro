import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, Loader2, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../contexts/AuthContext'

const SUPABASE_ERRORS = {
  'Invalid login credentials':          'Email ou mot de passe incorrect.',
  'Email not confirmed':                'Veuillez confirmer votre email avant de vous connecter.',
  'Too many requests':                  'Trop de tentatives. Patientez quelques minutes.',
  'User not found':                     'Aucun compte trouvé avec cet email.',
  'Password should be at least 6 characters': 'Le mot de passe doit faire au moins 6 caractères.',
  'Unable to validate email address: invalid format': 'Adresse email invalide.',
}

function translateError(msg) {
  if (!msg) return 'Une erreur est survenue. Réessayez.'
  for (const [en, fr] of Object.entries(SUPABASE_ERRORS)) {
    if (msg.includes(en)) return fr
  }
  return msg
}

export default function Login() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const from      = location.state?.from?.pathname
  const { isAuthenticated, role, loading: authLoading } = useAuth()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const target = from || (role === 'ouvrier' ? '/ouvrier/planning' : '/manager/dashboard')
      navigate(target, { replace: true })
    }
  }, [authLoading, isAuthenticated, role, from, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError("Connexion impossible hors-ligne. Reconnectez-vous à internet pour vous identifier (une fois connecté, l'app reste accessible sans réseau).")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) { setError(translateError(signInErr.message)); return }
      navigate('/', { replace: true })
    } catch (err) {
      setError(translateError(err?.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-[1.25rem] bg-accent-500 flex items-center justify-center mb-4 shadow-xl">
            <svg width="36" height="36" viewBox="0 0 52 52" fill="none" aria-hidden="true">
              <path d="M10 40L26 12L42 40H10Z" fill="white" fillOpacity="0.95" />
              <circle cx="26" cy="33" r="5" fill="#1e3a5f" />
              <rect x="20" y="38" width="12" height="3" rx="1.5" fill="white" fillOpacity="0.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-primary-900">ArtisanPro</h1>
          <p className="text-sm text-slate-500 mt-1">Connectez-vous à votre espace</p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-card p-6 space-y-4 border border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email" required autoComplete="email"
                value={email} onChange={(e) => { setEmail(e.target.value); setError(null) }}
                placeholder="vous@entreprise.fr"
                className="w-full pl-10 pr-3.5 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary-700 focus:ring-2 focus:ring-primary-900/10 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Mot de passe
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPwd ? 'text' : 'password'} required autoComplete="current-password"
                value={password} onChange={(e) => { setPassword(e.target.value); setError(null) }}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary-700 focus:ring-2 focus:ring-primary-900/10 transition-all"
              />
              <button
                type="button" onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                tabIndex={-1}
              >
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-3 text-xs text-red-700 animate-fade-in">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit" disabled={loading || !email || !password}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary-900 hover:bg-primary-800 text-white font-bold text-sm shadow-sm transition-all disabled:opacity-50"
          >
            {loading
              ? <><Loader2 size={16} className="animate-spin" />Connexion…</>
              : <>Se connecter <ArrowRight size={15} /></>}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-5">
          Pas encore de compte ?{' '}
          <Link to="/signup" className="text-primary-700 font-semibold hover:text-primary-900 transition-colors">
            Créer mon entreprise
          </Link>
        </p>
      </div>
    </div>
  )
}

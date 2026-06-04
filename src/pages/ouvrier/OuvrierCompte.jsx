import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, Mail, Phone, Briefcase, Building2, LogOut, Loader2,
  ShieldCheck, AlertCircle,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { signOut } from '../../services/auth'
import Modal from '../../components/Modal'

export default function OuvrierCompte() {
  const navigate = useNavigate()
  const { profile, entreprise, user } = useAuth()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState(null)

  async function handleLogout() {
    setLoggingOut(true)
    setError(null)
    const { error: e } = await signOut()
    setLoggingOut(false)
    if (e) {
      setError(e.message || 'Erreur lors de la déconnexion')
      return
    }
    navigate('/login', { replace: true })
  }

  const fullName = [profile?.prenom, profile?.nom].filter(Boolean).join(' ')
  const initials = (
    (profile?.prenom?.[0] || '') + (profile?.nom?.[0] || '')
  ).toUpperCase() || (profile?.email?.[0] || '?').toUpperCase()

  return (
    <div className="px-4 pt-12 pb-6">
      <div className="mb-5">
        <p className="text-sm text-slate-500 font-medium">Mon profil</p>
        <h1 className="text-2xl font-bold text-primary-900">Compte</h1>
      </div>

      {/* Identité */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 mb-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-800 to-primary-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xl font-bold">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-slate-900 truncate">{fullName || 'Utilisateur'}</p>
          {profile?.metier && <p className="text-sm text-slate-500">{profile.metier}</p>}
          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold uppercase tracking-wide bg-accent-50 text-accent-700 px-2 py-0.5 rounded-full">
            <ShieldCheck size={10} />
            Ouvrier
          </span>
        </div>
      </div>

      {/* Coordonnées */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 mb-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Coordonnées</p>
        {profile?.email && (
          <div className="flex items-center gap-3">
            <Mail size={15} className="text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-700 truncate">{profile.email}</span>
          </div>
        )}
        {profile?.telephone && (
          <div className="flex items-center gap-3">
            <Phone size={15} className="text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-700">{profile.telephone}</span>
          </div>
        )}
        {profile?.metier && (
          <div className="flex items-center gap-3">
            <Briefcase size={15} className="text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-700">{profile.metier}</span>
          </div>
        )}
      </div>

      {/* Entreprise */}
      {entreprise && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 mb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Entreprise</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Building2 size={16} className="text-slate-600" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-slate-900 truncate">{entreprise.nom}</p>
              {entreprise.siret && <p className="text-xs text-slate-500">SIRET : {entreprise.siret}</p>}
              {(entreprise.code_postal || entreprise.ville) && (
                <p className="text-xs text-slate-500">
                  {[entreprise.code_postal, entreprise.ville].filter(Boolean).join(' ')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info session — rassure sur la persistance */}
      <div className="flex gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5 mb-4">
        <ShieldCheck size={15} className="text-emerald-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-emerald-800 leading-relaxed">
          Votre session reste active tant que vous ne vous déconnectez pas manuellement.
        </p>
      </div>

      {/* Déconnexion */}
      <button
        onClick={() => setConfirmOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-sm border border-red-100 transition-colors"
      >
        <LogOut size={16} />
        Se déconnecter
      </button>

      <p className="text-[10px] text-slate-400 text-center mt-3">
        Connecté en tant que {user?.email}
      </p>

      {/* Modal de confirmation */}
      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirmer la déconnexion">
        <p className="text-sm text-slate-600 mb-4">
          Vous serez redirigé vers l'écran de connexion. Vos données restent sauvegardées —
          vous pourrez vous reconnecter à tout moment avec votre email et mot de passe.
        </p>

        {error && (
          <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700 mb-3">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setConfirmOpen(false)}
            disabled={loggingOut}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors disabled:opacity-60"
          >
            {loggingOut ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={14} />}
            Déconnecter
          </button>
        </div>
      </Modal>
    </div>
  )
}


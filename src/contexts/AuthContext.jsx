import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { fetchSessionProfile, onAuthChange, signOut } from '../services/auth'

const AuthContext = createContext(null)

const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 min
const EVENTS = ['mousedown', 'touchstart', 'keydown', 'scroll', 'click']

export function AuthProvider({ children }) {
  const [loading,       setLoading]       = useState(true)
  const [user,          setUser]          = useState(null)
  const [profile,       setProfile]       = useState(null)
  const [entreprise,    setEntreprise]    = useState(null)
  const [sessionExpired, setSessionExpired] = useState(false)

  const timerRef   = useRef(null)
  const userRef    = useRef(null)
  userRef.current  = user

  const refresh = useCallback(async () => {
    try {
      const data = await fetchSessionProfile()
      setUser(data.user)
      setProfile(data.profile)
      setEntreprise(data.entreprise)
    } catch (e) {
      console.warn('[auth] refresh failed:', e?.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Réinitialise le timer d'inactivité sans dépendre de `user` pour éviter les reboucles
  const resetTimer = useCallback(() => {
    if (!userRef.current) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setSessionExpired(true), SESSION_TIMEOUT_MS)
  }, [])

  // Démarre / stoppe l'écoute selon l'état de connexion
  useEffect(() => {
    if (!user) {
      clearTimeout(timerRef.current)
      return
    }
    EVENTS.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, resetTimer))
      clearTimeout(timerRef.current)
    }
  }, [user, resetTimer])

  // Init auth
  useEffect(() => {
    refresh()
    const { data: { subscription } } = onAuthChange(() => refresh())
    const onVisible = () => { if (!document.hidden) refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      subscription?.unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [refresh])

  async function handleSignOut() {
    setSessionExpired(false)
    clearTimeout(timerRef.current)
    await signOut()
    setUser(null); setProfile(null); setEntreprise(null)
  }

  function handleStayConnected() {
    setSessionExpired(false)
    resetTimer()
  }

  return (
    <AuthContext.Provider value={{
      loading,
      user,
      profile,
      entreprise,
      role: profile?.role ?? null,
      isAuthenticated: !!user,
      refresh,
    }}>
      {children}

      {/* Modal expiration de session */}
      {sessionExpired && (
        <div className="fixed inset-0 z-[9995] bg-black/60 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-slide-up">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-4 mx-auto">
              <span className="text-2xl">⏰</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Session inactive</h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              Vous n'avez pas été actif depuis 30 minutes.<br />
              Voulez-vous rester connecté ?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleSignOut}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium"
              >
                Déconnexion
              </button>
              <button
                onClick={handleStayConnected}
                className="flex-1 py-3 rounded-xl bg-primary-900 text-white text-sm font-bold"
              >
                Rester connecté
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

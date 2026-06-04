import { Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

// Guards a route subtree.
// - Auth loading      → spinner
// - Not authenticated → /login
// - Authenticated but no profile row (SQL pas exécuté) → on laisse passer
//   l'utilisateur côté manager (par défaut). Une bannière dans Paramètres
//   indique qu'il faut exécuter le SQL.
// - Mauvais rôle      → redirige vers le bon dashboard.
export default function ProtectedRoute({ children, role }) {
  const { loading, isAuthenticated, role: currentRole, profile } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={26} className="animate-spin text-primary-700" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Pas de profil : tolère l'accès au sous-arbre "manager" par défaut,
  // pour éviter une page bloquée si le SQL setup n'a pas été lancé.
  if (!profile) {
    if (role && role !== 'manager') {
      return <Navigate to="/manager/dashboard" replace />
    }
    return children
  }

  if (role && currentRole !== role) {
    const target = currentRole === 'manager' ? '/manager/dashboard' : '/ouvrier/planning'
    return <Navigate to={target} replace />
  }

  return children
}

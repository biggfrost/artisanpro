import { lazy, Suspense, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { NotificationsProvider } from './contexts/NotificationsContext'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import NetworkStatus from './components/NetworkStatus'
import SplashScreen from './components/SplashScreen'
import Onboarding from './components/Onboarding'
import InstallBanner from './components/InstallBanner'

// ── Layouts ──────────────────────────────────────────────────────
import ManagerLayout from './components/ManagerLayout'
import OuvrierLayout from './components/OuvrierLayout'

// ── Pages publiques (lazy) ────────────────────────────────────────
const Login        = lazy(() => import('./pages/auth/Login'))
const Signup       = lazy(() => import('./pages/auth/Signup'))
const JoinOuvrier  = lazy(() => import('./pages/auth/JoinOuvrier'))
const Signer       = lazy(() => import('./pages/Signer'))

// ── Pages manager (lazy) ─────────────────────────────────────────
const Dashboard           = lazy(() => import('./pages/Dashboard'))
const DashboardPro        = lazy(() => import('./pages/DashboardPro'))
const Devis               = lazy(() => import('./pages/Devis'))
const Chantiers           = lazy(() => import('./pages/Chantiers'))
const Parametres          = lazy(() => import('./pages/Parametres'))
const Clients             = lazy(() => import('./pages/manager/Clients'))
const Ouvriers            = lazy(() => import('./pages/manager/Ouvriers'))
const MessagesManager     = lazy(() => import('./pages/manager/MessagesManager'))
const NotificationsCenter = lazy(() => import('./pages/NotificationsCenter'))

// ── Pages ouvrier (lazy) ─────────────────────────────────────────
const OuvrierPlanning  = lazy(() => import('./pages/ouvrier/OuvrierPlanning'))
const OuvrierChantiers = lazy(() => import('./pages/ouvrier/OuvrierChantiers'))
const OuvrierDevis     = lazy(() => import('./pages/ouvrier/OuvrierDevis'))
const OuvrierHeures    = lazy(() => import('./pages/ouvrier/OuvrierHeures'))
const OuvrierMessages  = lazy(() => import('./pages/ouvrier/OuvrierMessages'))
const OuvrierCompte    = lazy(() => import('./pages/ouvrier/OuvrierCompte'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,         // 1 min
      gcTime:    5 * 60 * 1000,     // 5 min
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 size={26} className="animate-spin text-primary-700" />
    </div>
  )
}

function RootRedirect() {
  const { loading, isAuthenticated, role } = useAuth()
  if (loading) return <PageLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (role === 'ouvrier') return <Navigate to="/ouvrier/planning" replace />
  return <Navigate to="/manager/dashboard" replace />
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* ─── Public ──────────────────────────────────────── */}
        <Route path="/signer/:token"            element={<Signer />} />
        <Route path="/login"                    element={<Login />} />
        <Route path="/signup"                   element={<Signup />} />
        <Route path="/rejoindre/:entrepriseId"  element={<JoinOuvrier />} />

        {/* ─── Redirection racine ───────────────────────────── */}
        <Route path="/" element={<RootRedirect />} />

        {/* ─── Espace MANAGER ──────────────────────────────── */}
        <Route
          path="/manager"
          element={
            <ProtectedRoute role="manager">
              <ManagerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/manager/dashboard" replace />} />
          <Route path="dashboard"           element={<Dashboard />} />
          <Route path="dashboard-pro"       element={<DashboardPro />} />
          <Route path="devis"               element={<Devis />} />
          <Route path="chantiers"           element={<Chantiers />} />
          <Route path="clients"             element={<Clients />} />
          <Route path="ouvriers"            element={<Ouvriers />} />
          <Route path="messages"            element={<MessagesManager />} />
          <Route path="messages/:ouvrierId" element={<MessagesManager />} />
          <Route path="parametres"          element={<Parametres />} />
          <Route path="notifications"       element={<NotificationsCenter />} />
        </Route>

        {/* ─── Espace OUVRIER ──────────────────────────────── */}
        <Route
          path="/ouvrier"
          element={
            <ProtectedRoute role="ouvrier">
              <OuvrierLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/ouvrier/planning" replace />} />
          <Route path="planning"      element={<OuvrierPlanning />} />
          <Route path="chantiers"     element={<OuvrierChantiers />} />
          <Route path="devis"         element={<OuvrierDevis />} />
          <Route path="heures"        element={<OuvrierHeures />} />
          <Route path="messages"      element={<OuvrierMessages />} />
          <Route path="compte"        element={<OuvrierCompte />} />
          <Route path="notifications" element={<NotificationsCenter />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  const [splashDone, setSplashDone]       = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(
    () => !!localStorage.getItem('artisanpro_onboarding_done')
  )

  const handleSplashDone = useCallback(() => setSplashDone(true), [])
  const handleOnboardingDone = useCallback(() => setOnboardingDone(true), [])

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <NotificationsProvider>
                <NetworkStatus />
                <InstallBanner />
                {!splashDone && <SplashScreen onDone={handleSplashDone} />}
                {splashDone && !onboardingDone && <Onboarding onDone={handleOnboardingDone} />}
                {splashDone && onboardingDone && <AppRoutes />}
              </NotificationsProvider>
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

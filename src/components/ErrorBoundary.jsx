import { Component } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

// Capture les erreurs React non gérées dans le sous-arbre.
// Affiche un écran propre en français au lieu d'un écran blanc.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // En prod on pourrait logger vers Supabase / Sentry ici.
    console.error('[ErrorBoundary]', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  handleHome = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-card p-7 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-50 flex items-center justify-center mb-4">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">Oups, une erreur est survenue</h1>
          <p className="text-sm text-slate-600 mb-5">
            Quelque chose s'est mal passé. Vos données sont sauvegardées — vous pouvez
            recharger la page sans risque.
          </p>

          {import.meta.env.DEV && this.state.error && (
            <pre className="text-[10px] text-left bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-4 overflow-x-auto text-slate-600">
              {this.state.error.message}
            </pre>
          )}

          <div className="flex gap-2">
            <button onClick={this.handleHome}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
              <Home size={14} />
              Accueil
            </button>
            <button onClick={this.handleReload}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary-900 text-white font-semibold text-sm shadow-sm hover:bg-primary-800 transition-colors">
              <RefreshCw size={14} />
              Recharger
            </button>
          </div>
        </div>
      </div>
    )
  }
}

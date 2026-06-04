import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]) // max 3 toasts visibles
    if (duration > 0) {
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration)
    }
    return id
  }, [])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const value = {
    push,
    dismiss,
    success: (msg, d) => push(msg, 'success', d),
    error:   (msg, d) => push(msg, 'error',   d),
    info:    (msg, d) => push(msg, 'info',    d),
    warning: (msg, d) => push(msg, 'warning', d),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) return { push: () => null, dismiss: () => null, success: () => null, error: () => null, info: () => null, warning: () => null }
  return ctx
}

function Toaster({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-24 left-0 right-0 z-[9998] flex flex-col items-center gap-2 px-4 max-w-lg mx-auto pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  )
}

const STYLES = {
  success: { bg: 'bg-emerald-600', icon: CheckCircle },
  error:   { bg: 'bg-red-600',     icon: AlertCircle },
  warning: { bg: 'bg-amber-500',   icon: AlertCircle },
  info:    { bg: 'bg-primary-900', icon: Info },
}

function ToastItem({ toast, onDismiss }) {
  const cfg  = STYLES[toast.type] || STYLES.info
  const Icon = cfg.icon
  return (
    <div className={`pointer-events-auto w-full flex items-center gap-3 ${cfg.bg} text-white rounded-2xl px-4 py-3 shadow-xl animate-toast-in`}>
      <Icon size={16} className="flex-shrink-0" />
      <p className="text-sm font-semibold flex-1 min-w-0">{toast.message}</p>
      <button onClick={onDismiss} className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity p-0.5">
        <X size={14} />
      </button>
    </div>
  )
}

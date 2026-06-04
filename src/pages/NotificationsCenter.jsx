import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Trash2, ChevronRight, ArrowLeft, X } from 'lucide-react'
import { useNotifications } from '../contexts/NotificationsContext'
import { formatDateRelative } from '../utils/formatters'

const TYPE_ICONS = {
  devis_a_valider:  '📋',
  devis_valide:     '✅',
  devis_refuse:     '❌',
  devis_signe:      '✅',
  pointage_arrivee: '📍',
  chantier_termine: '🏁',
  nouveau_chantier: '🔨',
  message:          '💬',
  rappel:           '⏰',
}

export default function NotificationsCenter() {
  const navigate = useNavigate()
  const { notifications, unread, markAllRead, clearAll } = useNotifications()
  const [confirmClear, setConfirmClear] = useState(false)

  // Marque tout comme lu 800ms après l'ouverture
  useEffect(() => {
    if (unread > 0) {
      const t = setTimeout(markAllRead, 800)
      return () => clearTimeout(t)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const last30 = notifications.filter(
    (n) => Date.now() - new Date(n.createdAt).getTime() < 30 * 24 * 3600 * 1000
  )

  return (
    <div className="px-4 pt-12 pb-6 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-card"
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-primary-900">Notifications</h1>
          <p className="text-xs text-slate-400">
            {last30.length === 0 ? 'Aucune' : `${last30.length} des 30 derniers jours`}
          </p>
        </div>
        {last30.length > 0 && (
          <button
            onClick={() => setConfirmClear(true)}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center"
            title="Tout supprimer"
          >
            <Trash2 size={16} className="text-red-400" />
          </button>
        )}
      </div>

      {last30.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-5">
            <Bell size={32} className="text-slate-300" />
          </div>
          <p className="text-base font-semibold text-slate-400">Aucune notification</p>
          <p className="text-sm text-slate-300 mt-1">
            Vous serez alerté en temps réel des événements importants
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {last30.map((n) => (
            <NotifItem key={n.id} notif={n} onNavigate={() => n.link && navigate(n.link)} />
          ))}
        </div>
      )}

      {confirmClear && (
        <div
          className="fixed inset-0 z-[200] bg-black/50 flex items-end justify-center p-4"
          onClick={() => setConfirmClear(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-sm p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900">Tout supprimer ?</h3>
              <button onClick={() => setConfirmClear(false)} className="text-slate-400">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-5">
              Les {last30.length} notifications seront effacées définitivement.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmClear(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
              >
                Annuler
              </button>
              <button
                onClick={() => { clearAll(); setConfirmClear(false) }}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-bold"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NotifItem({ notif: n, onNavigate }) {
  return (
    <button
      onClick={onNavigate}
      className={`w-full text-left rounded-2xl p-4 border transition-all active:scale-[0.99] flex items-start gap-3 ${
        n.read ? 'bg-white border-slate-100' : 'bg-blue-50 border-blue-100'
      }`}
    >
      <span className="text-xl leading-none flex-shrink-0 mt-0.5">
        {TYPE_ICONS[n.type] || '🔔'}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-tight ${n.read ? 'text-slate-700' : 'text-slate-900'}`}>
          {n.title}
        </p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
        <p className="text-[10px] text-slate-400 mt-1.5">{formatDateRelative(n.createdAt)}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
        {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse-dot" />}
        {n.link && <ChevronRight size={15} className="text-slate-300" />}
      </div>
    </button>
  )
}

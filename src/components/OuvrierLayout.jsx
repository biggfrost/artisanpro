import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Calendar, FileText, MessageCircle, UserCircle, Bell } from 'lucide-react'
import { useUnreadMessages } from '../hooks/useUnreadMessages'
import { useNotifications } from '../contexts/NotificationsContext'

const NAV = [
  { to: '/ouvrier/planning',  icon: Calendar,      label: "Aujourd'hui" },
  { to: '/ouvrier/devis',     icon: FileText,      label: 'Devis'       },
  { to: '/ouvrier/messages',  icon: MessageCircle, label: 'Messages',   badge: 'messages' },
  { to: '/ouvrier/compte',    icon: UserCircle,    label: 'Mon compte'  },
]

export default function OuvrierLayout() {
  const { count: unreadMessages } = useUnreadMessages()
  const { unread: unreadNotifs }  = useNotifications()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-lg mx-auto relative">
      {/* Bouton notifications — centré dans le conteneur max-w-lg */}
      <div className="fixed top-0 left-0 right-0 z-40 flex justify-end max-w-lg mx-auto pointer-events-none">
        <button
          onClick={() => navigate('/ouvrier/notifications')}
          className="pointer-events-auto mt-4 mr-4 w-10 h-10 bg-white rounded-xl shadow-card border border-slate-100 flex items-center justify-center relative"
          aria-label="Notifications"
        >
          <Bell size={18} className="text-slate-500" />
          {unreadNotifs > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
              {unreadNotifs > 9 ? '9+' : unreadNotifs}
            </span>
          )}
        </button>
      </div>

      <main className="flex-1 pb-24 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white z-50 shadow-nav border-t border-slate-100">
        <div className="flex max-w-lg mx-auto">
          {NAV.map(({ to, icon: Icon, label, badge }) => {
            const showBadge = badge === 'messages' && unreadMessages > 0
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex-1 flex flex-col items-center justify-center pt-3 pb-safe gap-0.5 relative transition-colors min-h-[64px] ${
                    isActive ? 'text-accent-600' : 'text-slate-400'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[3px] bg-accent-500 rounded-b-full" />
                    )}
                    <div className="relative">
                      <Icon size={22} strokeWidth={isActive ? 2.5 : 1.75} />
                      {showBadge && (
                        <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                          {unreadMessages > 9 ? '9+' : unreadMessages}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold pb-1">{label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

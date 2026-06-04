import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FileText, HardHat, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Accueil'    },
  { to: '/devis',      icon: FileText,        label: 'Devis'      },
  { to: '/chantiers',  icon: HardHat,         label: 'Chantiers'  },
  { to: '/parametres', icon: Settings,        label: 'Réglages'   },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white z-50 shadow-nav">
      <div className="flex max-w-lg mx-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center pt-3 pb-safe gap-1 relative transition-colors min-h-[60px] ${
                isActive ? 'text-primary-900' : 'text-slate-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[3px] bg-accent-500 rounded-b-full" />
                )}
                <Icon size={21} strokeWidth={isActive ? 2.5 : 1.75} />
                <span className="text-[11px] font-medium pb-1">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

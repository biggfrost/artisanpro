import { useState } from 'react'
import { ChevronRight, FileText, HardHat, Users, Bell, Smartphone } from 'lucide-react'

const STEPS = [
  {
    icon: Smartphone,
    bg: 'from-primary-900 to-primary-800',
    title: 'Bienvenue sur ArtisanPro',
    desc: "Votre assistant professionnel pour gérer devis, chantiers et équipe — directement depuis votre téléphone.",
  },
  {
    icon: FileText,
    bg: 'from-accent-500 to-accent-600',
    title: 'Créez vos devis en 2 minutes',
    desc: "Générez des devis PDF professionnels, envoyez-les par email et recevez les signatures électroniques de vos clients.",
  },
  {
    icon: HardHat,
    bg: 'from-emerald-500 to-emerald-600',
    title: 'Suivez vos chantiers',
    desc: "Créez des chantiers, assignez vos ouvriers et suivez l'avancement en temps réel depuis votre tableau de bord.",
  },
  {
    icon: Users,
    bg: 'from-violet-600 to-violet-700',
    title: 'Gérez votre équipe',
    desc: "Vos ouvriers pointent leurs arrivées et départs depuis l'app. Vous recevez une notification à chaque pointage.",
  },
  {
    icon: Bell,
    bg: 'from-blue-500 to-blue-600',
    title: 'Notifications en temps réel',
    desc: "Soyez alerté dès qu'un devis est signé, qu'un ouvrier arrive sur chantier, ou qu'un message vous est envoyé.",
  },
]

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0)

  function finish() {
    localStorage.setItem('artisanpro_onboarding_done', '1')
    onDone()
  }

  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1)
    else finish()
  }

  const s    = STEPS[step]
  const Icon = s.icon
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[9990] bg-white flex flex-col overflow-hidden">
      {/* Zone colorée du haut */}
      <div className={`bg-gradient-to-br ${s.bg} flex-1 flex flex-col items-center justify-center transition-all duration-300`}>
        {/* Icône avec clé pour forcer l'animation à chaque étape */}
        <div key={step} className="flex flex-col items-center gap-5 animate-splash-in px-8 text-center">
          <div className="w-28 h-28 rounded-[2rem] bg-white/20 flex items-center justify-center shadow-2xl">
            <Icon size={52} className="text-white" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2 leading-tight">{s.title}</h2>
            <p className="text-sm text-white/80 leading-relaxed max-w-xs">{s.desc}</p>
          </div>
        </div>
      </div>

      {/* Zone blanche du bas */}
      <div className="bg-white px-8 pt-6 pb-10">
        {/* Bouton passer */}
        <div className="flex justify-end mb-4 -mt-2">
          {!isLast && (
            <button onClick={finish} className="text-sm text-slate-400 font-medium px-2 py-1">
              Passer
            </button>
          )}
        </div>

        {/* Points de progression */}
        <div className="flex justify-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <button key={i} onClick={() => setStep(i)}
              className={`rounded-full transition-all duration-300 ${
                i === step ? 'w-6 h-2 bg-primary-900' : i < step ? 'w-2 h-2 bg-primary-300' : 'w-2 h-2 bg-slate-200'
              }`}
            />
          ))}
        </div>

        <button
          onClick={next}
          className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base shadow-lg transition-all active:scale-95 ${
            isLast
              ? 'bg-accent-500 text-white'
              : 'bg-primary-900 text-white'
          }`}
        >
          {isLast ? 'Commencer maintenant 🚀' : (<>Suivant <ChevronRight size={18} /></>)}
        </button>
      </div>
    </div>
  )
}

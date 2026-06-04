import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[92vh] flex flex-col shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}

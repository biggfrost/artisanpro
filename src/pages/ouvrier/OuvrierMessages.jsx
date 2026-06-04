import { useEffect, useRef, useState } from 'react'
import {
  Send, Loader2, MessageCircle, Building2, AlertCircle,
} from 'lucide-react'
import { useMesMessages } from '../../hooks/useMesMessages'
import { useAuth } from '../../contexts/AuthContext'

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}
function sameDay(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

export default function OuvrierMessages() {
  const { user } = useAuth()
  const { interlocuteur, messages, loading, sending, error, envoyer } = useMesMessages()
  const [text, setText] = useState('')
  const scrollRef = useRef(null)
  const wasAtBottomRef = useRef(true)

  // Auto-scroll en bas quand nouveaux messages (seulement si l'user était
  // déjà en bas — sinon respecte sa position de lecture)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages.length])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    wasAtBottomRef.current = atBottom
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim() || sending) return
    wasAtBottomRef.current = true
    const { error } = await envoyer(text)
    if (!error) setText('')
  }

  // Header avec interlocuteur
  const interlocName = interlocuteur
    ? `${interlocuteur.prenom || ''} ${interlocuteur.nom || ''}`.trim() || interlocuteur.email
    : 'Manager'

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 68px)' }}>
      {/* Header sticky */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-10">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Conversation avec</p>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-800 to-primary-600 flex items-center justify-center">
            <Building2 size={15} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-slate-900 truncate">{interlocName}</p>
            <p className="text-[11px] text-emerald-600 font-semibold inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              En ligne
            </p>
          </div>
        </div>
      </div>

      {/* Zone messages scrollable */}
      <div ref={scrollRef} onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-slate-50">
        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
        ) : error ? (
          <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-3">
              <MessageCircle size={22} className="text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Aucun message</p>
            <p className="text-xs text-slate-500 mt-1">Démarrez la conversation en envoyant le premier message à votre manager.</p>
          </div>
        ) : (
          messages.map((m, idx) => {
            const isMe = m.expediteur_id === user?.id
            const prev = messages[idx - 1]
            const showDateSep = !prev || !sameDay(prev.created_at, m.created_at)
            return (
              <div key={m.id}>
                {showDateSep && (
                  <div className="text-center my-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-white border border-slate-200 rounded-full px-2.5 py-1">
                      {fmtDate(m.created_at)}
                    </span>
                  </div>
                )}
                <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                    isMe
                      ? 'bg-accent-500 text-white rounded-br-sm'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap break-words">{m.contenu}</p>
                    <p className={`text-[10px] mt-0.5 ${isMe ? 'text-orange-100' : 'text-slate-400'}`}>
                      {fmtTime(m.created_at)}
                      {isMe && m.lu && ' · vu'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Input sticky bottom */}
      <form onSubmit={handleSend} className="bg-white border-t border-slate-100 px-3 py-2.5 flex items-end gap-2 sticky bottom-0">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend(e)
            }
          }}
          placeholder={interlocuteur ? `Écrire à ${interlocuteur.prenom || 'manager'}…` : 'Chargement…'}
          rows={1}
          disabled={!interlocuteur || sending}
          className="flex-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-sm bg-slate-50 outline-none focus:border-accent-500 focus:bg-white focus:ring-2 focus:ring-accent-500/15 resize-none max-h-32"
          style={{ minHeight: 42 }}
        />
        <button type="submit" disabled={!text.trim() || sending || !interlocuteur}
          className="w-11 h-11 rounded-2xl bg-accent-500 hover:bg-accent-600 text-white flex items-center justify-center shadow-sm disabled:opacity-40 active:scale-95 transition-all flex-shrink-0">
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>
    </div>
  )
}

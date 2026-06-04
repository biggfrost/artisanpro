import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Search, MessageCircle, ChevronLeft, ChevronRight, Send, Loader2,
  AlertCircle,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  listConversationsForManager, listMessagesAvec, envoyerMessage,
  marquerMessageLu,
} from '../../services/mesMessagesService'
import { supabase } from '../../services/supabase'
import { SkeletonRowList } from '../../components/Skeleton'

// Realtime fait le gros du job ; polling moins agressif en secours.
const POLL_INTERVAL = 25000

// ── Helpers format ───────────────────────────────────────────
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}
function fmtRelative(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  if (now.toDateString() === d.toDateString()) return fmtTime(iso)
  const diffHr = (now - d) / 3600000
  if (diffHr < 48) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
function sameDay(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

// ═══════════════════════════════════════════════════════════════
// Point d'entrée : route /manager/messages OU /manager/messages/:ouvrierId
// ═══════════════════════════════════════════════════════════════
export default function MessagesManager() {
  const { ouvrierId } = useParams()
  if (ouvrierId) return <ChatView ouvrierId={ouvrierId} />
  return <ConversationsList />
}

// ── Vue 1 : liste des conversations ──────────────────────────
function ConversationsList() {
  const navigate = useNavigate()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { conversations: list, error: e } = await listConversationsForManager()
      if (cancelled) return
      if (e) setError(e.message || 'Erreur de chargement')
      else   setConversations(list || [])
      setLoading(false)
    }
    load()
    const id = setInterval(() => { if (!document.hidden) load() }, POLL_INTERVAL)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => {
      const fullName = `${c.ouvrier.prenom || ''} ${c.ouvrier.nom || ''}`.toLowerCase()
      return fullName.includes(q) || (c.ouvrier.email || '').toLowerCase().includes(q)
    })
  }, [conversations, search])

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0)

  return (
    <div className="px-4 pt-12 pb-4">
      <div className="mb-5">
        <p className="text-sm text-slate-500 font-medium">Communication équipe</p>
        <h1 className="text-2xl font-bold text-primary-900">Messages</h1>
        {totalUnread > 0 && (
          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold uppercase tracking-wide bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
            {totalUnread} non lu{totalUnread > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un ouvrier…"
          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-primary-700 focus:ring-2 focus:ring-primary-900/10"
        />
      </div>

      {error && (
        <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 text-xs text-red-700 mb-3">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <SkeletonRowList count={4} />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
          <MessageCircle size={28} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-700">
            {search ? 'Aucun ouvrier ne correspond' : 'Aucun ouvrier dans votre équipe'}
          </p>
          {!search && (
            <p className="text-xs text-slate-400 mt-1">
              Invitez votre premier ouvrier depuis l'onglet Équipe pour démarrer la conversation.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <ConversationItem
              key={c.ouvrier.id}
              conv={c}
              onClick={() => navigate(`/manager/messages/${c.ouvrier.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ConversationItem({ conv, onClick }) {
  const { ouvrier, lastMessage, unreadCount } = conv
  const initials = ((ouvrier.prenom?.[0] || '') + (ouvrier.nom?.[0] || '')).toUpperCase() || '?'
  const fullName = [ouvrier.prenom, ouvrier.nom].filter(Boolean).join(' ') || ouvrier.email

  return (
    <button onClick={onClick}
      className="w-full bg-white border border-slate-100 hover:border-primary-200 rounded-2xl p-3 text-left flex items-center gap-3 transition-colors">
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-800 to-primary-600 flex items-center justify-center">
          <span className="text-white text-sm font-bold">{initials}</span>
        </div>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm truncate ${unreadCount > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
            {fullName}
          </p>
          {lastMessage && (
            <span className={`text-[10px] flex-shrink-0 ${unreadCount > 0 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
              {fmtRelative(lastMessage.created_at)}
            </span>
          )}
        </div>
        {lastMessage ? (
          <p className={`text-xs truncate mt-0.5 ${unreadCount > 0 ? 'text-slate-700' : 'text-slate-500'}`}>
            {lastMessage.contenu}
          </p>
        ) : (
          <p className="text-xs text-slate-400 italic mt-0.5">
            {ouvrier.metier || 'Démarrer la conversation'}
          </p>
        )}
      </div>
      <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />
    </button>
  )
}

// ── Vue 2 : chat individuel avec un ouvrier ──────────────────
function ChatView({ ouvrierId }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [ouvrier,  setOuvrier]  = useState(null)
  const [messages, setMessages] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [sending,  setSending]  = useState(false)
  const [error,    setError]    = useState(null)
  const [text,     setText]     = useState('')
  const scrollRef = useRef(null)
  const wasAtBottomRef = useRef(true)

  // Init : ouvrier + messages
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [{ data: o }, msgRes] = await Promise.all([
        supabase.from('utilisateurs')
          .select('id, nom, prenom, email, metier, telephone')
          .eq('id', ouvrierId).maybeSingle(),
        listMessagesAvec(ouvrierId),
      ])
      if (cancelled) return
      setOuvrier(o || null)
      if (msgRes.error) setError(msgRes.error.message || 'Erreur')
      else              setMessages(msgRes.data || [])
      setLoading(false)
    }
    load()
  }, [ouvrierId])

  // Realtime + polling de secours
  useEffect(() => {
    if (!ouvrierId || !user?.id) return
    let channel = null

    try {
      channel = supabase
        .channel(`mgr-chat-${user.id}-${ouvrierId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          (payload) => {
            const m = payload.new
            const isRelevant =
              (m.expediteur_id === ouvrierId && m.destinataire_id === user.id) ||
              (m.destinataire_id === ouvrierId && m.expediteur_id === user.id)
            if (!isRelevant) return
            setMessages((prev) => prev.find((x) => x.id === m.id) ? prev : [...prev, m])
          }
        )
        .subscribe()
    } catch (e) {
      console.warn('[ChatView] realtime KO, fallback polling:', e?.message)
    }

    async function reload() {
      const { data } = await listMessagesAvec(ouvrierId)
      setMessages(data || [])
    }
    const id = setInterval(() => { if (!document.hidden) reload() }, POLL_INTERVAL)
    return () => {
      if (channel) supabase.removeChannel(channel)
      clearInterval(id)
    }
  }, [ouvrierId, user?.id])

  // Auto-marquer les messages reçus comme lus
  useEffect(() => {
    if (!user) return
    const nonLus = messages.filter((m) => m.destinataire_id === user.id && !m.lu)
    nonLus.forEach((m) => marquerMessageLu(m.id).catch(() => null))
  }, [messages, user])

  // Scroll auto si on était en bas
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (wasAtBottomRef.current) el.scrollTop = el.scrollHeight
  }, [messages.length])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    wasAtBottomRef.current = true
    const { data, error: e2 } = await envoyerMessage(ouvrierId, text.trim())
    setSending(false)
    if (e2) { setError(e2.message); return }
    if (data) { setMessages((prev) => [...prev, data]); setText('') }
  }

  const initials = ouvrier
    ? ((ouvrier.prenom?.[0] || '') + (ouvrier.nom?.[0] || '')).toUpperCase() || '?'
    : '?'
  const fullName = ouvrier
    ? [ouvrier.prenom, ouvrier.nom].filter(Boolean).join(' ') || ouvrier.email
    : 'Chargement…'

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 68px)' }}>
      {/* Header sticky avec retour + identité */}
      <div className="bg-white border-b border-slate-100 px-3 py-2.5 sticky top-0 z-10 flex items-center gap-2">
        <button onClick={() => navigate('/manager/messages')} aria-label="Retour"
          className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-50">
          <ChevronLeft size={18} className="text-slate-600" />
        </button>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-800 to-primary-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-bold">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{fullName}</p>
          {ouvrier?.metier && <p className="text-[11px] text-slate-500 truncate">{ouvrier.metier}</p>}
        </div>
      </div>

      {/* Messages */}
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
            <p className="text-sm font-semibold text-slate-700">Démarrez la conversation</p>
            <p className="text-xs text-slate-500 mt-1">Envoyez le premier message à {fullName}.</p>
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
                      ? 'bg-primary-900 text-white rounded-br-sm'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap break-words">{m.contenu}</p>
                    <p className={`text-[10px] mt-0.5 ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
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

      {/* Input */}
      <form onSubmit={handleSend} className="bg-white border-t border-slate-100 px-3 py-2.5 flex items-end gap-2 sticky bottom-0">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) }
          }}
          placeholder={ouvrier ? `Écrire à ${ouvrier.prenom || 'ouvrier'}…` : 'Chargement…'}
          rows={1}
          disabled={!ouvrier || sending}
          className="flex-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-sm bg-slate-50 outline-none focus:border-primary-700 focus:bg-white focus:ring-2 focus:ring-primary-900/10 resize-none max-h-32"
          style={{ minHeight: 42 }}
        />
        <button type="submit" disabled={!text.trim() || sending || !ouvrier}
          className="w-11 h-11 rounded-2xl bg-primary-900 hover:bg-primary-800 text-white flex items-center justify-center shadow-sm disabled:opacity-40 active:scale-95 transition-all flex-shrink-0">
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>
    </div>
  )
}


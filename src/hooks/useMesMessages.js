import { useCallback, useEffect, useRef, useState } from 'react'
import {
  trouverManager, listMessagesAvec, envoyerMessage, marquerMessageLu,
} from '../services/mesMessagesService'
import { supabase } from '../services/supabase'

// Realtime + polling de secours moins agressif (Realtime fait l'instantané)
const POLL_INTERVAL = 20000

export function useMesMessages() {
  const [interlocuteur, setInterlocuteur] = useState(null)
  const [messages,      setMessages]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [sending,       setSending]       = useState(false)
  const [error,         setError]         = useState(null)
  const pollRef = useRef(null)

  const loadMessages = useCallback(async (interlocId) => {
    if (!interlocId) return
    const { data, error } = await listMessagesAvec(interlocId)
    if (error) setError(error.message)
    else       setMessages(data || [])
  }, [])

  // Init : trouve le manager + charge l'historique
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data: mgr, error } = await trouverManager()
      if (cancelled) return
      if (error) setError(error.message)
      if (mgr) {
        setInterlocuteur(mgr)
        await loadMessages(mgr.id)
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [loadMessages])

  // Realtime + polling de secours
  useEffect(() => {
    if (!interlocuteur?.id) return
    let channel = null

    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      try {
        channel = supabase
          .channel(`chat-${user.id}-${interlocuteur.id}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            (payload) => {
              const m = payload.new
              const isRelevant =
                (m.expediteur_id === interlocuteur.id && m.destinataire_id === user.id) ||
                (m.destinataire_id === interlocuteur.id && m.expediteur_id === user.id)
              if (!isRelevant) return
              setMessages((prev) => prev.find((x) => x.id === m.id) ? prev : [...prev, m])
            }
          )
          .subscribe()
      } catch (e) {
        console.warn('[useMesMessages] realtime KO, fallback polling:', e?.message)
      }
    })()

    // Polling de secours moins agressif (Realtime fait le gros du travail)
    pollRef.current = setInterval(() => {
      if (!document.hidden) loadMessages(interlocuteur.id)
    }, POLL_INTERVAL)

    return () => {
      if (channel) supabase.removeChannel(channel)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [interlocuteur?.id, loadMessages])

  // Marque tous les messages reçus comme lus
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) return
      const nonLus = messages.filter((m) => m.destinataire_id === user.id && !m.lu)
      for (const m of nonLus) {
        await marquerMessageLu(m.id).catch(() => null)
      }
    })()
    return () => { cancelled = true }
  }, [messages])

  async function envoyer(contenu) {
    if (!interlocuteur?.id || !contenu.trim()) return { error: { message: 'Message vide' } }
    setSending(true)
    const { data, error } = await envoyerMessage(interlocuteur.id, contenu.trim())
    setSending(false)
    if (data) setMessages((prev) => [...prev, data])
    return { data, error }
  }

  async function refresh() {
    if (interlocuteur?.id) await loadMessages(interlocuteur.id)
  }

  return { interlocuteur, messages, loading, sending, error, envoyer, refresh }
}

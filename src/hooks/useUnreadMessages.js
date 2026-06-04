import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import { countMessagesNonLus } from '../services/mesMessagesService'

// Compte les messages non-lus pour l'utilisateur courant.
// - Souscrit aux INSERT/UPDATE Realtime sur messages → MAJ instantanée
// - Polling 30s de secours si Realtime indispo (table pas dans la publication)
export function useUnreadMessages() {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    const c = await countMessagesNonLus()
    setCount(c)
  }, [])

  useEffect(() => {
    let cancelled = false
    let channel = null
    let interval = null

    async function setup() {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) return

      await refresh()

      // Realtime : tout INSERT/UPDATE de messages où je suis destinataire
      try {
        channel = supabase
          .channel(`unread-${user.id}`)
          .on(
            'postgres_changes',
            {
              event:  '*',
              schema: 'public',
              table:  'messages',
              filter: `destinataire_id=eq.${user.id}`,
            },
            () => { if (!cancelled) refresh() }
          )
          .subscribe()
      } catch (e) {
        console.warn('[useUnreadMessages] realtime indispo:', e?.message)
      }

      // Polling de secours toutes les 30s
      interval = setInterval(() => {
        if (!document.hidden && !cancelled) refresh()
      }, 30000)
    }

    setup()
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
      if (interval) clearInterval(interval)
    }
  }, [refresh])

  return { count, refresh }
}

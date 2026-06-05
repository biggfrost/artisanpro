import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from './AuthContext'
import { vibrate } from '../utils/haptics'

const NotificationsContext = createContext(null)

const MAX_NOTIFS = 100
const canNotify  = typeof window !== 'undefined' && 'Notification' in window

// Aperçu d'un message pour les notifications (gère les médias)
function apercuMessageNotif(m) {
  if (!m) return ''
  switch (m.type) {
    case 'image':    return '📷 Photo'
    case 'video':    return '🎥 Vidéo'
    case 'audio':    return '🎤 Message vocal'
    case 'document': return `📎 ${m.media_nom || 'Document'}`
    default:         return (m.contenu || '').slice(0, 80)
  }
}

export function NotificationsProvider({ children }) {
  const { isAuthenticated, profile, entreprise } = useAuth()
  const [notifications, setNotifications] = useState(() => {
    try { return JSON.parse(localStorage.getItem('artisanpro_notifs') || '[]') }
    catch { return [] }
  })
  const channelRef = useRef(null)

  const push = useCallback((notif) => {
    const item = {
      id: Date.now() + Math.random(),
      read: false,
      createdAt: new Date().toISOString(),
      ...notif,
    }
    setNotifications((prev) => {
      const next = [item, ...prev].slice(0, MAX_NOTIFS)
      localStorage.setItem('artisanpro_notifs', JSON.stringify(next))
      return next
    })
    vibrate(15)
    if (canNotify && Notification.permission === 'granted') {
      try {
        new Notification(item.title, { body: item.body, icon: '/icons/icon-192.png', badge: '/icons/icon-72.png' })
      } catch { /* silencieux si la notification échoue */ }
    }
  }, [])

  const markRead = useCallback((id) => {
    setNotifications((prev) => {
      const next = prev.map((n) => n.id === id ? { ...n, read: true } : n)
      localStorage.setItem('artisanpro_notifs', JSON.stringify(next))
      return next
    })
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }))
      localStorage.setItem('artisanpro_notifs', JSON.stringify(next))
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    localStorage.setItem('artisanpro_notifs', '[]')
  }, [])

  // Demande permission notifications après connexion
  useEffect(() => {
    if (!isAuthenticated || !canNotify) return
    if (Notification.permission === 'default') {
      const t = setTimeout(() => Notification.requestPermission(), 4000)
      return () => clearTimeout(t)
    }
  }, [isAuthenticated])

  // Supabase Realtime — écoute les événements métier de l'entreprise
  useEffect(() => {
    if (!isAuthenticated || !entreprise?.id || !profile) return

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const role          = profile.role
    const entrepriseId  = entreprise.id
    const channel       = supabase.channel(`notifs-${entrepriseId}-${profile.id}`)

    if (role === 'manager') {
      channel
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'devis', filter: `entreprise_id=eq.${entrepriseId}` },
          ({ new: n }) => {
            if (n?.statut === 'en_attente_validation') {
              push({ type: 'devis_a_valider', title: '📋 Devis à valider',
                body: `Un ouvrier a soumis le devis ${n.numero || ''} — votre validation est requise.`, link: '/manager/devis' })
            }
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'devis', filter: `entreprise_id=eq.${entrepriseId}` },
          ({ new: n, old: o }) => {
            if (n?.statut === 'accepte' && o?.statut !== 'accepte') {
              push({ type: 'devis_signe', title: '✅ Devis signé !',
                body: `Le devis ${n.numero || ''} a été accepté par le client.`, link: '/manager/devis' })
            }
          }
        )
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'pointages', filter: `entreprise_id=eq.${entrepriseId}` },
          () => push({ type: 'pointage_arrivee', title: '📍 Pointage ouvrier',
            body: 'Un ouvrier vient de pointer son arrivée sur chantier.', link: '/manager/ouvriers' })
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'chantiers', filter: `entreprise_id=eq.${entrepriseId}` },
          ({ new: n, old: o }) => {
            if (n?.statut === 'termine' && o?.statut !== 'termine') {
              push({ type: 'chantier_termine', title: '🏁 Chantier terminé',
                body: `"${n.nom || 'Un chantier'}" a été marqué terminé.`, link: '/manager/chantiers' })
            }
          }
        )
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `entreprise_id=eq.${entrepriseId}` },
          ({ new: n }) => {
            if (n?.expediteur_id !== profile.id) {
              push({ type: 'message', title: '💬 Nouveau message',
                body: apercuMessageNotif(n) || 'Un ouvrier vous a envoyé un message.', link: '/manager/messages' })
            }
          }
        )
    }

    if (role === 'ouvrier') {
      channel
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'assignations', filter: `ouvrier_id=eq.${profile.id}` },
          () => push({ type: 'nouveau_chantier', title: '🔨 Nouveau chantier assigné',
            body: 'Vous avez été assigné à un nouveau chantier.', link: '/ouvrier/planning' })
        )
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `destinataire_id=eq.${profile.id}` },
          ({ new: n }) => push({ type: 'message', title: '💬 Message du manager',
            body: apercuMessageNotif(n) || 'Vous avez reçu un message.', link: '/ouvrier/messages' })
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'devis', filter: `cree_par=eq.${profile.id}` },
          ({ new: n, old: o }) => {
            if (o?.statut === 'en_attente_validation' && n?.statut === 'envoye') {
              push({ type: 'devis_valide', title: '✅ Devis validé !',
                body: `Votre devis ${n.numero || ''} a été validé par le manager. Vous pouvez maintenant l'envoyer.`, link: '/ouvrier/devis' })
            }
            if (o?.statut === 'en_attente_validation' && n?.statut === 'refuse') {
              push({ type: 'devis_refuse', title: '❌ Devis refusé',
                body: `Votre devis ${n.numero || ''} a été refusé par le manager. Contactez-le pour plus d'informations.`, link: '/ouvrier/devis' })
            }
          }
        )
    }

    channel.subscribe()
    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [isAuthenticated, profile, entreprise, push])

  const unread = notifications.filter((n) => !n.read).length

  return (
    <NotificationsContext.Provider value={{ notifications, unread, push, markRead, markAllRead, clearAll }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) return { notifications: [], unread: 0, push: () => {}, markRead: () => {}, markAllRead: () => {}, clearAll: () => {} }
  return ctx
}

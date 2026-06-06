import { supabase } from './supabase'
import { pushNewMessage } from './pushTrigger'
import { enqueue, isNetworkError } from './offlineQueue'

// Récupère l'un des managers de l'entreprise (pour démarrer une conversation
// quand l'ouvrier n'a pas encore reçu de message).
export async function trouverManager() {
  const { data, error } = await supabase
    .from('utilisateurs')
    .select('id, nom, prenom, email')
    .eq('role', 'manager')
    .limit(1)
    .maybeSingle()
  return { data, error }
}

// Liste les messages entre l'utilisateur courant et un interlocuteur.
export async function listMessagesAvec(interlocuteurId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: { message: 'Non authentifié' } }

  // expediteur=moi/destinataire=lui OR expediteur=lui/destinataire=moi
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(expediteur_id.eq.${user.id},destinataire_id.eq.${interlocuteurId}),and(expediteur_id.eq.${interlocuteurId},destinataire_id.eq.${user.id})`)
    .order('created_at', { ascending: true })
  return { data: data ?? [], error }
}

// Envoie un message. `media` optionnel : { type, url, nom, taille, duree }
// `opts.noQueue` : utilisé par la synchro hors-ligne pour éviter de ré-enfiler.
export async function envoyerMessage(destinataireId, contenu, media = null, opts = {}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Non authentifié' } }

  const payload = {
    expediteur_id:   user.id,
    destinataire_id: destinataireId,
    contenu:         contenu || '',
  }
  if (media) {
    payload.type         = media.type
    payload.media_url    = media.url
    payload.media_nom    = media.nom || null
    payload.media_taille = media.taille || null
    if (media.duree != null) payload.media_duree = media.duree
  }

  // Hors-ligne (texte seulement — un média nécessite le réseau pour l'upload).
  // On enfile et on renvoie un message optimiste pour l'affichage immédiat.
  const canQueue = !opts.noQueue && !media
  if (canQueue && typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueue('message_send', { destinataireId, contenu: payload.contenu })
    return { data: { ...payload, id: `pending-${Date.now()}`, created_at: new Date().toISOString(), lu: false, _pending: true }, error: null, pending: true }
  }

  try {
    const { data, error } = await supabase.from('messages').insert(payload).select().single()
    if (error) throw error
    pushNewMessage(data)
    return { data, error: null }
  } catch (e) {
    if (canQueue && isNetworkError(e)) {
      enqueue('message_send', { destinataireId, contenu: payload.contenu })
      return { data: { ...payload, id: `pending-${Date.now()}`, created_at: new Date().toISOString(), lu: false, _pending: true }, error: null, pending: true }
    }
    return { data: null, error: e }
  }
}

// Aperçu textuel d'un message pour la liste des conversations
export function apercuMessage(m) {
  if (!m) return ''
  switch (m.type) {
    case 'image':    return '📷 Photo'
    case 'video':    return '🎥 Vidéo'
    case 'audio':    return '🎤 Message vocal'
    case 'document': return `📎 ${m.media_nom || 'Document'}`
    default:         return m.contenu || ''
  }
}

export async function marquerMessageLu(messageId) {
  const { error } = await supabase
    .from('messages')
    .update({ lu: true })
    .eq('id', messageId)
  return { error }
}

// Compte les messages non-lus dont je suis destinataire (pour le badge)
export async function countMessagesNonLus() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('destinataire_id', user.id)
    .eq('lu', false)
  return count ?? 0
}

// ─── Côté manager : liste de toutes les conversations avec ses ouvriers ───
// Une conversation = un ouvrier + son dernier message + nombre de non-lus.
export async function listConversationsForManager() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { conversations: [], error: { message: 'Non authentifié' } }

  // 1) Tous les ouvriers de l'entreprise (RLS filtre)
  const { data: ouvriers, error: ouvErr } = await supabase
    .from('utilisateurs')
    .select('id, nom, prenom, email, metier, telephone')
    .eq('role', 'ouvrier')
    .order('nom', { ascending: true })
  if (ouvErr) return { conversations: [], error: ouvErr }

  // 2) Tous mes messages échangés (RLS filtre par moi ou l'autre)
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .or(`expediteur_id.eq.${user.id},destinataire_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  const msgs = messages || []

  // 3) On agrège par ouvrier
  const conversations = (ouvriers || []).map((o) => {
    const conv = msgs.filter(
      (m) => m.expediteur_id === o.id || m.destinataire_id === o.id
    )
    const lastMessage = conv[0] || null
    const unreadCount = conv.filter(
      (m) => m.destinataire_id === user.id && !m.lu
    ).length
    return { ouvrier: o, lastMessage, unreadCount }
  })

  // 4) Tri : conversations avec messages récents d'abord, puis les autres par nom
  conversations.sort((a, b) => {
    const ta = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0
    const tb = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0
    if (ta !== tb) return tb - ta
    return (a.ouvrier.nom || '').localeCompare(b.ouvrier.nom || '')
  })

  return { conversations, error: null }
}

// Supabase Edge Function : notify
// Reçoit un webhook de base de données (INSERT/UPDATE) et envoie une
// notification push (Web Push) aux utilisateurs concernés.
//
// Déploiement :
//   supabase functions deploy notify --no-verify-jwt
// Secrets requis :
//   supabase secrets set VAPID_PUBLIC_KEY=...
//   supabase secrets set VAPID_PRIVATE_KEY=...
//   supabase secrets set VAPID_SUBJECT=mailto:contact@votredomaine.fr

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:contact@artisanpro.app'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Helpers ────────────────────────────────────────────────────────
async function managersOf(entrepriseId: string): Promise<string[]> {
  const { data } = await admin
    .from('utilisateurs')
    .select('id')
    .eq('role', 'manager')
    .eq('entreprise_id', entrepriseId)
  return (data || []).map((u) => u.id)
}

function apercuMessage(m: any): string {
  switch (m?.type) {
    case 'image':    return '📷 Photo'
    case 'video':    return '🎥 Vidéo'
    case 'audio':    return '🎤 Message vocal'
    case 'document': return `📎 ${m.media_nom || 'Document'}`
    default:         return (m?.contenu || '').slice(0, 120)
  }
}

// Décide qui notifier et avec quel contenu, selon la table et l'événement.
async function buildNotifications(payload: any) {
  const { type, table, record, old_record } = payload
  const out: { userIds: string[]; title: string; body: string; url: string; tag?: string }[] = []

  if (table === 'messages' && type === 'INSERT') {
    if (record.destinataire_id) {
      out.push({
        userIds: [record.destinataire_id],
        title: '💬 Nouveau message',
        body: apercuMessage(record),
        url: '/',
        tag: `msg-${record.expediteur_id}`,
      })
    }
  }

  if (table === 'devis') {
    if (type === 'INSERT' && record.statut === 'en_attente_validation' && record.entreprise_id) {
      const mgrs = await managersOf(record.entreprise_id)
      out.push({
        userIds: mgrs,
        title: '📋 Devis à valider',
        body: `Un ouvrier a soumis le devis ${record.numero || ''} — votre validation est requise.`,
        url: '/manager/devis',
      })
    }
    if (type === 'UPDATE') {
      const was = old_record?.statut
      const now = record?.statut
      if (now === 'accepte' && was !== 'accepte' && record.entreprise_id) {
        const mgrs = await managersOf(record.entreprise_id)
        out.push({
          userIds: mgrs,
          title: '✅ Devis signé !',
          body: `Le devis ${record.numero || ''} a été accepté et signé par le client.`,
          url: '/manager/devis',
        })
      }
      if (was === 'en_attente_validation' && now === 'envoye' && record.cree_par) {
        out.push({
          userIds: [record.cree_par],
          title: '✅ Devis validé',
          body: `Votre devis ${record.numero || ''} a été validé. Vous pouvez l'envoyer au client.`,
          url: '/ouvrier/devis',
        })
      }
      if (was === 'en_attente_validation' && now === 'refuse' && record.cree_par) {
        out.push({
          userIds: [record.cree_par],
          title: '❌ Devis refusé',
          body: `Votre devis ${record.numero || ''} a été refusé par le manager.`,
          url: '/ouvrier/devis',
        })
      }
    }
  }

  if (table === 'assignations' && type === 'INSERT' && record.ouvrier_id) {
    out.push({
      userIds: [record.ouvrier_id],
      title: '🔨 Nouveau chantier assigné',
      body: 'Vous avez été assigné à un nouveau chantier. Consultez votre planning.',
      url: '/ouvrier/planning',
    })
  }

  if (table === 'pointages' && type === 'INSERT' && record.entreprise_id) {
    const mgrs = await managersOf(record.entreprise_id)
    out.push({
      userIds: mgrs,
      title: '📍 Pointage ouvrier',
      body: 'Un ouvrier vient de pointer son arrivée sur chantier.',
      url: '/manager/ouvriers',
    })
  }

  if (table === 'chantiers' && type === 'UPDATE') {
    if (record?.statut === 'termine' && old_record?.statut !== 'termine' && record.entreprise_id) {
      const mgrs = await managersOf(record.entreprise_id)
      out.push({
        userIds: mgrs,
        title: '🏁 Chantier terminé',
        body: `"${record.nom || 'Un chantier'}" a été marqué terminé.`,
        url: '/manager/chantiers',
      })
    }
  }

  return out
}

async function sendToUsers(userIds: string[], notif: any) {
  if (!userIds.length) {
    console.log('[notify] aucun destinataire pour:', notif.title)
    return { subs: 0, sent: 0, errors: [] as string[] }
  }
  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds)

  if (subErr) console.log('[notify] erreur lecture push_subscriptions:', subErr.message)
  console.log(`[notify] "${notif.title}" → ${userIds.length} user(s), ${subs?.length || 0} abonnement(s) trouvé(s)`)

  const payload = JSON.stringify({
    title: notif.title,
    body:  notif.body,
    url:   notif.url,
    tag:   notif.tag,
  })

  let sent = 0
  const errors: string[] = []

  await Promise.all((subs || []).map(async (s) => {
    const subscription = {
      endpoint: s.endpoint,
      keys: { p256dh: s.p256dh, auth: s.auth },
    }
    try {
      await webpush.sendNotification(subscription, payload)
      sent++
    } catch (err: any) {
      const code = err?.statusCode
      errors.push(`${code}: ${err?.body || err?.message || 'err'}`)
      console.log('[notify] échec push:', code, err?.body || err?.message)
      // Abonnement expiré / invalide → on le supprime
      if (code === 404 || code === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      }
    }
  }))

  console.log(`[notify] "${notif.title}" → ${sent} push envoyé(s), ${errors.length} échec(s)`)
  return { subs: subs?.length || 0, sent, errors }
}

// ── HTTP handler ───────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    console.log('[notify] reçu:', payload?.type, payload?.table)
    const notifs = await buildNotifications(payload)
    const results = []
    for (const n of notifs) results.push(await sendToUsers(n.userIds, n))
    const totalSent = results.reduce((s, r) => s + (r?.sent || 0), 0)
    const totalSubs = results.reduce((s, r) => s + (r?.subs || 0), 0)
    return new Response(JSON.stringify({ ok: true, rules: notifs.length, subscriptions: totalSubs, pushed: totalSent, results }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.log('[notify] ERREUR:', String(e))
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

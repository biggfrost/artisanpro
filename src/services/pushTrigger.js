import { supabase } from './supabase'

// Déclenche l'envoi d'une notification push via l'Edge Function `notify`.
// Appelé directement par l'app après une action (message, devis, pointage…).
// La session authentifiée fournit automatiquement le JWT → passe le gateway.
// Best-effort, silencieux : ne bloque jamais l'action principale.
//
// payload suit le format d'un webhook DB :
//   { type: 'INSERT'|'UPDATE', table, record, old_record }
export async function triggerPush(payload) {
  try {
    await supabase.functions.invoke('notify', { body: payload })
  } catch {
    // silencieux — la notification est un bonus, pas critique
  }
}

// Helpers prêts à l'emploi pour chaque événement métier ───────────────

export function pushNewMessage(messageRow) {
  return triggerPush({ type: 'INSERT', table: 'messages', record: messageRow })
}

export function pushDevisSoumis(devisRow) {
  return triggerPush({ type: 'INSERT', table: 'devis', record: devisRow })
}

export function pushDevisStatut(devisRow, ancienStatut) {
  return triggerPush({
    type: 'UPDATE', table: 'devis',
    record: devisRow,
    old_record: { statut: ancienStatut },
  })
}

export function pushAssignation(assignationRow) {
  return triggerPush({ type: 'INSERT', table: 'assignations', record: assignationRow })
}

export function pushPointage(pointageRow) {
  return triggerPush({ type: 'INSERT', table: 'pointages', record: pointageRow })
}

export function pushChantierTermine(chantierRow, ancienStatut) {
  return triggerPush({
    type: 'UPDATE', table: 'chantiers',
    record: chantierRow,
    old_record: { statut: ancienStatut },
  })
}

// Logique métier liant chantiers et devis.
//
// RÈGLE FONDAMENTALE : un chantier ne peut être actif (en_cours) ou terminé
// que si le devis dont il est issu a été ACCEPTÉ (signé par le client).
// Un chantier dont le devis n'est pas accepté est "illégitime" / à régulariser.

// Extrait le numéro de devis (ex: "DEV-2026-008") depuis un chantier.
// Cherche d'abord dans les notes ("Issu du devis DEV-..."), puis dans le nom
// ("Chantier DEV-... — Client").
export function extractDevisNumero(chantier) {
  if (!chantier) return null
  const sources = [chantier.notes, chantier.nom]
  for (const src of sources) {
    if (!src) continue
    const m = src.match(/(DEV[-\s]?\d{4}[-\s]?\d+)/i)
    if (m) return m[1].replace(/\s/g, '-').toUpperCase()
  }
  return null
}

// Construit l'ensemble des numéros de devis ACCEPTÉS (signés) à partir de la
// liste de devis. Utilisé pour valider la légitimité des chantiers.
export function acceptedDevisNumeros(devisList) {
  const set = new Set()
  for (const d of devisList || []) {
    if (d.statut === 'accepte' && d.numero) {
      set.add(String(d.numero).replace(/\s/g, '-').toUpperCase())
    }
  }
  return set
}

// Un chantier est légitime SSI son devis d'origine fait partie des devis acceptés.
// Si on ne connait pas la liste des devis acceptés (set vide/undefined), on
// reste prudent : un chantier sans numéro de devis identifiable est illégitime.
export function isChantierLegitime(chantier, acceptedNumeros) {
  const numero = extractDevisNumero(chantier)
  if (!numero) return false
  if (!acceptedNumeros) return false
  return acceptedNumeros.has(numero)
}

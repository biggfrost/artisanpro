// Export CSV compatible comptabilité française (EBP, Sage, Cegid)
export function exportDevisCSV(devis, mois, annee) {
  const filtered = mois !== undefined
    ? devis.filter((d) => {
        const date = new Date(d.dateEmission || d.date || 0)
        return date.getMonth() === mois && date.getFullYear() === annee
      })
    : devis

  const rows = [
    ['Date', 'Numéro', 'Client', 'Description', 'HT', 'TVA', 'TTC', 'Statut'],
    ...filtered.map((d) => {
      const ht  = Number(d.totalHT  ?? d.montantHT ?? 0)
      const ttc = Number(d.totalTTC ?? ht)
      const tva = ttc - ht
      const date = new Date(d.dateEmission || d.date || 0)
      return [
        date.toLocaleDateString('fr-FR'),
        d.numero || '',
        (d.client || '').replace(/;/g, ','),
        (d.prestations?.map((p) => p.description).join(' | ') || d.description || '').replace(/;/g, ',').replace(/\n/g, ' '),
        ht.toFixed(2).replace('.', ','),
        tva.toFixed(2).replace('.', ','),
        ttc.toFixed(2).replace('.', ','),
        STATUT_LABELS[d.statut] || d.statut || '',
      ]
    }),
  ]

  const csv = rows.map((r) => r.join(';')).join('\r\n')
  const bom = '﻿' // BOM UTF-8 pour Excel français
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const label = mois !== undefined
    ? `artisanpro-devis-${String(mois + 1).padStart(2, '0')}-${annee}`
    : 'artisanpro-devis-export'
  a.href = url
  a.download = `${label}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const STATUT_LABELS = {
  envoye:  'Envoyé',
  accepte: 'Accepté',
  refuse:  'Refusé',
  annule:  'Annulé',
}

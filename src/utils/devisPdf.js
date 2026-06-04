import jsPDF from 'jspdf'

// Palette (r, g, b)
const C = {
  primary:   [30, 58, 138],
  accent:    [249, 115, 22],
  dark:      [15, 23, 42],
  gray:      [100, 116, 139],
  lightGray: [248, 250, 252],
  border:    [226, 232, 240],
  white:     [255, 255, 255],
  blueFaint: [179, 205, 255],
}

function fmtDate(d) {
  if (!d) return '—'
  try {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  } catch { return d }
}

function fmtMoney(n) {
  const num = Number(n ?? 0)
  const parts = num.toFixed(2).split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return parts.join(',') + ' EUR'
}

export function generateDevisPdf(devis, artisan, signatures = null) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const PW = 210
  const PH = 297
  const M  = 14
  const CW = PW - 2 * M
  let y = 0

  // ── helpers ─────────────────────────────────────────────────────
  function font(size, bold = false, color = C.dark) {
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(...color)
  }

  function t(text, x, opts = {}) {
    doc.text(String(text ?? ''), x, y, opts)
  }

  function hline(color = C.border, w = 0.25) {
    doc.setDrawColor(...color)
    doc.setLineWidth(w)
    doc.line(M, y, M + CW, y)
  }

  function needBreak(needed = 20) {
    if (y + needed > PH - 16) {
      doc.addPage()
      y = 18
    }
  }

  // ── HEADER BAND ─────────────────────────────────────────────────
  doc.setFillColor(...C.primary)
  doc.rect(0, 0, PW, 31, 'F')
  doc.setFillColor(...C.accent)
  doc.rect(0, 28, PW, 3, 'F')

  // ── Logo (haut à gauche, sur fond blanc pour lisibilité) ──
  let textOffsetX = M
  if (artisan.logoArtisan) {
    try {
      const props = doc.getImageProperties(artisan.logoArtisan)
      const boxSize = 22
      const cardPad = 1.5
      const ratio   = Math.min(boxSize / props.width, boxSize / props.height)
      const w       = props.width  * ratio
      const h       = props.height * ratio
      // Carte blanche derrière le logo (le fond bleu peut étouffer un logo coloré)
      doc.setFillColor(...C.white)
      doc.roundedRect(M - cardPad, 4, boxSize + cardPad * 2, boxSize + cardPad * 2, 1.5, 1.5, 'F')
      const cx = M + (boxSize - w) / 2
      const cy = 4 + cardPad + (boxSize - h) / 2
      doc.addImage(artisan.logoArtisan, 'AUTO', cx, cy, w, h)
      textOffsetX = M + boxSize + 6
    } catch (_) { /* logo invalide — on continue sans */ }
  }

  const artisanName = artisan.raisonSociale || artisan.nom || 'Artisan'

  y = 11
  font(14, true, C.white)
  t(artisanName, textOffsetX)

  y = 19
  font(8, false, C.blueFaint)
  t(artisan.formeJuridique || '', textOffsetX)

  // Right side: DEVIS + meta
  y = 10
  font(22, true, C.white)
  t('DEVIS', M + CW, { align: 'right' })

  y = 19
  font(8.5, true, C.blueFaint)
  t(`N° ${devis.numero || '—'}`, M + CW, { align: 'right' })

  y = 25
  font(7.5, false, C.blueFaint)
  t(
    `Émis le ${fmtDate(devis.dateEmission || devis.date)}  •  Valable jusqu\'au ${fmtDate(devis.dateValidite)}`,
    M + CW,
    { align: 'right' }
  )

  // ── INFO COLUMNS ────────────────────────────────────────────────
  y = 40
  const halfW  = (CW - 8) / 2
  const col2X  = M + halfW + 8

  // Client box background
  doc.setFillColor(...C.lightGray)
  doc.roundedRect(col2X - 3, y - 5, halfW + 3, 38, 2, 2, 'F')

  // Column labels
  font(6.5, true, C.gray)
  t('VOS COORDONNÉES', M)
  t('DESTINATAIRE', col2X)
  y += 4

  const artisanLines = [
    { text: artisanName,                             bold: true  },
    { text: artisan.adresse                                      },
    { text: [artisan.codePostal, artisan.ville].filter(Boolean).join(' ') },
    { text: artisan.telephone                                    },
    { text: artisan.email                                        },
    { text: artisan.siret     ? `SIRET : ${artisan.siret}`      : '' },
    { text: artisan.tvaIntracom ? `N° TVA : ${artisan.tvaIntracom}` : '' },
  ].filter(i => i.text)

  const clientLines = [
    { text: devis.client,        bold: true },
    { text: devis.clientAdresse              },
    { text: [devis.clientCodePostal, devis.clientVille].filter(Boolean).join(' ') },
    { text: devis.clientTelephone            },
    { text: devis.clientEmail                },
  ].filter(i => i.text)

  const colStartY = y
  for (const item of artisanLines) {
    font(8.5, item.bold, C.dark)
    t(item.text, M)
    y += 4.5
  }

  y = colStartY
  for (const item of clientLines) {
    font(8.5, item.bold, C.dark)
    t(item.text, col2X)
    y += 4.5
  }

  y = colStartY + Math.max(artisanLines.length, clientLines.length) * 4.5 + 8

  hline()
  y += 6

  // ── PRESTATIONS TABLE ────────────────────────────────────────────
  needBreak(30)

  const tcols = [
    { label: 'Désignation', x: M,          w: 76,  align: 'left'  },
    { label: 'Qté',         x: M + 76,      w: 14,  align: 'right' },
    { label: 'PU HT',            x: M + 90,      w: 28,  align: 'right' },
    { label: 'TVA',              x: M + 118,     w: 16,  align: 'right' },
    { label: 'Total HT',         x: M + 134,     w: 32,  align: 'right' },
  ]

  // Header
  doc.setFillColor(...C.primary)
  doc.rect(M, y - 5, CW, 8, 'F')
  font(7.5, true, C.white)
  for (const col of tcols) {
    t(col.label, col.align === 'right' ? col.x + col.w : col.x + 2, { align: col.align })
  }
  y += 5

  // Build prestations (backward compat with legacy devis)
  const prestations = devis.prestations?.length
    ? devis.prestations
    : [{ description: devis.description || '', quantite: 1, prixUnitaireHT: devis.montantHT || 0, tauxTVA: 20 }]

  for (let i = 0; i < prestations.length; i++) {
    const p = prestations[i]
    const lineHT = Number(p.quantite || 0) * Number(p.prixUnitaireHT || 0)
    const descLines = doc.splitTextToSize(p.description || '', tcols[0].w - 3)
    const rowH = Math.max(descLines.length * 4.2, 7)

    needBreak(rowH + 4)

    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252)
      doc.rect(M, y - 4, CW, rowH + 3, 'F')
    }

    font(8.5, false, C.dark)
    doc.text(descLines, M + 2, y)
    doc.text(String(p.quantite ?? 1), tcols[1].x + tcols[1].w, y, { align: 'right' })
    doc.text(fmtMoney(p.prixUnitaireHT), tcols[2].x + tcols[2].w, y, { align: 'right' })
    doc.text(`${p.tauxTVA ?? 20} %`, tcols[3].x + tcols[3].w, y, { align: 'right' })
    doc.text(fmtMoney(lineHT), tcols[4].x + tcols[4].w, y, { align: 'right' })

    y += rowH + 3
    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.1)
    doc.line(M, y - 1, M + CW, y - 1)
  }

  y += 6

  // ── TOTALS ───────────────────────────────────────────────────────
  needBreak(40)

  const totalHT = devis.totalHT ?? prestations.reduce(
    (s, p) => s + Number(p.quantite || 1) * Number(p.prixUnitaireHT || 0), 0
  )
  const totalTVA = devis.totalTVA ?? prestations.reduce(
    (s, p) => s + Number(p.quantite || 1) * Number(p.prixUnitaireHT || 0) * (Number(p.tauxTVA || 20) / 100), 0
  )
  const totalTTC = devis.totalTTC ?? (totalHT + totalTVA)

  const totX = M + CW - 76
  const totEnd = M + CW

  function totalRow(label, value, highlight = false) {
    needBreak(9)
    if (highlight) {
      doc.setFillColor(...C.primary)
      doc.rect(totX - 2, y - 5.5, 78, 9, 'F')
      font(9.5, true, C.white)
    } else {
      font(8.5, false, C.gray)
    }
    doc.text(label, totX, y)
    if (!highlight) font(8.5, false, C.dark)
    doc.text(fmtMoney(value), totEnd, y, { align: 'right' })
    y += 7.5
  }

  totalRow('Total HT', totalHT)

  if (artisan.mentionTVA !== false) {
    const tvaByRate = {}
    for (const p of prestations) {
      const taux = Number(p.tauxTVA ?? 20)
      const montant = Number(p.quantite || 1) * Number(p.prixUnitaireHT || 0) * (taux / 100)
      tvaByRate[taux] = (tvaByRate[taux] || 0) + montant
    }
    for (const [taux, montant] of Object.entries(tvaByRate)) {
      totalRow(`TVA ${taux} %`, montant)
    }
  } else {
    font(8, false, C.gray)
    doc.text('TVA non applicable - art. 293B CGI', totX, y)
    y += 7
  }

  totalRow('TOTAL TTC', totalTTC, true)
  y += 8

  // ── MENTIONS LÉGALES ─────────────────────────────────────────────
  needBreak(50)

  hline()
  y += 6

  font(6.5, true, C.gray)
  t('MENTIONS LÉGALES ET CONDITIONS', M)
  y += 5

  const condPaie = devis.conditionsPaiement || artisan.conditionsPaiementDefaut || 'Paiement à 30 jours date de facture.'

  const mentions = [
    'Devis gratuit. Validité : 90 jours à compter de la date d\'émission.',
    artisan.mentionTVA === false
      ? 'TVA non applicable, article 293B du CGI.'
      : null,
    `Conditions de paiement : ${condPaie}`,
    'Pénalités de retard : taux directeur de la BCE majoré de 10 points, exigibles dès le premier jour de retard.',
    'Indemnité forfaitaire pour frais de recouvrement : 40 EUR.',
    'Pas d\'écompte accordé pour paiement anticipé.',
  ].filter(Boolean)

  font(7.5, false, C.dark)
  for (const m of mentions) {
    needBreak(8)
    const lines = doc.splitTextToSize(`• ${m}`, CW)
    doc.text(lines, M, y)
    y += lines.length * 4 + 1
  }

  y += 8

  // ── SIGNATURE ────────────────────────────────────────────────
  needBreak(50)

  hline()
  y += 7

  const sigW = (CW - 12) / 2
  const sigH = 36
  const sig2X = M + sigW + 12

  doc.setFillColor(...C.lightGray)
  doc.roundedRect(M, y, sigW, sigH, 2, 2, 'F')
  doc.roundedRect(sig2X, y, sigW, sigH, 2, 2, 'F')

  // ── Bloc artisan (gauche) ──
  font(7.5, true, C.dark)
  doc.text("Signature de l'artisan", M + 3, y + 5)

  if (signatures?.artisan) {
    try {
      doc.addImage(signatures.artisan, 'PNG', M + 3, y + 7, sigW - 6, sigH - 17)
    } catch (_) { /* ignore corrupt image */ }
  }

  font(7, false, C.gray)
  const artisanVille = signatures?.artisanVille ?? artisan.ville ?? ''
  const artisanDateStr = fmtDate((devis.dateEmission || devis.date || '').replace(/T.*$/, ''))
  doc.text('Fait à ' + artisanVille + ' le ' + artisanDateStr, M + 3, y + sigH - 3)

  // ── Bloc client (droite) ──
  font(7.5, true, C.dark)
  doc.text('Bon pour accord', sig2X + 3, y + 5)
  font(7, false, C.gray)
  doc.text('Lu et approuvé — « Bon pour accord »', sig2X + 3, y + 10)

  if (signatures?.client) {
    try {
      doc.addImage(signatures.client, 'PNG', sig2X + 3, y + 13, sigW - 6, sigH - 23)
    } catch (_) { /* ignore corrupt image */ }
    const signedAt = signatures.signeLe ? fmtDate(signatures.signeLe.split('T')[0]) : ''
    doc.text('Fait à ' + (signatures.ville || '') + ' le ' + signedAt, sig2X + 3, y + sigH - 3)
  } else {
    doc.text('Fait à _______________ le _______________', sig2X + 3, y + sigH - 3)
  }

  y += sigH + 10

  // ── FOOTER ───────────────────────────────────────────────────────
  const footerY = PH - 9
  doc.setFillColor(...C.lightGray)
  doc.rect(0, PH - 16, PW, 16, 'F')
  doc.setFillColor(...C.primary)
  doc.rect(0, PH - 16, PW, 2, 'F')

  font(6.5, false, C.gray)
  const footerParts = [
    artisan.siret        ? `SIRET : ${artisan.siret}`       : '',
    artisan.tvaIntracom  ? `N° TVA : ${artisan.tvaIntracom}` : '',
    [artisan.adresse, [artisan.codePostal, artisan.ville].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    artisan.telephone,
    artisan.email,
  ].filter(Boolean)

  doc.text(footerParts.join('  •  '), PW / 2, footerY, { align: 'center' })

  return doc
}

// Si aucun objet `signatures` n'est explicitement fourni mais que l'artisan
// possède une signature dans son profil (signatureArtisan), on l'ajoute
// automatiquement au PDF. Ainsi tout devis téléchargé ou envoyé porte
// la signature de l'entreprise par défaut.
function withDefaultArtisanSignature(artisan, signatures) {
  if (signatures) return signatures
  if (artisan?.signatureArtisan) {
    return {
      artisan:      artisan.signatureArtisan,
      artisanVille: artisan.ville || '',
      client:       null,
      ville:        '',
      signeLe:      '',
    }
  }
  return null
}

export function downloadDevisPdf(devis, artisan, signatures = null) {
  const final = withDefaultArtisanSignature(artisan, signatures)
  const doc = generateDevisPdf(devis, artisan, final)
  doc.save(`Devis-${devis.numero || devis.id}.pdf`)
}

export async function envoyerDevisPdf(devis, artisan, signatures = null) {
  const final = withDefaultArtisanSignature(artisan, signatures)
  const doc = generateDevisPdf(devis, artisan, final)
  const fileName = `Devis-${devis.numero || devis.id}.pdf`
  const blob = doc.output('blob')
  const file = new File([blob], fileName, { type: 'application/pdf' })

  // Mobile: Web Share API (iOS/Android)
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `Devis ${devis.numero}`,
        text: `Bonjour,\n\nVeuillez trouver ci-joint votre devis ${devis.numero}.\n\nCordialement,\n${artisan.raisonSociale || artisan.nom}`,
      })
      return { method: 'share' }
    } catch (e) {
      if (e.name === 'AbortError') return { method: 'cancelled' }
    }
  }

  // Desktop fallback: download PDF then open email client
  doc.save(fileName)

  const artisanName = artisan.raisonSociale || artisan.nom || ''
  const subject = encodeURIComponent(`Devis ${devis.numero} - ${artisanName}`)
  const body = encodeURIComponent(
    `Bonjour ${devis.client || ''},\n\n` +
    `Veuillez trouver ci-joint votre devis n° ${devis.numero}` +
    (devis.totalTTC ? ` d’un montant de ${fmtMoney(devis.totalTTC)} TTC` : '') + '.\n\n' +
    `Ce devis est valable 90 jours à compter du ${fmtDate(devis.dateEmission || devis.date)}.\n\n` +
    `Pour l’accepter, merci de me retourner ce devis signé avec la mention « Bon pour accord ».\n\n` +
    `Cordialement,\n${artisanName}${artisan.telephone ? '\n' + artisan.telephone : ''}`
  )

  setTimeout(() => {
    window.open(`mailto:${devis.clientEmail || ''}?subject=${subject}&body=${body}`, '_blank')
  }, 800)

  return { method: 'download+mailto' }
}

export async function shareDevis(devis, artisan, signingUrl) {
  const montant = devis.totalTTC ?? devis.totalHT ?? devis.montantHT ?? 0
  const text = [
    `Devis ${devis.numero || ''} — ${devis.client}`,
    `Montant : ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant)}`,
    signingUrl ? `\nLien de signature : ${signingUrl}` : '',
    `\nCordialement,\n${artisan?.raisonSociale || artisan?.nom || ''}`,
  ].filter(Boolean).join('\n')

  if (navigator.share) {
    await navigator.share({
      title: `Devis ${devis.numero || ''} — ArtisanPro`,
      text,
      url: signingUrl || window.location.href,
    })
    return true
  }
  // Fallback : copier dans le presse-papiers
  await navigator.clipboard.writeText(signingUrl || text)
  return false
}

export function canShare() {
  return !!navigator.share
}

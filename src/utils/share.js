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

// Partage le LIEN DE SIGNATURE d'un devis via tous les canaux possibles
// (WhatsApp, SMS, email, Messenger…) grâce à la feuille de partage native.
// Fallback : copie le message complet dans le presse-papiers.
export async function shareSigningLink(devis, artisan, signingUrl) {
  const nom = artisan?.raisonSociale || artisan?.nom || ''
  const message = [
    `Bonjour ${devis?.client || ''},`,
    ``,
    `Veuillez cliquer sur le lien ci-dessous pour consulter et signer votre devis ${devis?.numero || ''} :`,
    ``,
    signingUrl,
    ``,
    `Cordialement,`,
    nom,
  ].filter((l) => l !== undefined).join('\n')

  if (navigator.share) {
    try {
      await navigator.share({
        title: `Devis ${devis?.numero || ''} — à signer`,
        text: message,
        url: signingUrl,
      })
      return { ok: true, method: 'share' }
    } catch (e) {
      // L'utilisateur a annulé le partage → pas une erreur
      if (e?.name === 'AbortError') return { ok: false, method: 'cancel' }
    }
  }

  // Fallback : copie dans le presse-papiers
  try {
    await navigator.clipboard.writeText(message)
    return { ok: true, method: 'clipboard' }
  } catch {
    return { ok: false, method: 'none' }
  }
}

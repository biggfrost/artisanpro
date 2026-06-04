const KEY = 'artisanpro_parametres'

export const DEFAULT_PARAMETRES = {
  nom: '',
  raisonSociale: '',
  adresse: '',
  codePostal: '',
  ville: '',
  telephone: '',
  email: '',
  siret: '',
  apeNaf: '',
  tvaIntracom: '',
  formeJuridique: 'Auto-entrepreneur',
  capitalSocial: '',
  rcsVille: '',
  // ── Spécifique BTP ──
  assuranceRCPro:     '',
  assuranceDecennale: '',                  // « Assureur – N° de police »
  zoneCouvertureDecennale: 'France métropolitaine',
  mediateurConso:     '',                  // ex : « CM2C – cm2c.net »
  cgv: 'Le présent devis est valable 90 jours. Tout retard de paiement entraîne l\'application de pénalités au taux légal majoré de 10 points, ainsi qu\'une indemnité forfaitaire pour frais de recouvrement de 40 €. En cas de litige, le client peut saisir gratuitement le médiateur de la consommation.',
  mentionTVA: true,                        // ← par défaut TRUE (la plupart des artisans BTP facturent la TVA)
  conditionsPaiementDefaut: 'Acompte de 30 % à la signature, solde à la livraison.',
  signatureArtisan: null,
  logoArtisan: null,
}

export function loadParametres() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_PARAMETRES, ...JSON.parse(raw) } : { ...DEFAULT_PARAMETRES }
  } catch {
    return { ...DEFAULT_PARAMETRES }
  }
}

export function saveParametres(params) {
  try {
    localStorage.setItem(KEY, JSON.stringify(params))
  } catch (e) {
    console.error('Erreur sauvegarde paramètres:', e)
  }
}

export function isParametresComplete(params) {
  return !!(params.nom || params.raisonSociale) && !!params.siret
}

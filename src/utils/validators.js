export function validateDevis(form) {
  const errors = {}

  if (!form.client?.trim()) {
    errors.client = 'Le nom du client est requis'
  }

  if (!form.dateEmission) {
    errors.dateEmission = "La date d'émission est requise"
  }

  if (!form.prestations?.length) {
    errors.prestations = 'Ajoutez au moins une prestation'
  } else {
    const invalid = form.prestations.some(
      (p) => !p.description?.trim() || isNaN(Number(p.prixUnitaireHT)) || Number(p.prixUnitaireHT) < 0
    )
    if (invalid) {
      errors.prestations = 'Vérifiez les prestations : description et prix requis'
    }
  }

  return errors
}

export function validateChantier(form) {
  const errors = {}

  if (!form.nom?.trim()) {
    errors.nom = 'Le nom du chantier est requis'
  }

  if (!form.client?.trim()) {
    errors.client = 'Le nom du client est requis'
  }

  if (!form.dateDebut) {
    errors.dateDebut = 'La date de début est requise'
  }

  return errors
}

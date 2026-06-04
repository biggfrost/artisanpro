const STATUS_MAP = {
  // Devis — workflow validation ouvrier
  en_attente_validation: { label: 'En attente',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  // Devis — workflow standard
  envoye:   { label: 'Envoyé',   cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  accepte:  { label: 'Accepté',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  refuse:   { label: 'Refusé',   cls: 'bg-red-100 text-red-600 border-red-200' },
  annule:   { label: 'Annulé',   cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  // Chantiers
  planifie: { label: 'Planifié', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  en_cours: { label: 'En cours', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  termine:  { label: 'Terminé',  cls: 'bg-slate-100 text-slate-600 border-slate-200' },
}

export default function Badge({ statut }) {
  const config = STATUS_MAP[statut] ?? { label: statut, cls: 'bg-gray-100 text-gray-600 border-gray-200' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.cls}`}>
      {config.label}
    </span>
  )
}

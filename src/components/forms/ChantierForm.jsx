import { useState } from 'react'
import { validateChantier } from '../../utils/validators'
import { todayISO } from '../../utils/formatters'

const STATUS_OPTIONS = [
  { value: 'en_cours', label: 'En cours' },
  { value: 'termine',  label: 'Terminé'  },
]

const EMPTY = {
  nom: '',
  client: '',
  dateDebut: todayISO(),
  notes: '',
  statut: 'en_cours',
}

export default function ChantierForm({ initialData, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => initialData ?? EMPTY)
  const [errors, setErrors] = useState({})

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validateChantier(form)
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field label="Nom du chantier *" error={errors.nom}>
        <input
          type="text"
          value={form.nom}
          onChange={(e) => set('nom', e.target.value)}
          placeholder="Ex : Rénovation appartement Dupont"
          className={input(errors.nom)}
          autoComplete="off"
        />
      </Field>

      <Field label="Client *" error={errors.client}>
        <input
          type="text"
          value={form.client}
          onChange={(e) => set('client', e.target.value)}
          placeholder="Ex : Martin Dupont"
          className={input(errors.client)}
          autoComplete="off"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date de début *" error={errors.dateDebut}>
          <input
            type="date"
            value={form.dateDebut}
            onChange={(e) => set('dateDebut', e.target.value)}
            className={input(errors.dateDebut)}
          />
        </Field>

        <Field label="Statut" error={errors.statut}>
          <select
            value={form.statut}
            onChange={(e) => set('statut', e.target.value)}
            className={input(errors.statut)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Notes" error={errors.notes}>
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Informations utiles (accès, planning, matériaux…)"
          rows={4}
          className={`${input(errors.notes)} resize-none`}
        />
      </Field>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-3 rounded-xl bg-accent-500 hover:bg-accent-600 text-white font-semibold text-sm transition-colors shadow-sm"
        >
          {initialData ? 'Enregistrer' : 'Créer le chantier'}
        </button>
      </div>
    </form>
  )
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function input(error) {
  return `w-full px-3.5 py-2.5 rounded-xl border text-sm bg-white outline-none transition-colors focus:ring-2 ${
    error
      ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
      : 'border-slate-200 focus:border-primary-700 focus:ring-primary-900/10'
  }`
}

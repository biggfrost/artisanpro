import { useState, useMemo } from 'react'
import { Plus, Trash2, ChevronDown, User, MapPin, Wrench, Calendar, FileText, Percent, Clock, HardHat, UserCheck } from 'lucide-react'
import ClientPicker from '../ClientPicker'
import { validateDevis } from '../../utils/validators'
import { todayISO, dateInDays, generateId, formatCurrency } from '../../utils/formatters'
import { loadParametres } from '../../services/parametres'
import { peekNextDevisNumber } from '../../utils/devisNumero'

const TVA_OPTIONS = [
  { value: 0,   label: '0 %',    note: 'Non applicable'  },
  { value: 5.5, label: '5,5 %',  note: 'Énergétique'     },
  { value: 10,  label: '10 %',   note: 'Rénovation'      },
  { value: 20,  label: '20 %',   note: 'Standard'        },
]

const UNITE_OPTIONS = ['u', 'm²', 'm³', 'ml', 'h', 'j', 'forfait', 'kg', 't']

const STATUT_OPTIONS = [
  { value: 'envoye',  label: 'Envoyé'  },
  { value: 'accepte', label: 'Accepté' },
  { value: 'refuse',  label: 'Refusé'  },
]

function newPrestation(tauxTVA = 20) {
  return { id: generateId(), description: '', quantite: 1, unite: 'u', prixUnitaireHT: '', tauxTVA }
}

function toFormState(devis) {
  const artisan = loadParametres()
  const defaultTVA = artisan.mentionTVA !== false ? 20 : 0

  if (devis) {
    // Editing existing devis: normalise legacy format
    const prestations = devis.prestations?.length
      ? devis.prestations.map((p) => ({ ...p, prixUnitaireHT: String(p.prixUnitaireHT) }))
      : [{ id: generateId(), description: devis.description || '', quantite: 1, prixUnitaireHT: String(devis.montantHT || ''), tauxTVA: 20 }]

    return {
      client:             devis.client || '',
      clientAdresse:      devis.clientAdresse || '',
      clientCodePostal:   devis.clientCodePostal || '',
      clientVille:        devis.clientVille || '',
      clientTelephone:    devis.clientTelephone || devis.telephone || '',
      clientEmail:        devis.clientEmail || '',
      // ── Chantier (peut être différent de l'adresse de facturation) ──
      chantierMemeAdresse:  devis.chantierMemeAdresse ?? true,
      chantierAdresse:      devis.chantierAdresse || '',
      chantierCodePostal:   devis.chantierCodePostal || '',
      chantierVille:        devis.chantierVille || '',
      // ── Dates ──
      dateEmission:         devis.dateEmission || devis.date || todayISO(),
      dateValidite:         devis.dateValidite || dateInDays(90),
      delaiExecution:       devis.delaiExecution || '',
      // ── Détail ──
      prestations,
      // ── Paiement ──
      acomptePct:           devis.acomptePct ?? 30,
      conditionsPaiement:   devis.conditionsPaiement || artisan.conditionsPaiementDefaut || '',
      statut:               devis.statut || 'envoye',
      numero:               devis.numero || '',
    }
  }

  return {
    client: '',
    clientAdresse: '',
    clientCodePostal: '',
    clientVille: '',
    clientTelephone: '',
    clientEmail: '',
    chantierMemeAdresse: true,
    chantierAdresse: '',
    chantierCodePostal: '',
    chantierVille: '',
    dateEmission: todayISO(),
    dateValidite: dateInDays(90),
    delaiExecution: '',
    prestations: [newPrestation(defaultTVA)],
    acomptePct: 30,
    conditionsPaiement: artisan.conditionsPaiementDefaut || '',
    statut: 'envoye',
    numero: '',
  }
}

export default function DevisForm({ initialData, onSubmit, onCancel, submitLabel }) {
  const [form, setForm]   = useState(() => toFormState(initialData))
  const [errors, setErrors] = useState({})
  const [pickerOpen, setPickerOpen] = useState(false)
  const artisan = useMemo(loadParametres, [])
  const nextNumero = useMemo(peekNextDevisNumber, [])

  // Auto-remplit le formulaire à partir d'un client sélectionné dans la liste.
  function applyClientFromPicker(c) {
    const isPro = c.type === 'professionnel'
    const displayName = isPro && c.raison_sociale
      ? c.raison_sociale
      : [c.prenom, c.nom].filter(Boolean).join(' ') || c.nom || ''
    setForm((prev) => ({
      ...prev,
      client:           displayName,
      clientAdresse:    c.adresse     || prev.clientAdresse    || '',
      clientCodePostal: c.code_postal || prev.clientCodePostal || '',
      clientVille:      c.ville       || prev.clientVille      || '',
      clientTelephone:  c.telephone   || prev.clientTelephone  || '',
      clientEmail:      c.email       || prev.clientEmail      || '',
      clientId:         c.id,           // pour traçabilité côté Supabase si la colonne existe
    }))
  }

  // ── field helpers ────────────────────────────────────────────────
  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  // Sync validité 90j when emission date changes
  function setDateEmission(val) {
    setForm((prev) => {
      const validite = prev.dateValidite
      const wasDefault =
        !initialData ||
        prev.dateValidite === dateInDays(90) ||
        prev.dateValidite === dateFromPlus90(prev.dateEmission)
      return {
        ...prev,
        dateEmission: val,
        dateValidite: wasDefault ? dateFromPlus90(val) : validite,
      }
    })
  }

  // ── prestations helpers ──────────────────────────────────────────
  function setPrestationField(id, field, value) {
    setForm((prev) => ({
      ...prev,
      prestations: prev.prestations.map((p) =>
        p.id === id ? { ...p, [field]: value } : p
      ),
    }))
    if (errors.prestations) setErrors((prev) => ({ ...prev, prestations: '' }))
  }

  function addPrestation() {
    const defaultTVA = artisan.mentionTVA !== false ? 20 : 0
    setForm((prev) => ({
      ...prev,
      prestations: [...prev.prestations, newPrestation(defaultTVA)],
    }))
  }

  function removePrestation(id) {
    setForm((prev) => ({
      ...prev,
      prestations: prev.prestations.filter((p) => p.id !== id),
    }))
  }

  // ── totals ───────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let totalHT = 0, totalTVA = 0
    for (const p of form.prestations) {
      const ht = Number(p.quantite || 0) * Number(p.prixUnitaireHT || 0)
      totalHT  += ht
      totalTVA += ht * (Number(p.tauxTVA || 0) / 100)
    }
    return { totalHT, totalTVA, totalTTC: totalHT + totalTVA }
  }, [form.prestations])

  // ── submit ───────────────────────────────────────────────────────
  function handleSubmit(e) {
    e.preventDefault()
    const errs = validateDevis(form)
    if (Object.keys(errs).length) { setErrors(errs); return }

    const cleanPrestations = form.prestations.map((p) => ({
      ...p,
      quantite:      Number(p.quantite) || 1,
      prixUnitaireHT: Number(p.prixUnitaireHT) || 0,
      tauxTVA:       Number(p.tauxTVA) ?? 20,
      totalHT:       (Number(p.quantite) || 1) * (Number(p.prixUnitaireHT) || 0),
    }))

    onSubmit({
      ...form,
      prestations:  cleanPrestations,
      ...totals,
      montantHT:    totals.totalHT,      // backward compat
      description:  cleanPrestations[0]?.description || '',  // backward compat
      date:         form.dateEmission,   // backward compat
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Numéro */}
      {!initialData?.numero && (
        <div className="flex items-center gap-2 bg-primary-50 border border-primary-100 rounded-xl px-3 py-2.5">
          <FileText size={14} className="text-primary-700" />
          <p className="text-sm text-primary-800">
            Numéro attribué automatiquement : <strong>{nextNumero}</strong>
          </p>
        </div>
      )}
      {initialData?.numero && (
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
          <FileText size={14} className="text-slate-500" />
          <p className="text-sm text-slate-600">
            Devis N° <strong>{initialData.numero}</strong>
          </p>
        </div>
      )}

      {/* ── Section client ── */}
      <FormSection icon={User} title="Informations client">
        {/* Picker depuis la liste Clients existante */}
        <button type="button" onClick={() => setPickerOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-500 hover:border-primary-400 hover:text-primary-700 hover:bg-primary-50/50 transition-colors mb-3">
          <UserCheck size={14} />
          {form.clientId ? `Client lié : ${form.client}` : 'Choisir parmi mes clients existants'}
        </button>

        <Field label="Nom / Raison sociale *" error={errors.client}>
          <input
            type="text" value={form.client}
            onChange={(e) => set('client', e.target.value)}
            placeholder="Martin Dupont"
            className={inp(errors.client)}
            autoComplete="off"
          />
        </Field>

        <Field label="Adresse">
          <input
            type="text" value={form.clientAdresse}
            onChange={(e) => set('clientAdresse', e.target.value)}
            placeholder="12 rue des Lilas"
            className={inp()}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Code postal">
            <input
              type="text" value={form.clientCodePostal}
              onChange={(e) => set('clientCodePostal', e.target.value)}
              placeholder="75001"
              maxLength={5}
              className={inp()}
            />
          </Field>
          <Field label="Ville">
            <input
              type="text" value={form.clientVille}
              onChange={(e) => set('clientVille', e.target.value)}
              placeholder="Paris"
              className={inp()}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Téléphone">
            <input
              type="tel" value={form.clientTelephone}
              onChange={(e) => set('clientTelephone', e.target.value)}
              placeholder="06 12 34 56 78"
              className={inp()}
            />
          </Field>
          <Field label="Email">
            <input
              type="email" value={form.clientEmail}
              onChange={(e) => set('clientEmail', e.target.value)}
              placeholder="client@email.fr"
              className={inp()}
            />
          </Field>
        </div>
      </FormSection>

      {/* ── Section dates ── */}
      <FormSection icon={Calendar} title="Dates">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date d'émission *" error={errors.dateEmission}>
            <input
              type="date" value={form.dateEmission}
              onChange={(e) => setDateEmission(e.target.value)}
              className={inp(errors.dateEmission)}
            />
          </Field>
          <Field label="Validité (90 j par défaut)">
            <input
              type="date" value={form.dateValidite}
              onChange={(e) => set('dateValidite', e.target.value)}
              className={inp()}
            />
          </Field>
        </div>
      </FormSection>

      {/* ── Section prestations ── */}
      <FormSection icon={Wrench} title="Détail des prestations">
        {errors.prestations && (
          <p className="text-xs text-red-500 -mt-1 mb-1">{errors.prestations}</p>
        )}

        <div className="space-y-3">
          {form.prestations.map((p, idx) => (
            <PrestationCard
              key={p.id}
              prestation={p}
              index={idx}
              canRemove={form.prestations.length > 1}
              onField={(field, val) => setPrestationField(p.id, field, val)}
              onRemove={() => removePrestation(p.id)}
              showTVA={artisan.mentionTVA !== false}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addPrestation}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-500 hover:border-primary-300 hover:text-primary-700 transition-colors mt-1"
        >
          <Plus size={15} strokeWidth={2.5} />
          Ajouter une prestation
        </button>

        {/* Totals recap */}
        <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 mt-2 border border-slate-100">
          <TotalLine label="Total HT"   value={totals.totalHT}  />
          {artisan.mentionTVA !== false ? (
            <TotalLine label="TVA"        value={totals.totalTVA} />
          ) : (
            <p className="text-xs text-slate-400 italic">TVA non applicable — art. 293B CGI</p>
          )}
          <div className="border-t border-slate-200 pt-1.5">
            <TotalLine label="Total TTC" value={totals.totalTTC} bold />
          </div>
        </div>
      </FormSection>

      {/* ── Section conditions & statut ── */}
      <FormSection icon={FileText} title="Conditions & statut">
        <Field label="Conditions de paiement">
          <textarea
            value={form.conditionsPaiement}
            onChange={(e) => set('conditionsPaiement', e.target.value)}
            rows={2}
            className={`${inp()} resize-none`}
            placeholder="Paiement à 30 jours à réception…"
          />
        </Field>

        <Field label="Statut du devis">
          <div className="relative">
            <select
              value={form.statut}
              onChange={(e) => set('statut', e.target.value)}
              className={`${inp()} appearance-none pr-9`}
            >
              {STATUT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </Field>
      </FormSection>

      {/* Submit */}
      <div className="flex gap-3 pb-1">
        <button
          type="button" onClick={onCancel}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-3 rounded-xl bg-accent-500 hover:bg-accent-600 text-white font-semibold text-sm transition-colors shadow-sm"
        >
          {submitLabel || 'Créer le devis'}
        </button>
      </div>

      <ClientPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={applyClientFromPicker}
      />
    </form>
  )
}

// ── Sub-components ─────────────────────────────────────────────────

function FormSection({ icon: Icon, title, children }) {
  return (
    <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-slate-100">
        <Icon size={14} className="text-primary-700" strokeWidth={2.5} />
        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-4 py-3.5 space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function PrestationCard({ prestation: p, index, canRemove, onField, onRemove, showTVA }) {
  const lineHT = Number(p.quantite || 0) * Number(p.prixUnitaireHT || 0)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Prestation {index + 1}
        </span>
        {canRemove && (
          <button
            type="button" onClick={onRemove}
            className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <textarea
        value={p.description}
        onChange={(e) => onField('description', e.target.value)}
        placeholder="Description de la prestation…"
        rows={2}
        className={`${inp()} resize-none w-full`}
      />

      <div className="grid grid-cols-3 gap-2">
        <Field label="Qté">
          <input
            type="number" value={p.quantite}
            onChange={(e) => onField('quantite', e.target.value)}
            min="0" step="0.5"
            className={inp()}
          />
        </Field>
        <Field label="PU HT (€)">
          <input
            type="number" value={p.prixUnitaireHT}
            onChange={(e) => onField('prixUnitaireHT', e.target.value)}
            min="0" step="1"
            placeholder="0"
            className={inp()}
          />
        </Field>
        {showTVA ? (
          <Field label="TVA">
            <div className="relative">
              <select
                value={p.tauxTVA}
                onChange={(e) => onField('tauxTVA', Number(e.target.value))}
                className={`${inp()} appearance-none pr-6 text-xs`}
              >
                {TVA_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </Field>
        ) : (
          <Field label="TVA">
            <div className={`${inp()} text-xs text-slate-400 flex items-center`}>Non app.</div>
          </Field>
        )}
      </div>

      {lineHT > 0 && (
        <p className="text-right text-xs font-semibold text-primary-900">
          = {formatCurrency(lineHT)} HT
        </p>
      )}
    </div>
  )
}

function TotalLine({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${bold ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
        {formatCurrency(value)}
      </span>
    </div>
  )
}

// helpers
function inp(error) {
  return `w-full px-3 py-2 rounded-xl border text-sm bg-white outline-none transition-colors focus:ring-2 ${
    error
      ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
      : 'border-slate-200 focus:border-primary-700 focus:ring-primary-900/10'
  }`
}

function dateFromPlus90(isoDate) {
  if (!isoDate) return dateInDays(90)
  try {
    const d = new Date(isoDate)
    d.setDate(d.getDate() + 90)
    return d.toISOString().split('T')[0]
  } catch { return dateInDays(90) }
}

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Calendar, ChevronLeft, ChevronRight, Plus, X, Loader2, AlertCircle,
  Trash2, MapPin, PlusCircle, HardHat, Pencil, Sun, Moon, CalendarRange,
  CalendarClock, Sunrise,
} from 'lucide-react'
import { useAssignations } from '../hooks/useAssignations'
import { listChantiersActifs, createChantierRapide, migrateLegacyChantiers } from '../services/chantiersService'
import { useAuth } from '../contexts/AuthContext'

// ── Helpers date ─────────────────────────────────────────────
function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}
function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}
function fmtDateShort(d) {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function isoFromDateAndTime(date, time) {
  if (!date) return null
  return new Date(`${date}T${time || '00:00'}`).toISOString()
}
function dateOnly(iso) {
  // ISO -> 'YYYY-MM-DD' en heure locale
  const d = new Date(iso)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
function timeOnly(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Couleur stable par chantier — hash simple basé sur l'id
const CARD_PALETTE = [
  'bg-blue-50 border-blue-200 text-blue-900',
  'bg-violet-50 border-violet-200 text-violet-900',
  'bg-emerald-50 border-emerald-200 text-emerald-900',
  'bg-amber-50 border-amber-200 text-amber-900',
  'bg-rose-50 border-rose-200 text-rose-900',
  'bg-cyan-50 border-cyan-200 text-cyan-900',
]
function chantierColor(id) {
  if (!id) return CARD_PALETTE[0]
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return CARD_PALETTE[h % CARD_PALETTE.length]
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

// ═════════════════════════════════════════════════════════════
// Composant principal
// ═════════════════════════════════════════════════════════════
export default function OuvrierPlanningPanel({ ouvrier, onChange }) {
  const { assignations, loading, error, add, edit, remove } = useAssignations(ouvrier.id)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))

  // Formulaire : créer (avec date pré-remplie) OU éditer
  const [formMode, setFormMode]       = useState(null)   // null | 'create' | 'edit'
  const [presetDate, setPresetDate]   = useState(null)   // 'YYYY-MM-DD'
  const [editTarget, setEditTarget]   = useState(null)   // assignation row

  // Ref pour scroller automatiquement le formulaire dans le champ de vision
  // quand on l'ouvre (sinon il apparaît tout en bas du modal et l'utilisateur
  // ne le voit pas).
  const formRef = useRef(null)
  useEffect(() => {
    if (formMode && formRef.current) {
      // requestAnimationFrame pour laisser le DOM se peindre avant de scroller
      requestAnimationFrame(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
  }, [formMode, presetDate, editTarget?.id])

  function openCreate(prefilledDate = null) {
    setFormMode('create')
    setPresetDate(prefilledDate)
    setEditTarget(null)
  }
  function openEdit(assignation) {
    setFormMode('edit')
    setEditTarget(assignation)
    setPresetDate(null)
  }
  function closeForm() {
    setFormMode(null)
    setPresetDate(null)
    setEditTarget(null)
  }

  // Groupe les assignations par jour de la semaine affichée.
  const planningByDay = useMemo(() => {
    const result = Array.from({ length: 7 }, () => [])
    for (const a of assignations) {
      if (!a.date_debut) continue
      const start = new Date(a.date_debut)
      const end   = a.date_fin ? new Date(a.date_fin) : start
      for (let i = 0; i < 7; i++) {
        const dayStart = addDays(weekStart, i)
        const dayEnd   = addDays(weekStart, i + 1)
        if (start < dayEnd && end >= dayStart) result[i].push(a)
      }
    }
    return result
  }, [assignations, weekStart])

  const now = new Date()
  const today = startOfWeek(now)
  const todayIdx = (now >= weekStart && now < addDays(weekStart, 7))
    ? Math.floor((now - weekStart) / 86400000)
    : -1
  const isCurrentWeek = today.getTime() === weekStart.getTime()

  async function handleRemove(id) {
    await remove(id)
    onChange?.()
  }

  return (
    <div className="space-y-4">
      {/* ── Navigation semaine + bouton Aujourd'hui ──── */}
      <div className="flex items-center justify-between bg-slate-50 rounded-xl px-2 py-1.5">
        <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white transition-colors"
          aria-label="Semaine précédente">
          <ChevronLeft size={15} className="text-slate-600" />
        </button>
        <div className="text-center flex-1">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Semaine du</p>
          <p className="text-sm font-bold text-slate-800">
            {fmtDateShort(weekStart)} — {fmtDateShort(addDays(weekStart, 6))}
          </p>
          {!isCurrentWeek && (
            <button type="button" onClick={() => setWeekStart(today)}
              className="text-[10px] font-bold text-accent-600 hover:text-accent-700 mt-0.5">
              ← Aujourd'hui
            </button>
          )}
        </div>
        <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white transition-colors"
          aria-label="Semaine suivante">
          <ChevronRight size={15} className="text-slate-600" />
        </button>
      </div>

      {error && (
        <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Vue semaine — jours cliquables ────────────── */}
      {loading ? (
        <div className="py-6 flex justify-center"><Loader2 size={18} className="animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-1.5">
          {planningByDay.map((items, idx) => {
            const day = addDays(weekStart, idx)
            const isToday = idx === todayIdx
            const dateStr = dateOnly(day.toISOString())
            return (
              <div key={idx} className={`rounded-xl border px-3 py-2 ${isToday ? 'border-accent-300 bg-accent-50/30' : 'border-slate-100 bg-white'}`}>
                {/* En-tête jour cliquable */}
                <button type="button" onClick={() => openCreate(dateStr)}
                  className="w-full flex items-center gap-2 mb-1 group hover:bg-slate-50 rounded-md -mx-1 px-1 py-0.5 transition-colors">
                  <span className={`text-[10px] font-bold uppercase ${isToday ? 'text-accent-600' : 'text-slate-400'}`}>
                    {DAY_LABELS[idx]}
                  </span>
                  <span className={`text-xs ${isToday ? 'text-accent-700 font-bold' : 'text-slate-500'}`}>
                    {day.getDate()}/{day.getMonth() + 1}
                  </span>
                  {isToday && (
                    <span className="text-[9px] font-bold bg-accent-500 text-white px-1.5 py-0.5 rounded">AUJOURD'HUI</span>
                  )}
                  <Plus size={11} className="text-slate-300 group-hover:text-accent-500 transition-colors ml-auto" />
                </button>

                {items.length === 0 ? (
                  <button type="button" onClick={() => openCreate(dateStr)}
                    className="w-full text-left text-[11px] text-slate-400 italic hover:text-accent-600 hover:bg-accent-50 rounded-md px-2 py-1 transition-colors cursor-pointer">
                    + assigner un chantier
                  </button>
                ) : (
                  <div className="space-y-1">
                    {items.map((a) => {
                      const color = chantierColor(a.chantier_id)
                      return (
                        <div key={a.id} className={`border rounded-lg px-2 py-1.5 flex items-start gap-1.5 ${color}`}>
                          <button type="button" onClick={() => openEdit(a)}
                            className="flex-1 min-w-0 text-left">
                            <p className="text-xs font-semibold truncate">
                              {a.chantier?.nom || 'Chantier supprimé'}
                            </p>
                            <p className="text-[10px] opacity-75 truncate">
                              {a.chantier?.ville && <>{a.chantier.ville} · </>}
                              {fmtTime(a.date_debut)}
                              {a.date_fin && ` → ${fmtTime(a.date_fin)}`}
                            </p>
                          </button>
                          <button type="button" onClick={() => openEdit(a)}
                            className="opacity-50 hover:opacity-100 transition-opacity"
                            aria-label="Modifier">
                            <Pencil size={10} />
                          </button>
                          <button type="button" onClick={() => handleRemove(a.id)}
                            className="opacity-50 hover:opacity-100 hover:text-red-600 transition-all"
                            aria-label="Retirer">
                            <Trash2 size={10} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Bouton ajouter principal ─────────────────── */}
      {!formMode && (
        <button type="button" onClick={() => openCreate(null)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-500 hover:border-accent-400 hover:text-accent-600 transition-colors">
          <Plus size={14} strokeWidth={2.5} />
          Assigner un chantier
        </button>
      )}

      {/* ── Formulaire ───────────────────────────────── */}
      {formMode && (
        <div ref={formRef} className="ring-2 ring-accent-300 ring-offset-2 rounded-xl">
          <AssignForm
            mode={formMode}
            initialData={editTarget}
            presetDate={presetDate}
            existingAssignations={assignations}
            onCancel={closeForm}
            onSubmit={async (payload) => {
              const { error } = formMode === 'edit'
                ? await edit(editTarget.id, payload)
                : await add(payload)
              if (!error) {
                closeForm()
                onChange?.()
              }
              return error
            }}
          />
        </div>
      )}

      {/* ── Historique ───────────────────────────────── */}
      <div className="pt-2">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">
          Historique des assignations ({assignations.length})
        </p>
        {assignations.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-3 italic">Aucune assignation pour cet ouvrier</p>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {assignations.map((a) => {
              const start = a.date_debut ? new Date(a.date_debut) : null
              const end   = a.date_fin ? new Date(a.date_fin) : null
              const isActive = !end || end >= now
              return (
                <button key={a.id} type="button" onClick={() => openEdit(a)}
                  className="w-full flex items-center gap-2 bg-white border border-slate-100 hover:border-accent-200 rounded-xl px-3 py-2 transition-colors text-left">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {a.chantier?.nom || 'Chantier supprimé'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {start ? fmtDate(a.date_debut) : '—'}
                      {end && ` → ${fmtDate(a.date_fin)}`}
                      {!end && isActive && ' · en cours'}
                    </p>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {isActive ? 'ACTIVE' : 'PASSÉE'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// Formulaire d'assignation (créer + éditer + presets + conflits)
// ═════════════════════════════════════════════════════════════
function AssignForm({ mode, initialData, presetDate, existingAssignations, onCancel, onSubmit }) {
  const { entreprise } = useAuth()
  const [chantiers,        setChantiers]        = useState([])
  const [chantiersLoading, setChantiersLoading] = useState(true)
  const [showCreateChantier, setShowCreateChantier] = useState(false)

  const isEdit = mode === 'edit'

  // État initial dérivé du contexte (édition / preset / création vierge)
  const [chantierId, setChantierId] = useState(() => isEdit ? initialData?.chantier_id || '' : '')
  const [dateDebut,  setDateDebut]  = useState(() => {
    if (isEdit && initialData?.date_debut) return dateOnly(initialData.date_debut)
    if (presetDate) return presetDate
    return dateOnly(new Date().toISOString())
  })
  const [heureDebut, setHeureDebut] = useState(() =>
    isEdit && initialData?.date_debut ? timeOnly(initialData.date_debut) : '08:00')
  const [dateFin,    setDateFin]    = useState(() =>
    isEdit && initialData?.date_fin ? dateOnly(initialData.date_fin) : '')
  const [heureFin,   setHeureFin]   = useState(() =>
    isEdit && initialData?.date_fin ? timeOnly(initialData.date_fin) : '17:00')
  const [notes,      setNotes]      = useState(() => isEdit ? (initialData?.notes || '') : '')
  const [submitting, setSubmitting] = useState(false)
  const [err,        setErr]        = useState(null)
  const [activePreset, setActivePreset] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (entreprise?.id) await migrateLegacyChantiers(entreprise.id)
      const { data } = await listChantiersActifs()
      if (!cancelled) {
        setChantiers(data || [])
        setChantiersLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [entreprise?.id])

  // ── Presets de durée ─────────────────────────────────────
  function applyPreset(preset) {
    setActivePreset(preset)
    const base = dateDebut || dateOnly(new Date().toISOString())
    if (preset === 'matin') {
      setHeureDebut('08:00'); setHeureFin('12:00'); setDateFin(base)
    } else if (preset === 'apresmidi') {
      setHeureDebut('13:00'); setHeureFin('17:00'); setDateFin(base)
    } else if (preset === 'journee') {
      setHeureDebut('08:00'); setHeureFin('17:00'); setDateFin(base)
    } else if (preset === 'semaine') {
      // Lundi -> Vendredi de la semaine de dateDebut
      const d = new Date(base)
      const mondayOffset = d.getDay() === 0 ? -6 : 1 - d.getDay()
      const monday = new Date(d); monday.setDate(d.getDate() + mondayOffset)
      const friday = new Date(monday); friday.setDate(monday.getDate() + 4)
      setDateDebut(dateOnly(monday.toISOString()))
      setDateFin(dateOnly(friday.toISOString()))
      setHeureDebut('08:00'); setHeureFin('17:00')
    }
  }

  // ── Détection de conflits ────────────────────────────────
  const conflict = useMemo(() => {
    if (!dateDebut) return null
    const proposedStart = new Date(isoFromDateAndTime(dateDebut, heureDebut))
    const proposedEnd   = new Date(isoFromDateAndTime(dateFin || dateDebut, heureFin))
    for (const a of existingAssignations || []) {
      if (isEdit && a.id === initialData?.id) continue
      if (!a.date_debut) continue
      const aStart = new Date(a.date_debut)
      const aEnd   = a.date_fin ? new Date(a.date_fin) : aStart
      if (proposedStart < aEnd && proposedEnd > aStart) {
        return a   // overlap détecté
      }
    }
    return null
  }, [dateDebut, dateFin, heureDebut, heureFin, existingAssignations, isEdit, initialData?.id])

  async function handleSubmit(e) {
    e.preventDefault()
    setErr(null)
    if (!chantierId) { setErr('Sélectionnez un chantier'); return }
    if (!dateDebut)  { setErr('Date de début requise');    return }

    setSubmitting(true)
    const error = await onSubmit({
      chantierId,
      dateDebut: isoFromDateAndTime(dateDebut, heureDebut),
      dateFin:   dateFin ? isoFromDateAndTime(dateFin, heureFin) : null,
      notes:     notes.trim(),
    })
    setSubmitting(false)
    if (error) setErr(error.message || 'Erreur')
  }

  async function handleCreateChantier(form) {
    if (!entreprise?.id) return { error: { message: 'Entreprise non identifiée' } }
    const { data, error } = await createChantierRapide(entreprise.id, form)
    if (data) {
      setChantiers((prev) => [data, ...prev])
      setChantierId(data.id)
      setShowCreateChantier(false)
    }
    return { error }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 rounded-xl p-3 space-y-3 border border-slate-200">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-800 inline-flex items-center gap-1.5">
          <Calendar size={14} className="text-accent-600" />
          {isEdit ? 'Modifier l\'assignation' : 'Nouvelle assignation'}
        </h4>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>

      {/* Chantier */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelCls}>Chantier</label>
          {!showCreateChantier && !isEdit && (
            <button type="button" onClick={() => setShowCreateChantier(true)}
              className="text-[10px] font-semibold text-accent-600 hover:text-accent-700 inline-flex items-center gap-0.5">
              <PlusCircle size={10} />Nouveau
            </button>
          )}
        </div>

        {showCreateChantier ? (
          <ChantierQuickCreate
            onCancel={() => setShowCreateChantier(false)}
            onCreate={handleCreateChantier}
          />
        ) : chantiersLoading ? (
          <p className="text-xs text-slate-400">Chargement…</p>
        ) : chantiers.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 text-xs text-amber-700">
            Aucun chantier disponible.{' '}
            <button type="button" onClick={() => setShowCreateChantier(true)}
              className="font-bold underline">
              Créer le premier
            </button>
          </div>
        ) : (
          <select value={chantierId} onChange={(e) => setChantierId(e.target.value)}
            className={inp} required>
            <option value="">— Choisir un chantier —</option>
            {chantiers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}{c.ville ? ` · ${c.ville}` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Durée — chips presets */}
      <div>
        <label className={labelCls}>Durée rapide</label>
        <div className="grid grid-cols-4 gap-1.5">
          <PresetChip icon={Sunrise}      label="Matin"     active={activePreset === 'matin'}     onClick={() => applyPreset('matin')} />
          <PresetChip icon={Sun}          label="Aprèm"     active={activePreset === 'apresmidi'} onClick={() => applyPreset('apresmidi')} />
          <PresetChip icon={CalendarClock} label="Journée"  active={activePreset === 'journee'}   onClick={() => applyPreset('journee')} />
          <PresetChip icon={CalendarRange} label="Semaine"  active={activePreset === 'semaine'}   onClick={() => applyPreset('semaine')} />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Date début *</label>
          <input type="date" value={dateDebut}
            onChange={(e) => { setDateDebut(e.target.value); setActivePreset(null) }}
            className={inp} required />
        </div>
        <div>
          <label className={labelCls}>Heure début</label>
          <input type="time" value={heureDebut}
            onChange={(e) => { setHeureDebut(e.target.value); setActivePreset(null) }}
            className={inp} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Date fin</label>
          <input type="date" value={dateFin}
            onChange={(e) => { setDateFin(e.target.value); setActivePreset(null) }}
            className={inp} />
        </div>
        <div>
          <label className={labelCls}>Heure fin</label>
          <input type="time" value={heureFin}
            onChange={(e) => { setHeureFin(e.target.value); setActivePreset(null) }}
            className={inp} />
        </div>
      </div>

      {/* ── Conflit détecté ── */}
      {conflict && (
        <div className="flex gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 text-xs text-amber-800">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-semibold">Conflit d'horaire</p>
            <p className="opacity-90">
              Déjà assigné à <strong>{conflict.chantier?.nom || 'un autre chantier'}</strong>
              {conflict.date_debut && ` le ${fmtDate(conflict.date_debut)}`}
            </p>
          </div>
        </div>
      )}

      <div>
        <label className={labelCls}>Notes</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Précisions, horaires particuliers…" className={inp} />
      </div>

      {err && (
        <div className="flex gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 text-xs text-red-700">
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
          <span>{err}</span>
        </div>
      )}

      <button type="submit" disabled={submitting || showCreateChantier}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-accent-500 hover:bg-accent-600 text-white font-semibold text-sm transition-colors disabled:opacity-60">
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <HardHat size={13} />}
        {isEdit ? 'Enregistrer les modifications' : 'Assigner'}
      </button>
    </form>
  )
}

// ── Chip preset ──────────────────────────────────────────────
function PresetChip({ icon: Icon, label, active, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors border ${
        active
          ? 'bg-accent-500 border-accent-500 text-white shadow-sm'
          : 'bg-white border-slate-200 text-slate-500 hover:border-accent-300 hover:text-accent-600'
      }`}>
      <Icon size={12} />
      {label}
    </button>
  )
}

// ═════════════════════════════════════════════════════════════
// Mini-formulaire de création rapide d'un chantier
// ═════════════════════════════════════════════════════════════
function ChantierQuickCreate({ onCancel, onCreate }) {
  const [nom,       setNom]        = useState('')
  const [ville,     setVille]      = useState('')
  const [submitting,setSubmitting] = useState(false)
  const [err,       setErr]        = useState(null)

  async function submit(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!nom.trim()) { setErr('Le nom du chantier est requis'); return }
    setSubmitting(true)
    setErr(null)
    const { error } = await onCreate({ nom: nom.trim(), ville: ville.trim() })
    setSubmitting(false)
    if (error) setErr(error.message || 'Erreur lors de la création')
  }

  return (
    <div className="bg-white border border-accent-200 rounded-lg p-2.5 space-y-2">
      <div>
        <label className={labelCls}>Nom du chantier *</label>
        <input value={nom} onChange={(e) => setNom(e.target.value)}
          placeholder="Rénovation salle de bain Dupont" className={inp} autoFocus />
      </div>
      <div>
        <label className={labelCls}>Ville</label>
        <input value={ville} onChange={(e) => setVille(e.target.value)}
          placeholder="Paris" className={inp} />
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">
          Annuler
        </button>
        <button type="button" onClick={submit} disabled={submitting}
          className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-xs font-semibold disabled:opacity-60">
          {submitting ? <Loader2 size={11} className="animate-spin" /> : <PlusCircle size={11} />}
          Créer
        </button>
      </div>
    </div>
  )
}

// ── Styles communs ──
const inp = 'w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm bg-white outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/15'
const labelCls = 'block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1'

import { useState, useMemo } from 'react'
import {
  Plus, Search, Users, Mail, Phone, MapPin, Building2, User,
  Pencil, Trash2, X, Loader2, AlertCircle, Briefcase, History,
} from 'lucide-react'
import { useClients } from '../../hooks/useClients'
import { listDevisForClient } from '../../services/clientsService'
import Modal from '../../components/Modal'
import { SkeletonCardList } from '../../components/Skeleton'
import FloatingActionButton from '../../components/FloatingActionButton'
import CountdownButton from '../../components/CountdownButton'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import PullToRefreshIndicator from '../../components/PullToRefreshIndicator'
import { formatCurrency, formatDate } from '../../utils/formatters'

const TYPE_OPTIONS = [
  { value: 'particulier',    label: 'Particulier' },
  { value: 'professionnel',  label: 'Professionnel' },
]

const EMPTY_FORM = {
  type: 'particulier',
  nom: '', prenom: '', raisonSociale: '',
  email: '', telephone: '',
  adresse: '', codePostal: '', ville: '',
  notes: '',
}

export default function Clients() {
  const { clients, loading, error, refresh, addClient, editClient, removeClient } = useClients()
  const pullState = usePullToRefresh(refresh)

  const [search,        setSearch]        = useState('')
  const [formOpen,      setFormOpen]      = useState(false)
  const [editing,       setEditing]       = useState(null)
  const [deleteTarget,  setDeleteTarget]  = useState(null)
  const [detailTarget,  setDetailTarget]  = useState(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => {
      return (
        (c.nom || '').toLowerCase().includes(q) ||
        (c.prenom || '').toLowerCase().includes(q) ||
        (c.raison_sociale || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.ville || '').toLowerCase().includes(q)
      )
    })
  }, [clients, search])

  function openCreate() { setEditing(null); setFormOpen(true) }
  function openEdit(c)  { setEditing(c);    setFormOpen(true) }

  return (
    <div className="px-4 pt-12 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Clients</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {clients.length} client{clients.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 bg-accent-500 hover:bg-accent-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus size={16} strokeWidth={2.5} />
          Nouveau
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un client…"
          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-primary-700 focus:ring-2 focus:ring-primary-900/10"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 text-xs text-red-700 mb-3">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* List */}
      {loading ? (
        <SkeletonCardList count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState search={search} onCreate={openCreate} />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((c) => (
            <ClientCard
              key={c.id}
              client={c}
              onClick={() => setDetailTarget(c)}
              onEdit={() => openEdit(c)}
              onDelete={() => setDeleteTarget(c)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Modifier ${displayName(editing)}` : 'Nouveau client'}
      >
        <ClientForm
          initialData={editing}
          onCancel={() => setFormOpen(false)}
          onSubmit={async (form) => {
            const { error } = editing
              ? await editClient(editing.id, form)
              : await addClient(form)
            if (!error) setFormOpen(false)
            return error
          }}
        />
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Supprimer le client">
        <p className="text-sm text-slate-600 mb-6">
          Supprimer <strong>{deleteTarget ? displayName(deleteTarget) : ''}</strong> ? Cette action est irréversible.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors">
            Annuler
          </button>
          <button
            onClick={async () => {
              if (deleteTarget) {
                await removeClient(deleteTarget.id)
                setDeleteTarget(null)
              }
            }}
            className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors"
          >
            Supprimer
          </button>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal isOpen={!!detailTarget} onClose={() => setDetailTarget(null)} title={detailTarget ? displayName(detailTarget) : ''}>
        {detailTarget && (
          <ClientDetail client={detailTarget} onEdit={() => { openEdit(detailTarget); setDetailTarget(null) }} />
        )}
      </Modal>
    </div>
  )
}

// ── Card ────────────────────────────────────────────────────────

function ClientCard({ client, onClick, onEdit, onDelete }) {
  const isPro = client.type === 'professionnel'
  return (
    <div className="bg-white rounded-2xl p-3.5 shadow-card border border-slate-100">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isPro ? 'bg-violet-50' : 'bg-blue-50'
        }`}>
          {isPro
            ? <Building2 size={16} className="text-violet-600" />
            : <User      size={16} className="text-blue-600" />}
        </div>
        <button onClick={onClick} className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-slate-900 truncate">{displayName(client)}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {client.telephone && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Phone size={11} />{client.telephone}
              </span>
            )}
            {client.ville && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <MapPin size={11} />{client.ville}
              </span>
            )}
          </div>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onEdit} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Detail (avec historique devis) ──────────────────────────────

function ClientDetail({ client, onEdit }) {
  const [devis, setDevis]     = useState(null)
  const [loading, setLoading] = useState(true)

  useMemo(() => {
    let alive = true
    setLoading(true)
    listDevisForClient(client.nom).then(({ data }) => {
      if (alive) { setDevis(data); setLoading(false) }
    })
    return () => { alive = false }
  }, [client.nom])

  const isPro = client.type === 'professionnel'

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 rounded-xl p-3.5 space-y-1.5">
        <div className="flex items-center gap-2">
          {isPro
            ? <Building2 size={14} className="text-violet-600" />
            : <User      size={14} className="text-blue-600" />}
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isPro ? 'Professionnel' : 'Particulier'}</span>
        </div>
        <p className="text-base font-bold text-slate-900">{displayName(client)}</p>
        {client.email && (
          <p className="text-sm text-slate-600 inline-flex items-center gap-1.5">
            <Mail size={13} />{client.email}
          </p>
        )}
        {client.telephone && (
          <p className="text-sm text-slate-600 inline-flex items-center gap-1.5">
            <Phone size={13} />{client.telephone}
          </p>
        )}
        {(client.adresse || client.ville) && (
          <p className="text-sm text-slate-600 inline-flex items-start gap-1.5">
            <MapPin size={13} className="mt-0.5" />
            <span>
              {client.adresse}{client.adresse && (client.code_postal || client.ville) && <br />}
              {[client.code_postal, client.ville].filter(Boolean).join(' ')}
            </span>
          </p>
        )}
        {client.notes && (
          <div className="mt-2 pt-2 border-t border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Notes</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{client.notes}</p>
          </div>
        )}
      </div>

      {/* Historique devis */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <History size={14} className="text-slate-400" />
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Historique devis</p>
        </div>
        {loading ? (
          <div className="py-4 flex justify-center"><Loader2 size={16} className="animate-spin text-slate-400" /></div>
        ) : !devis || devis.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-3">Aucun devis pour ce client</p>
        ) : (
          <div className="space-y-1.5">
            {devis.map((d) => (
              <div key={d.id} className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{d.numero || '—'}</p>
                  <p className="text-xs text-slate-400">{formatDate(d.date_emission)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700 tabular-nums">{formatCurrency(d.montant_ht)}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    d.statut === 'Accepté' || d.statut === 'accepte' ? 'bg-emerald-50 text-emerald-700' :
                    d.statut === 'refuse' || d.statut === 'Refusé'   ? 'bg-red-50 text-red-600' :
                    'bg-blue-50 text-blue-700'
                  }`}>{d.statut}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onEdit}
        className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <Pencil size={14} />
        Modifier le client
      </button>
    </div>
  )
}

// ── Form ────────────────────────────────────────────────────────

function ClientForm({ initialData, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => {
    if (!initialData) return EMPTY_FORM
    return {
      type:          initialData.type || 'particulier',
      nom:           initialData.nom || '',
      prenom:        initialData.prenom || '',
      raisonSociale: initialData.raison_sociale || '',
      email:         initialData.email || '',
      telephone:     initialData.telephone || '',
      adresse:       initialData.adresse || '',
      codePostal:    initialData.code_postal || '',
      ville:         initialData.ville || '',
      notes:         initialData.notes || '',
    }
  })
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState(null)

  function set(k, v) { setForm((p) => ({ ...p, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nom.trim()) { setErr('Le nom est obligatoire'); return }
    setSubmitting(true)
    setErr(null)
    const error = await onSubmit(form)
    setSubmitting(false)
    if (error) setErr(error.message || 'Erreur d\'enregistrement')
  }

  const isPro = form.type === 'professionnel'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type toggle */}
      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
        {TYPE_OPTIONS.map((t) => (
          <button
            key={t.value} type="button"
            onClick={() => set('type', t.value)}
            className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
              form.type === t.value ? 'bg-white shadow-sm text-primary-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isPro && (
        <Field label="Raison sociale">
          <input type="text" value={form.raisonSociale}
            onChange={(e) => set('raisonSociale', e.target.value)}
            placeholder="SARL Dupond Plomberie" className={inp} />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={isPro ? 'Contact (nom)' : 'Nom *'}>
          <input type="text" value={form.nom}
            onChange={(e) => set('nom', e.target.value)}
            placeholder="Dupond" className={inp} required />
        </Field>
        <Field label={isPro ? 'Contact (prénom)' : 'Prénom'}>
          <input type="text" value={form.prenom}
            onChange={(e) => set('prenom', e.target.value)}
            placeholder="Jean" className={inp} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Téléphone">
          <input type="tel" value={form.telephone}
            onChange={(e) => set('telephone', e.target.value)}
            placeholder="06 12 34 56 78" className={inp} />
        </Field>
        <Field label="Email">
          <input type="email" value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="client@email.fr" className={inp} />
        </Field>
      </div>

      <Field label="Adresse">
        <input type="text" value={form.adresse}
          onChange={(e) => set('adresse', e.target.value)}
          placeholder="12 rue des Lilas" className={inp} />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Code postal">
          <input type="text" value={form.codePostal}
            onChange={(e) => set('codePostal', e.target.value)}
            placeholder="75001" maxLength={5} className={inp} />
        </Field>
        <div className="col-span-2">
          <Field label="Ville">
            <input type="text" value={form.ville}
              onChange={(e) => set('ville', e.target.value)}
              placeholder="Paris" className={inp} />
          </Field>
        </div>
      </div>

      <Field label="Notes (optionnel)">
        <textarea value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3} placeholder="Informations utiles…"
          className={`${inp} resize-none`} />
      </Field>

      {err && (
        <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <span>{err}</span>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors">
          Annuler
        </button>
        <button type="submit" disabled={submitting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent-500 hover:bg-accent-600 text-white font-semibold text-sm transition-colors disabled:opacity-60">
          {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
          {initialData ? 'Enregistrer' : 'Créer le client'}
        </button>
      </div>
    </form>
  )
}

// ── Empty state ─────────────────────────────────────────────────

function EmptyState({ search, onCreate }) {
  if (search) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
        <Search size={28} className="mx-auto text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">Aucun client ne correspond à « {search} »</p>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
      <Users size={32} className="mx-auto text-slate-300 mb-3" />
      <p className="text-sm font-semibold text-slate-700">Aucun client pour l'instant</p>
      <p className="text-xs text-slate-400 mt-1 mb-4">Créez votre première fiche pour commencer.</p>
      <button onClick={onCreate}
        className="inline-flex items-center gap-1.5 bg-accent-500 hover:bg-accent-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
        <Plus size={14} />
        Nouveau client
      </button>
    </div>
  )
}

// ── Helpers UI ──────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

const inp = 'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white outline-none transition-colors focus:border-primary-700 focus:ring-2 focus:ring-primary-900/10'

function displayName(c) {
  if (c.type === 'professionnel' && c.raison_sociale) return c.raison_sociale
  return [c.prenom, c.nom].filter(Boolean).join(' ') || c.nom || '—'
}


import { useState, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, HardHat,
  CalendarDays, User, FileText, CheckCircle2, AlertTriangle, Link2,
} from 'lucide-react'
import { useChantiers } from '../hooks/useChantiers'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import SearchBar from '../components/SearchBar'
import EmptyState from '../components/EmptyState'
import ChantierForm from '../components/forms/ChantierForm'
import { SkeletonCardList } from '../components/Skeleton'
import FloatingActionButton from '../components/FloatingActionButton'
import CountdownButton from '../components/CountdownButton'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import PullToRefreshIndicator from '../components/PullToRefreshIndicator'
import { formatDate } from '../utils/formatters'

const FILTERS = [
  { value: 'tous',     label: 'Tous'       },
  { value: 'planifie', label: 'Planifiés'  },
  { value: 'en_cours', label: 'En cours'   },
  { value: 'termine',  label: 'Terminés'   },
]

export default function Chantiers() {
  const { chantiers, loading, addChantier, updateChantier, deleteChantier, refresh } = useChantiers()
  const location = useLocation()
  const pullState = usePullToRefresh(refresh)
  const [search, setSearch]           = useState('')
  const [filter, setFilter]           = useState(() => location.state?.filter ?? 'tous')
  const [modalOpen, setModalOpen]     = useState(false)
  const [editing, setEditing]         = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const filtered = useMemo(() => {
    const q = (search || '').toLowerCase()
    return chantiers
      .filter((c) => {
        const matchSearch =
          (c.nom || '').toLowerCase().includes(q) ||
          (c.client || '').toLowerCase().includes(q)
        const matchFilter = filter === 'tous' || c.statut === filter
        return matchSearch && matchFilter
      })
      .sort((a, b) => {
        // Les chantiers sans date passent en dernier (created_at fallback).
        const ta = a.dateDebut ? new Date(a.dateDebut).getTime()
                               : a.created_at ? new Date(a.created_at).getTime() : 0
        const tb = b.dateDebut ? new Date(b.dateDebut).getTime()
                               : b.created_at ? new Date(b.created_at).getTime() : 0
        return tb - ta
      })
  }, [chantiers, search, filter])

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(c) {
    setEditing(c)
    setModalOpen(true)
  }

  function handleSubmit(data) {
    if (editing) {
      updateChantier(editing.id, data)
    } else {
      addChantier(data)
    }
    setModalOpen(false)
    setEditing(null)
  }

  function handleDelete() {
    if (deleteTarget) {
      deleteChantier(deleteTarget)
      setDeleteTarget(null)
    }
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  function toggleStatut(c) {
    // Cycle : planifie → en_cours → termine → en_cours
    let next
    if (c.statut === 'planifie')      next = 'en_cours'
    else if (c.statut === 'en_cours') next = 'termine'
    else                              next = 'en_cours'   // termine ou annule → relance
    updateChantier(c.id, { statut: next })
  }

  return (
    <div className="px-4 pt-12 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-primary-900">Chantiers</h1>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 bg-accent-500 hover:bg-accent-600 active:bg-accent-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus size={16} strokeWidth={2.5} />
          Nouveau
        </button>
      </div>

      {/* Search */}
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Rechercher un chantier ou client…"
      />

      {/* Filter chips */}
      <div className="flex gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              filter === f.value
                ? 'bg-primary-900 text-white border-primary-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Meta */}
      <p className="text-xs text-slate-400 font-medium mb-3">
        {filtered.length} chantier{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* List */}
      {loading ? (
        <SkeletonCardList count={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={HardHat}
          title="Aucun chantier trouvé"
          description={
            search
              ? `Aucun résultat pour « ${search} »`
              : 'Créez votre premier chantier pour commencer'
          }
          action={!search ? { label: 'Nouveau chantier', onClick: openCreate } : null}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <ChantierCard
              key={c.id}
              chantier={c}
              onEdit={() => openEdit(c)}
              onDelete={() => setDeleteTarget(c.id)}
              onToggle={() => toggleStatut(c)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editing ? 'Modifier le chantier' : 'Nouveau chantier'}
      >
        <ChantierForm
          initialData={editing}
          onSubmit={handleSubmit}
          onCancel={closeModal}
        />
      </Modal>

      {/* Delete confirm avec compte à rebours anti-clic accidentel */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer le chantier"
      >
        <p className="text-sm text-slate-600 mb-2">
          Êtes-vous sûr de vouloir supprimer ce chantier ? Cette action est irréversible.
        </p>
        <p className="text-[11px] text-slate-400 mb-6">
          Le bouton "Supprimer" s'active après 3 secondes pour éviter les clics accidentels.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setDeleteTarget(null)}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors"
          >
            Annuler
          </button>
          <CountdownButton
            countdown={3}
            resetKey={deleteTarget}
            onClick={handleDelete}
            className="flex-1 inline-flex items-center justify-center px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-red-300 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
          >
            Supprimer
          </CountdownButton>
        </div>
      </Modal>

      {/* Pull-to-refresh + FAB flottant */}
      <PullToRefreshIndicator {...pullState} />
      <FloatingActionButton onClick={openCreate} label="Nouveau chantier" />
    </div>
  )
}

// Détecte si un chantier est lié à un devis signé (notes générées par chantierFromDevis)
function isLinkedToDevis(chantier) {
  return chantier.notes?.includes('Issu du devis') || false
}

function ChantierCard({ chantier, onEdit, onDelete, onToggle }) {
  const linkedToDevis = isLinkedToDevis(chantier)
  const isOrphan = !linkedToDevis // chantier créé sans devis signé associé

  return (
    <div className={`bg-white rounded-2xl p-4 shadow-card border ${isOrphan ? 'border-amber-200' : 'border-slate-100'}`}>
      {/* Bandeau orphelin */}
      {isOrphan && (
        <div className="flex items-center gap-1.5 bg-amber-50 rounded-xl px-2.5 py-1.5 mb-3 -mt-0.5">
          <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
          <p className="text-[11px] text-amber-700 font-medium">
            Aucun devis signé associé — ce chantier a été créé manuellement
          </p>
        </div>
      )}
      {linkedToDevis && (
        <div className="flex items-center gap-1.5 bg-emerald-50 rounded-xl px-2.5 py-1.5 mb-3 -mt-0.5">
          <Link2 size={12} className="text-emerald-600 flex-shrink-0" />
          <p className="text-[11px] text-emerald-700 font-medium">
            {chantier.notes?.match(/Issu du devis ([^\s]+)/)?.[1] && `Devis ${chantier.notes.match(/Issu du devis ([^\s]+)/)[1]} signé`}
          </p>
        </div>
      )}

      {/* Top */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 leading-snug">{chantier.nom}</h3>
          <span className="inline-flex items-center gap-1 text-xs text-slate-400 mt-1">
            <User size={11} strokeWidth={2} />
            {chantier.client}
          </span>
        </div>
        <Badge statut={chantier.statut} />
      </div>

      {/* Date */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
        <CalendarDays size={12} strokeWidth={2} />
        <span>Début : {formatDate(chantier.dateDebut)}</span>
      </div>

      {/* Notes */}
      {chantier.notes && (
        <div className="flex gap-2 bg-slate-50 rounded-xl p-3 mb-3">
          <FileText size={13} className="text-slate-400 mt-0.5 flex-shrink-0" strokeWidth={2} />
          <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">{chantier.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onToggle}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
            chantier.statut === 'en_cours'
              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : chantier.statut === 'planifie'
                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
          }`}
        >
          <CheckCircle2 size={13} strokeWidth={2.5} />
          {chantier.statut === 'en_cours'  && 'Marquer terminé'}
          {chantier.statut === 'planifie'  && 'Démarrer le chantier'}
          {chantier.statut === 'termine'   && 'Reprendre le chantier'}
          {chantier.statut === 'annule'    && 'Réactiver'}
          {!['en_cours','planifie','termine','annule'].includes(chantier.statut) && 'Marquer en cours'}
        </button>
        <button
          onClick={onEdit}
          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={onDelete}
          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}


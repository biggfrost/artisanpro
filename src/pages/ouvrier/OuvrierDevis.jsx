import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Phone, FileText, AlertCircle, Loader2, Lock, Shield,
  Mail, Download, Clock,
} from 'lucide-react'
import { useMesDevis } from '../../hooks/useMesDevis'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../../components/Modal'
import Badge from '../../components/Badge'
import SearchBar from '../../components/SearchBar'
import EmptyState from '../../components/EmptyState'
import DevisForm from '../../components/forms/DevisForm'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { getNextDevisNumber } from '../../utils/devisNumero'
import { downloadDevisPdf, envoyerDevisPdf } from '../../utils/devisPdf'
import { loadArtisanProfilSupabase, getSignatureParToken } from '../../services/supabase'
import { chantierFromDevis, createChantier, chantierExisteDejaPourDevis } from '../../services/chantiersService'
import { findOrCreateClient } from '../../services/clientsService'
import { useToast } from '../../contexts/ToastContext'

const FILTERS = [
  { value: 'tous',                  label: 'Tous'           },
  { value: 'en_attente_validation', label: '⏳ En attente'  },
  { value: 'envoye',                label: 'Validés'        },
  { value: 'accepte',               label: 'Acceptés'       },
  { value: 'refuse',                label: 'Refusés'        },
]

export default function OuvrierDevis() {
  const { profile, entreprise } = useAuth()
  const { devis, loading, error, addDevis } = useMesDevis()
  const [search, setSearch]           = useState('')
  const [filter, setFilter]           = useState('tous')
  const [modalOpen, setModalOpen]     = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [artisanData, setArtisanData] = useState(null)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    loadArtisanProfilSupabase().then((profil) => {
      if (cancelled) return
      const base = profil?.donnees_json || {}
      setArtisanData({
        ...base,
        raisonSociale: entreprise?.nom || base.raisonSociale || '',
        nom:           base.nom || entreprise?.nom || '',
        siret:         entreprise?.siret || base.siret || '',
        adresse:       entreprise?.adresse || base.adresse || '',
        codePostal:    entreprise?.code_postal || base.codePostal || '',
        ville:         entreprise?.ville || base.ville || '',
        telephone:     entreprise?.telephone || base.telephone || '',
        email:         entreprise?.email || base.email || '',
        signatureArtisan: profil?.signature_base64 || null,
      })
    })
    return () => { cancelled = true }
  }, [entreprise?.id])

  async function handleDownload(d) {
    if (!artisanData) return
    let signatures = null
    if (d.statut === 'accepte' && d.tokenUnique) {
      const { data: sigData } = await getSignatureParToken(d.tokenUnique)
      if (sigData?.signature_client_base64) {
        signatures = {
          artisan:      artisanData.signatureArtisan,
          artisanVille: artisanData.ville || '',
          client:       sigData.signature_client_base64,
          ville:        sigData.ville_client || '',
          signeLe:      sigData.signe_le || '',
        }
      }
    }
    downloadDevisPdf(d, artisanData, signatures)
  }

  async function handleEmail(d) {
    if (!artisanData) return
    let signatures = null
    if (d.statut === 'accepte' && d.tokenUnique) {
      const { data: sigData } = await getSignatureParToken(d.tokenUnique)
      if (sigData?.signature_client_base64) {
        signatures = {
          artisan:      artisanData.signatureArtisan,
          artisanVille: artisanData.ville || '',
          client:       sigData.signature_client_base64,
          ville:        sigData.ville_client || '',
          signeLe:      sigData.signe_le || '',
        }
      }
    }
    await envoyerDevisPdf(d, artisanData, signatures)
  }

  const filtered = useMemo(() => {
    return devis.filter((d) => {
      const matchSearch = (d.client || '').toLowerCase().includes(search.toLowerCase())
      const matchFilter = filter === 'tous' || d.statut === filter
      return matchSearch && matchFilter
    })
  }, [devis, search, filter])

  const enAttente = useMemo(() => devis.filter((d) => d.statut === 'en_attente_validation').length, [devis])

  async function handleSubmit(data) {
    setSubmitError(null)
    const payload = { ...data, numero: data.numero || getNextDevisNumber() }
    const { error } = await addDevis(payload)
    if (error) {
      // Si erreur de contrainte CHECK → la migration SQL n'a pas été exécutée
      const msg = error.message || ''
      if (msg.includes('check') || msg.includes('constraint') || msg.includes('violates')) {
        setSubmitError('Erreur de configuration : demandez à votre manager d\'exécuter la migration SQL de validation.')
      } else {
        setSubmitError(msg)
      }
      return
    }
    setModalOpen(false)
    toast.success('Devis envoyé au manager pour validation')

    // Side effects best-effort
    if (entreprise?.id) {
      try {
        await findOrCreateClient(entreprise.id, payload)
        const dejaPresent = await chantierExisteDejaPourDevis(payload.numero)
        if (!dejaPresent) {
          const cf = chantierFromDevis(payload)
          await createChantier(entreprise.id, cf)
        }
      } catch { /* silencieux */ }
    }
  }

  return (
    <div className="px-4 pt-12 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-slate-500 font-medium">Mes devis</p>
          <h1 className="text-2xl font-bold text-primary-900">Devis</h1>
          {profile?.prenom && (
            <p className="text-xs text-slate-400 mt-0.5">{profile.prenom} {profile.nom}</p>
          )}
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 bg-accent-500 hover:bg-accent-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors active:scale-95"
        >
          <Plus size={16} strokeWidth={2.5} />
          Nouveau
        </button>
      </div>

      {/* Bandeau workflow validation */}
      <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 mb-3">
        <Clock size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Validation requise.</strong> Vos devis sont soumis au manager avant envoi au client.
          {enAttente > 0 && (
            <> <span className="font-bold">{enAttente} devis</span> en attente de validation.</>
          )}
        </p>
      </div>

      {/* Bandeau légal */}
      <div className="flex gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 mb-3">
        <Shield size={15} className="text-primary-700 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong className="text-slate-800">Inaltérables après création</strong> — conformément à l'article 286 du CGI.
        </p>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un client…" />

      {/* Filtres */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              filter === f.value
                ? 'bg-primary-900 text-white border-primary-900'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700 mb-3">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 size={24} className="animate-spin text-primary-700" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucun devis"
          description={search ? `Aucun résultat pour « ${search} »` : 'Créez votre premier devis — il sera soumis à validation'}
          action={!search ? { label: 'Nouveau devis', onClick: () => setModalOpen(true) } : null}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <DevisCardOuvrier
              key={d.id}
              devis={d}
              onDownload={() => handleDownload(d)}
              onEmail={() => handleEmail(d)}
            />
          ))}
        </div>
      )}

      {/* Modal création */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setSubmitError(null) }}
        title="Nouveau devis"
      >
        {/* Info validation */}
        <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4">
          <Clock size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Ce devis sera soumis à votre manager pour validation avant d'être envoyé au client.
          </p>
        </div>

        {submitError && (
          <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700 mb-3">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /><span>{submitError}</span>
          </div>
        )}
        <DevisForm
          initialData={null}
          onSubmit={handleSubmit}
          onCancel={() => { setModalOpen(false); setSubmitError(null) }}
        />
      </Modal>
    </div>
  )
}

// ── Card ouvrier — pas de menu statut (géré par manager) ────────────
function DevisCardOuvrier({ devis, onDownload, onEmail }) {
  const [sending, setSending]         = useState(false)
  const [downloading, setDownloading] = useState(false)
  const montant  = devis.totalTTC ?? devis.totalHT ?? devis.montantHT ?? 0
  const isPending = devis.statut === 'en_attente_validation'

  async function handleEmail() {
    setSending(true)
    try { await onEmail() } finally { setSending(false) }
  }
  async function handleDownload() {
    setDownloading(true)
    try { await onDownload() } finally { setDownloading(false) }
  }

  return (
    <div className={`bg-white rounded-2xl p-4 shadow-card border transition-colors ${
      isPending ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100'
    }`}>
      {/* En-tête */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 truncate">{devis.client}</h3>
            {devis.numero && (
              <span className="text-xs text-slate-400 font-mono flex-shrink-0">{devis.numero}</span>
            )}
          </div>
          {devis.clientTelephone && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-400 mt-0.5">
              <Phone size={11} strokeWidth={2} />{devis.clientTelephone}
            </span>
          )}
        </div>
        <Badge statut={devis.statut} />
      </div>

      {/* Bandeau attente */}
      {isPending && (
        <div className="flex items-center gap-1.5 bg-amber-100 rounded-lg px-2.5 py-1.5 mb-2">
          <Clock size={12} className="text-amber-600 flex-shrink-0" />
          <p className="text-[11px] font-semibold text-amber-800">
            En attente de validation par le manager
          </p>
        </div>
      )}

      {devis.description && (
        <p className="text-sm text-slate-500 line-clamp-2 mb-3">{devis.description}</p>
      )}

      {/* CTA envoi PDF si accepté */}
      {devis.statut === 'accepte' && devis.clientEmail && (
        <button
          onClick={handleEmail}
          disabled={sending}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs border border-emerald-200 mb-3 transition-colors disabled:opacity-60"
        >
          {sending
            ? <><Loader2 size={13} className="animate-spin" />Envoi…</>
            : <><Mail size={13} />Envoyer le devis signé à {devis.clientEmail}</>}
        </button>
      )}

      <div className="flex items-end justify-between">
        <div>
          <p className="text-base font-bold text-slate-900">{formatCurrency(montant)}</p>
          <p className="text-xs text-slate-400">TTC · {formatDate(devis.dateEmission)}</p>
        </div>
        <div className="flex items-center gap-1">
          {/* Télécharger PDF — désactivé en attente */}
          <button
            onClick={handleDownload}
            disabled={downloading || isPending}
            title={isPending ? 'PDF disponible après validation' : 'Télécharger PDF'}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-blue-50 text-slate-400 hover:text-primary-700 transition-colors disabled:opacity-30"
          >
            {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          </button>

          {/* Envoyer email — désactivé en attente */}
          {devis.clientEmail && (
            <button
              onClick={handleEmail}
              disabled={sending || isPending}
              title={isPending ? 'Envoi disponible après validation' : 'Envoyer par email'}
              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-accent-50 text-slate-400 hover:text-accent-600 transition-colors disabled:opacity-30"
            >
              {sending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
            </button>
          )}

          {/* Cadenas légal */}
          <div title="Devis verrouillé (CGI art. 286)"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 cursor-help">
            <Lock size={13} />
          </div>
        </div>
      </div>
    </div>
  )
}

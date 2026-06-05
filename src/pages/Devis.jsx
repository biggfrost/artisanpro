import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Plus, Phone, MoreVertical,
  FileText, FileDown, Download, Mail, AlertCircle, Loader2, PenLine, Copy, Check,
  Lock, Files, Shield, CheckCircle, Share2, Clock, ThumbsUp, ThumbsDown,
  Eye, Pencil, X, MapPin, Euro, Calendar as CalIcon,
  MessageCircle, MessageSquare,
} from 'lucide-react'
import { todayISO } from '../utils/formatters'
import { useDevis } from '../hooks/useDevis'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import SearchBar from '../components/SearchBar'
import EmptyState from '../components/EmptyState'
import DevisForm from '../components/forms/DevisForm'
import { formatDate, formatCurrency } from '../utils/formatters'
import { loadParametres, isParametresComplete } from '../services/parametres'
import { getNextDevisNumber } from '../utils/devisNumero'
import { downloadDevisPdf, envoyerDevisPdf } from '../utils/devisPdf'
import { envoyerPourSignature, listTokensSignes, getSignatureParToken } from '../services/supabase'
import { listDevisAuthenticated, normalizeDevis, updateDevisStatut, updateDevisEnAttente } from '../services/devisService'
import { UserCircle } from 'lucide-react'
import { chantierFromDevis, createChantier, chantierExisteDejaPourDevis } from '../services/chantiersService'
import { findOrCreateClient } from '../services/clientsService'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { shareDevis, shareSigningLink } from '../utils/share'
import { mergeDevis } from '../utils/mergeDevis'
import { haptic } from '../utils/haptics'
import { exportDevisCSV } from '../services/exportCsv'

const FILTERS = [
  { value: 'tous',                  label: 'Tous'         },
  { value: 'envoye',                label: 'Envoyés'      },
  { value: 'accepte',               label: 'Acceptés'     },
  { value: 'refuse',                label: 'Refusés'      },
  { value: 'relance',               label: '🔔 Relances'   },
]

// Statuts modifiables MANUELLEMENT par le manager.
// ⚠️  'accepte' est INTENTIONNELLEMENT absent : un devis ne peut être accepté
//     que par la signature électronique du client. Toute autre voie est invalide.
const STATUS_LABELS = {
  envoye:  'Marquer Envoyé',
  refuse:  'Marquer Refusé',
  annule:  'Marquer Annulé',
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export default function Devis() {
  // updateDevis et deleteDevis ne sont PAS exposés à l'UI : conformément à
  // l'article 286 du CGI, un devis émis est inaltérable. updateDevis est
  // utilisé en interne UNIQUEMENT pour les métadonnées (statut, tokenUnique,
  // signedAt) — jamais pour le contenu du devis.
  const { devis, addDevis, updateDevis } = useDevis()
  const location   = useLocation()
  const navigate   = useNavigate()
  // Déclarés tôt pour être disponibles dans syncSignedDevis (useCallback)
  const ent  = useAuth().entreprise
  const toast = useToast()
  const [search, setSearch]               = useState('')
  const [filter, setFilter]               = useState(() => location.state?.filter ?? 'tous')
  const [sortDesc, setSortDesc]           = useState(true)
  const [modalOpen, setModalOpen]         = useState(false)
  // prefill = source d'une duplication (annule-et-remplace). Pas d'édition.
  const [prefill, setPrefill]             = useState(null)
  const [pdfAlert, setPdfAlert]           = useState(false)
  const [sigModal, setSigModal]           = useState(null)  // devis being sent
  const [sigResult, setSigResult]         = useState(null)  // { signingUrl }
  const [sigSending, setSigSending]       = useState(false)
  const [sigError, setSigError]           = useState(null)
  const [copied, setCopied]               = useState(false)

  const artisan = useMemo(loadParametres, [])
  const artisanOk = useMemo(() => isParametresComplete(artisan), [artisan])

  // Devis Supabase (incluant ceux émis par les ouvriers de l'entreprise).
  // RLS filtre déjà : un manager voit tous les devis de son entreprise.
  const [supabaseDevis, setSupabaseDevis] = useState([])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await listDevisAuthenticated()
      if (!cancelled) setSupabaseDevis(data.map(normalizeDevis))
    })()
    return () => { cancelled = true }
  }, [])

  // Fusion localStorage + Supabase.
  // mergeDevis garantit qu'un devis 'accepte' gagne toujours sur 'envoye',
  // élimine les doublons internes à Supabase, et donne priorité aux devis
  // ouvriers sur les copies locales de même numéro.
  const mergedDevis = useMemo(() => mergeDevis(devis, supabaseDevis), [devis, supabaseDevis])

  // Refs pour que le sync utilise toujours les dernières versions sans relancer l'effet.
  const devisRef = useRef(devis)
  const updateDevisRef = useRef(updateDevis)
  useEffect(() => { devisRef.current = devis }, [devis])
  useEffect(() => { updateDevisRef.current = updateDevis }, [updateDevis])

  // Synchronise depuis Supabase : pour chaque devis local ayant un tokenUnique
  // et qui n'est pas encore accepté, vérifie si le client l'a signé.
  // C'est la SEULE voie légitime pour passer un devis en statut 'accepte'.
  // En cas d'acceptation : marque le devis + crée automatiquement le chantier.
  const syncSignedDevis = useCallback(async () => {
    const list = devisRef.current
    const tokens = list
      .filter((d) => d.tokenUnique && d.statut !== 'accepte')
      .map((d) => d.tokenUnique)
    if (!tokens.length) return
    const signed = await listTokensSignes(tokens)
    if (!signed.length) return
    const upd = updateDevisRef.current
    for (const s of signed) {
      const local = list.find((d) => d.tokenUnique === s.token)
      if (local && local.statut !== 'accepte') {
        // 1. Marque le devis comme accepté (signature client reçue)
        const devisAccepte = {
          ...local,
          statut:      'accepte',
          signedAt:    s.signe_le,
          signedVille: s.ville_client,
        }
        upd(local.id, {
          statut:      'accepte',
          signedAt:    s.signe_le,
          signedVille: s.ville_client,
        })

        // 2. Crée automatiquement le chantier correspondant (statut planifie)
        //    uniquement si aucun chantier n'existe déjà pour ce devis
        if (ent?.id) {
          try {
            const dejaPresent = await chantierExisteDejaPourDevis(local.numero)
            if (!dejaPresent) {
              const chantierForm = chantierFromDevis(devisAccepte)
              await createChantier(ent.id, chantierForm)
              toast.success(`✅ Devis ${local.numero} accepté — chantier créé automatiquement`)
            } else {
              toast.success(`✅ Devis ${local.numero} signé par le client`)
            }
          } catch { /* silencieux */ }
        }
      }
    }
  }, [ent?.id, toast])

  // Sync au montage + quand l'onglet redevient visible (l'utilisateur revient sur l'app).
  useEffect(() => {
    syncSignedDevis()
    const onVisible = () => { if (!document.hidden) syncSignedDevis() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [syncSignedDevis])

  const filtered = useMemo(() => {
    const now = Date.now()
    return mergedDevis
      .filter((d) => {
        // Les devis en attente ont leur propre section — exclus du reste
        if (d.statut === 'en_attente_validation') return false
        const matchSearch = (d.client || '').toLowerCase().includes(search.toLowerCase())
        let matchFilter
        if (filter === 'tous') {
          matchFilter = true
        } else if (filter === 'relance') {
          matchFilter = d.statut === 'envoye' && now - new Date(d.date || d.dateEmission || 0).getTime() > SEVEN_DAYS_MS
        } else {
          matchFilter = d.statut === filter
        }
        return matchSearch && matchFilter
      })
      .sort((a, b) => {
        const diff = new Date(b.date || b.dateEmission || 0) - new Date(a.date || a.dateEmission || 0)
        return sortDesc ? diff : -diff
      })
  }, [mergedDevis, search, filter, sortDesc])

  function openCreate() { setPrefill(null); setModalOpen(true) }

  // Duplique un devis existant en gardant ses prestations comme point de
  // départ d'un NOUVEAU devis (procédure « annule et remplace »). Ne touche
  // jamais l'original.
  function openDuplicate(d) {
    setPrefill({
      ...d,
      id:              undefined,         // forcer la création
      numero:          '',                // nouveau numéro auto
      dateEmission:    todayISO(),
      date:            todayISO(),
      statut:          'envoye',
      tokenUnique:     null,
      signedAt:        null,
      signedVille:     null,
      createdAt:       undefined,
    })
    setModalOpen(true)
  }

  async function handleSubmit(data) {
    const numero = data.numero || getNextDevisNumber()
    const devisAvecNumero = { ...data, numero }
    addDevis(devisAvecNumero)
    setModalOpen(false)
    setPrefill(null)

    // Side effect : synchronise le client dans Supabase.
    // Le chantier sera créé automatiquement UNIQUEMENT quand le client
    // signe le devis — pas avant. Créer un chantier avant signature serait
    // illogique (le client n'a pas encore accepté la mission).
    if (ent?.id) {
      try {
        await findOrCreateClient(ent.id, devisAvecNumero)
      } catch { /* silencieux */ }
    }
  }

  function closeModal() { setModalOpen(false); setPrefill(null) }

  async function handleDownload(d) {
    if (!artisanOk) { setPdfAlert(true); return }

    // Si le devis a été accepté, on récupère les deux signatures depuis Supabase
    // pour les intégrer dans le PDF (artisan + client + ville + date).
    let signatures = null
    if (d.statut === 'accepte' && d.tokenUnique) {
      const { data: sigData } = await getSignatureParToken(d.tokenUnique)
      if (sigData?.signature_client_base64) {
        signatures = {
          artisan:      artisan.signatureArtisan || null,
          artisanVille: artisan.ville || '',
          client:       sigData.signature_client_base64,
          ville:        sigData.ville_client || '',
          signeLe:      sigData.signe_le || '',
        }
      }
    }
    downloadDevisPdf(d, artisan, signatures)
  }

  async function handleEmail(d) {
    if (!artisanOk) { setPdfAlert(true); return }

    // Pour un devis accepté, on récupère les signatures et on les inclut
    // dans le PDF envoyé — comme ça le client reçoit la version signée.
    let signatures = null
    if (d.statut === 'accepte' && d.tokenUnique) {
      const { data: sigData } = await getSignatureParToken(d.tokenUnique)
      if (sigData?.signature_client_base64) {
        signatures = {
          artisan:      artisan.signatureArtisan || null,
          artisanVille: artisan.ville || '',
          client:       sigData.signature_client_base64,
          ville:        sigData.ville_client || '',
          signeLe:      sigData.signe_le || '',
        }
      }
    }
    await envoyerDevisPdf(d, artisan, signatures)
  }

  async function handleEnvoyerSignature(d) {
    if (!artisanOk) { setPdfAlert(true); return }
    setSigModal(d)
    setSigResult(null)
    setSigError(null)
    setSigSending(true)
    const res = await envoyerPourSignature(d)
    setSigSending(false)
    if (res.error) {
      setSigError(res.error.message || 'Erreur lors de la création du lien de signature.')
    } else {
      setSigResult(res)
      updateDevis(d.id, { tokenUnique: res.token, statut: 'envoye' })
    }
  }

  function handleCopyLink() {
    if (!sigResult?.signingUrl) return
    navigator.clipboard.writeText(sigResult.signingUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function closeSigModal() {
    setSigModal(null)
    setSigResult(null)
    setSigError(null)
    setCopied(false)
  }

  // ── Devis ouvriers en attente de validation ──────────────────────
  const devisEnAttente = useMemo(() =>
    mergedDevis.filter((d) => d.statut === 'en_attente_validation'),
  [mergedDevis])

  const [validating, setValidating]   = useState({}) // id → 'approve' | 'refuse'
  const [detailDevis, setDetailDevis] = useState(null) // devis ouvert dans le panel

  // Sauvegarde des modifications faites par le manager avant validation
  async function handleSaveEdit(id, formData) {
    const { data, error } = await updateDevisEnAttente(id, formData)
    if (error) { toast.error('Erreur lors de la modification : ' + error.message); return }
    // Met à jour le devis dans supabaseDevis
    setSupabaseDevis((prev) => prev.map((x) => x.id === id ? data : x))
    setDetailDevis(data) // rafraîchit le panel ouvert
    toast.success('Devis modifié')
    haptic.success()
  }

  async function handleApprove(d) {
    setValidating((v) => ({ ...v, [d.id]: 'approve' }))
    haptic.success()
    if (d._source === 'supabase') {
      await updateDevisStatut(d.id, 'envoye')
      setSupabaseDevis((prev) => prev.map((x) => x.id === d.id ? { ...x, statut: 'envoye' } : x))
    } else {
      updateDevis(d.id, { statut: 'envoye' })
    }
    toast.success(`Devis ${d.numero || ''} validé — l'ouvrier peut maintenant l'envoyer`)
    setValidating((v) => { const n = { ...v }; delete n[d.id]; return n })
  }

  async function handleRefuse(d) {
    setValidating((v) => ({ ...v, [d.id]: 'refuse' }))
    haptic.warning()
    if (d._source === 'supabase') {
      await updateDevisStatut(d.id, 'refuse')
      setSupabaseDevis((prev) => prev.map((x) => x.id === d.id ? { ...x, statut: 'refuse' } : x))
    } else {
      updateDevis(d.id, { statut: 'refuse' })
    }
    toast.info(`Devis ${d.numero || ''} refusé — l'ouvrier en sera informé`)
    setValidating((v) => { const n = { ...v }; delete n[d.id]; return n })
  }

  function handleExportCSV() {
    const now = new Date()
    exportDevisCSV(mergedDevis, now.getMonth(), now.getFullYear())
    toast.success('Export CSV téléchargé')
    haptic.success()
  }

  return (
    <div className="px-4 pt-12 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-primary-900">Devis</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            title="Export comptable CSV (EBP, Sage, Cegid)"
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-primary-700 transition-colors shadow-card"
          >
            <FileDown size={16} />
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 bg-accent-500 hover:bg-accent-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors active:scale-95"
          >
            <Plus size={16} strokeWidth={2.5} />
            Nouveau
          </button>
        </div>
      </div>

      {/* Bannière légale : inaltérabilité des devis (CGI art. 286) */}
      <div className="flex gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 mb-3">
        <Shield size={15} className="text-primary-700 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong className="text-slate-800">Conformité anti-fraude (CGI art. 286).</strong>{' '}
          Une fois émis, vos devis sont inaltérables. Pour corriger un devis, utilisez{' '}
          <strong>Dupliquer</strong> pour créer un devis « annule et remplace ».
        </p>
      </div>

      {/* ── Section Validation ouvriers ────────────────────────────── */}
      {devisEnAttente.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse-dot" />
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">
              {devisEnAttente.length} devis en attente de validation
            </p>
          </div>
          <div className="space-y-2">
            {devisEnAttente.map((d) => (
              <ValidationCard
                key={d.id}
                devis={d}
                loading={validating[d.id]}
                onView={() => setDetailDevis(d)}
                onApprove={() => handleApprove(d)}
                onRefuse={() => handleRefuse(d)}
              />
            ))}
          </div>
          <div className="mt-3 h-px bg-slate-200" />
        </div>
      )}

      {/* Paramètres incomplete warning */}
      {!artisanOk && (
        <button
          onClick={() => navigate('/manager/parametres')}
          className="w-full flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-left"
        >
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Paramètres incomplets</p>
            <p className="text-xs text-amber-600">Renseignez vos infos artisan pour générer des PDFs → Réglages</p>
          </div>
        </button>
      )}

      <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un client…" />

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide -mx-1 px-1">
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

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-400 font-medium">
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setSortDesc((v) => !v)}
          className="text-xs text-slate-500 font-medium hover:text-slate-700 transition-colors"
        >
          Date {sortDesc ? '↓' : '↑'}
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucun devis trouvé"
          description={search ? `Aucun résultat pour « ${search} »` : 'Créez votre premier devis'}
          action={!search ? { label: 'Nouveau devis', onClick: openCreate } : null}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <DevisCard
              key={d.id}
              devis={d}
              onDuplicate={() => openDuplicate(d)}
              onStatus={async (statut) => {
                if (d._source === 'supabase') {
                  // Devis créé par un ouvrier dans Supabase → update via service
                  await updateDevisStatut(d.id, statut)
                  setSupabaseDevis((prev) => prev.map((x) => x.id === d.id ? { ...x, statut } : x))
                } else {
                  updateDevis(d.id, { statut })
                }
              }}
              onDownload={() => handleDownload(d)}
              onEmail={() => handleEmail(d)}
              onSignature={() => handleEnvoyerSignature(d)}
            />
          ))}
        </div>
      )}

      {/* Create modal (création OU duplication — jamais d'édition) */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={prefill
          ? `Annule et remplace ${prefill.numero || ''}`.trim()
          : 'Nouveau devis'
        }
      >
        {prefill && (
          <div className="flex gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-3">
            <Copy size={13} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              Vous créez un <strong>nouveau devis</strong> à partir d'un devis existant. L'original
              reste inchangé et reste consultable dans la liste.
            </p>
          </div>
        )}
        <DevisForm initialData={prefill} onSubmit={handleSubmit} onCancel={closeModal} />
      </Modal>

      {/* Signature sending modal */}
      <Modal isOpen={!!sigModal} onClose={closeSigModal} title="Envoyer pour signature électronique">
        {sigSending && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 size={28} className="animate-spin text-primary-700" />
            <p className="text-sm text-slate-500">Création du lien de signature…</p>
          </div>
        )}
        {sigError && (
          <div className="space-y-4">
            <div className="flex gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{sigError}</span>
            </div>
            {(sigError.includes('schema cache') || sigError.includes('PGRST200') || sigError.includes('Could not find')) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                  Correction requise dans Supabase
                </p>
                <p className="text-xs text-amber-700">
                  Ouvrez l&rsquo;éditeur SQL de votre projet Supabase et exécutez ce code :
                </p>
                <pre className="text-[10px] bg-white border border-amber-200 rounded-lg px-3 py-2 overflow-x-auto text-slate-700 select-all leading-relaxed">{`GRANT ALL ON TABLE artisan_profil TO anon;
GRANT ALL ON TABLE devis TO anon;
GRANT ALL ON TABLE signatures TO anon;
ALTER TABLE artisan_profil ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON artisan_profil FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON devis FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON signatures FOR ALL TO anon USING (true) WITH CHECK (true);
NOTIFY pgrst, 'reload schema';`}</pre>
                <p className="text-xs text-amber-600">Puis rechargez la page et réessayez.</p>
              </div>
            )}
            <button onClick={closeSigModal} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700">
              Fermer
            </button>
          </div>
        )}
        {sigResult && !sigSending && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Le lien ci-dessous permet à <strong>{sigModal?.client}</strong> de consulter et signer le devis <strong>{sigModal?.numero}</strong>.
            </p>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
              <p className="text-xs text-primary-700 font-mono flex-1 truncate">{sigResult.signingUrl}</p>
              <button
                onClick={handleCopyLink}
                className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-900 transition-colors"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copié' : 'Copier'}
              </button>
            </div>

            {/* Partage natif : WhatsApp, SMS, email, Messenger… */}
            <button
              onClick={async () => {
                haptic.light()
                const res = await shareSigningLink(sigModal, artisan, sigResult.signingUrl)
                if (res.method === 'clipboard') {
                  toast.success('Lien copié — collez-le où vous voulez')
                } else if (res.method === 'share') {
                  toast.success('Lien partagé')
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-primary-900 hover:bg-primary-800 text-white text-sm font-bold transition-colors active:scale-95"
            >
              <Share2 size={16} />
              Partager le lien de signature
            </button>
            <p className="text-[11px] text-slate-400 text-center">
              WhatsApp, SMS, email, Messenger… choisissez le canal de votre client
            </p>

            {/* Raccourcis directs complémentaires */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  const text = encodeURIComponent(
                    `Bonjour ${sigModal?.client || ''}, veuillez signer votre devis ${sigModal?.numero || ''} ici : ${sigResult.signingUrl}`
                  )
                  window.open(`https://wa.me/?text=${text}`, '_blank')
                }}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200 transition-colors"
              >
                <MessageCircle size={14} />
                WhatsApp
              </button>
              <button
                onClick={() => {
                  const subject = encodeURIComponent(`Devis ${sigModal?.numero} — à signer`)
                  const body = encodeURIComponent(
                    `Bonjour ${sigModal?.client || ''},\n\nVeuillez cliquer sur le lien ci-dessous pour consulter et signer votre devis :\n\n${sigResult.signingUrl}\n\nCordialement,\n${artisan.raisonSociale || artisan.nom}`
                  )
                  window.open(`mailto:${sigModal?.clientEmail || ''}?subject=${subject}&body=${body}`, '_blank')
                }}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 transition-colors"
              >
                <Mail size={14} />
                Email
              </button>
              <button
                onClick={() => {
                  const body = encodeURIComponent(
                    `Bonjour ${sigModal?.client || ''}, signez votre devis ${sigModal?.numero || ''} : ${sigResult.signingUrl}`
                  )
                  window.open(`sms:${sigModal?.clientTelephone || ''}?body=${body}`, '_blank')
                }}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold border border-violet-200 transition-colors"
              >
                <MessageSquare size={14} />
                SMS
              </button>
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copié' : 'Copier'}
              </button>
            </div>

            <button onClick={closeSigModal} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Fermer
            </button>
          </div>
        )}
      </Modal>


      {/* ── Panel détail / édition devis en attente ─────────────── */}
      {detailDevis && (
        <ValidationDetailModal
          devis={detailDevis}
          artisan={artisan}
          loading={validating[detailDevis.id]}
          onClose={() => setDetailDevis(null)}
          onSave={(formData) => handleSaveEdit(detailDevis.id, formData)}
          onApprove={() => { handleApprove(detailDevis); setDetailDevis(null) }}
          onRefuse={() => { handleRefuse(detailDevis); setDetailDevis(null) }}
        />
      )}

      {/* PDF alert: incomplete settings */}
      <Modal isOpen={pdfAlert} onClose={() => setPdfAlert(false)} title="Paramètres incomplets">
        <p className="text-sm text-slate-600 mb-2">
          Pour générer un devis PDF conforme, renseignez d'abord vos informations artisan (nom, SIRET, etc.).
        </p>
        <p className="text-xs text-slate-400 mb-6">Ces informations apparaîtront sur le document officiel.</p>
        <div className="flex gap-3">
          <button onClick={() => setPdfAlert(false)} className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium">
            Plus tard
          </button>
          <button
            onClick={() => { setPdfAlert(false); navigate('/manager/parametres') }}
            className="flex-1 px-4 py-3 rounded-xl bg-primary-900 text-white text-sm font-semibold"
          >
            Aller aux réglages
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ── ValidationCard — devis ouvrier en attente de validation ────────
function ValidationCard({ devis, loading, onView, onApprove, onRefuse }) {
  const montant    = devis.totalTTC ?? devis.totalHT ?? devis.montantHT ?? 0
  const createur   = devis.createur
  const nomOuvrier = createur
    ? `${createur.prenom || ''} ${createur.nom || ''}`.trim()
    : 'Ouvrier'
  const descText = devis.prestations?.length
    ? devis.prestations.map((p) => p.description).filter(Boolean).join(' — ')
    : devis.description

  return (
    <div className="bg-white border-2 border-amber-300 rounded-2xl p-4 shadow-card">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-slate-900 truncate">{devis.client}</h3>
            {devis.numero && (
              <span className="text-xs text-slate-400 font-mono flex-shrink-0">{devis.numero}</span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full mt-1">
            <UserCircle size={11} />
            Soumis par {nomOuvrier}
          </span>
        </div>
        <button
          onClick={onView}
          className="flex items-center gap-1.5 bg-primary-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl active:scale-95 transition-transform flex-shrink-0"
        >
          <Eye size={13} />
          Voir
        </button>
      </div>

      {/* Description */}
      {descText && <p className="text-sm text-slate-500 line-clamp-2 mb-3">{descText}</p>}

      {/* Montant */}
      <p className="text-base font-bold text-slate-900">{formatCurrency(montant)}</p>
      <p className="text-xs text-slate-400 mb-4">
        TTC · {formatDate(devis.dateEmission || devis.date)}
      </p>

      {/* Actions refuser / valider */}
      <div className="flex gap-2">
        <button
          onClick={onRefuse}
          disabled={!!loading}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-red-200 bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading === 'refuse' ? <Loader2 size={16} className="animate-spin" /> : <ThumbsDown size={16} />}
          Refuser
        </button>
        <button
          onClick={onApprove}
          disabled={!!loading}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-sm active:scale-95 transition-all disabled:opacity-50"
        >
          {loading === 'approve' ? <Loader2 size={16} className="animate-spin" /> : <ThumbsUp size={16} />}
          Valider
        </button>
      </div>
    </div>
  )
}

// ── ValidationDetailModal — vue complète + édition avant validation ──
function ValidationDetailModal({ devis, artisan, loading, onClose, onSave, onApprove, onRefuse }) {
  const [mode, setMode]       = useState('view') // 'view' | 'edit'
  const [saving, setSaving]   = useState(false)
  const [editError, setEditError] = useState(null)

  const montantHT  = devis.totalHT  ?? devis.montantHT ?? 0
  const montantTTC = devis.totalTTC ?? montantHT
  const createur   = devis.createur
  const nomOuvrier = createur
    ? `${createur.prenom || ''} ${createur.nom || ''}`.trim()
    : 'Ouvrier'
  const descText = devis.prestations?.length
    ? devis.prestations.map((p) => p.description).filter(Boolean).join(' — ')
    : devis.description

  async function handleSave(formData) {
    setSaving(true)
    setEditError(null)
    await onSave(formData)
    setSaving(false)
    setMode('view')
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 backdrop-blur-[2px]"
      onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl w-full max-w-lg max-h-[92vh] flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-base font-bold text-slate-900 truncate">
              {mode === 'edit' ? 'Modifier le devis' : devis.client}
            </h2>
            {mode === 'view' && devis.numero && (
              <span className="text-xs text-slate-400 font-mono flex-shrink-0">{devis.numero}</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {mode === 'view' && (
              <button
                onClick={() => setMode('edit')}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl active:scale-95 transition-all"
              >
                <Pencil size={13} />
                Modifier
              </button>
            )}
            {mode === 'edit' && (
              <button
                onClick={() => { setMode('view'); setEditError(null) }}
                className="text-xs text-slate-500 font-medium px-3 py-1.5"
              >
                Annuler
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Corps scrollable */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {mode === 'view' ? (
            <div className="space-y-4">
              {/* Badge auteur */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-100 px-2.5 py-1 rounded-full">
                  <UserCircle size={12} />
                  Soumis par {nomOuvrier}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                  <Clock size={11} />
                  En attente de validation
                </span>
              </div>

              {/* Client */}
              <div className="bg-slate-50 rounded-xl p-3.5 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Client</p>
                <p className="text-sm font-semibold text-slate-900">{devis.client}</p>
                {devis.clientTelephone && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Phone size={12} />{devis.clientTelephone}
                  </p>
                )}
                {devis.clientEmail && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Mail size={12} />{devis.clientEmail}
                  </p>
                )}
                {devis.clientAdresse && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <MapPin size={12} />{devis.clientAdresse}
                  </p>
                )}
              </div>

              {/* Description / Travaux */}
              {descText && (
                <div className="bg-slate-50 rounded-xl p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Travaux</p>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{descText}</p>
                </div>
              )}

              {/* Montants */}
              <div className="bg-slate-50 rounded-xl p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Montant</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Montant HT</span>
                    <span className="font-medium">{formatCurrency(montantHT)}</span>
                  </div>
                  {devis.totalTVA > 0 && (
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>TVA</span>
                      <span>{formatCurrency(devis.totalTVA)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-slate-900 pt-1 border-t border-slate-200 mt-1">
                    <span>Total TTC</span>
                    <span>{formatCurrency(montantTTC)}</span>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="bg-slate-50 rounded-xl p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Dates</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-slate-400 mb-0.5">Émission</p>
                    <p className="text-sm font-medium text-slate-800">{formatDate(devis.dateEmission || devis.date)}</p>
                  </div>
                  {devis.dateValidite && (
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5">Validité</p>
                      <p className="text-sm font-medium text-slate-800">{formatDate(devis.dateValidite)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Mode édition — DevisForm pré-rempli */
            <div>
              {editError && (
                <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700 mb-3">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}
              <DevisForm
                initialData={devis}
                onSubmit={handleSave}
                onCancel={() => { setMode('view'); setEditError(null) }}
                submitLabel={saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
              />
            </div>
          )}
        </div>

        {/* Footer actions — visible uniquement en mode vue */}
        {mode === 'view' && (
          <div className="flex gap-2 px-5 py-4 border-t border-slate-100 flex-shrink-0">
            <button
              onClick={onRefuse}
              disabled={!!loading}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-red-200 bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading === 'refuse' ? <Loader2 size={16} className="animate-spin" /> : <ThumbsDown size={16} />}
              Refuser
            </button>
            <button
              onClick={onApprove}
              disabled={!!loading}
              className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-sm active:scale-95 transition-all disabled:opacity-50"
            >
              {loading === 'approve' ? <Loader2 size={16} className="animate-spin" /> : <ThumbsUp size={16} />}
              Valider ce devis
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── DevisCard ──────────────────────────────────────────────────────

function DevisCard({ devis, onDuplicate, onStatus, onDownload, onEmail, onSignature }) {
  const [menuOpen, setMenuOpen]         = useState(false)
  const [sending, setSending]           = useState(false)
  const [downloading, setDownloading]   = useState(false)
  const artisan = useMemo(loadParametres, [])

  const montant = devis.totalTTC ?? devis.totalHT ?? devis.montantHT ?? 0
  const isTTC   = devis.totalTTC != null

  async function handleEmail() {
    setSending(true)
    await onEmail()
    setSending(false)
  }

  async function handleDownload() {
    setDownloading(true)
    try { await onDownload() } finally { setDownloading(false) }
  }

  // Badge créateur : affiché uniquement si le devis vient d'un ouvrier
  // (les devis créés par le manager directement n'ont pas de _creator).
  const createur = devis.createur
  const isFromOuvrier = createur && createur.role === 'ouvrier'

  return (
    <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-100">
      {/* Top */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 truncate">{devis.client}</h3>
            {devis.numero && (
              <span className="text-xs text-slate-400 font-mono flex-shrink-0">{devis.numero}</span>
            )}
          </div>
          {isFromOuvrier && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100 mt-1">
              <UserCircle size={10} />
              Émis par {createur.prenom || ''} {createur.nom || ''}
            </span>
          )}
          {(devis.clientTelephone || devis.telephone) && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-400 mt-0.5">
              <Phone size={11} strokeWidth={2} />
              {devis.clientTelephone || devis.telephone}
            </span>
          )}
        </div>
        <Badge statut={devis.statut} />
      </div>

      {/* Description (first prestation or legacy) */}
      <p className="text-sm text-slate-500 line-clamp-2 mb-3">
        {devis.prestations?.length
          ? devis.prestations.map((p) => p.description).filter(Boolean).join(' — ')
          : devis.description}
      </p>

      {/* CTA principale : devis accepté → envoyer le PDF signé au client */}
      {devis.statut === 'accepte' && devis.clientEmail && (
        <button
          onClick={handleEmail}
          disabled={sending}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs border border-emerald-200 mb-3 transition-colors disabled:opacity-60"
        >
          {sending
            ? <><Loader2 size={13} className="animate-spin" />Envoi en cours…</>
            : <><Mail size={13} />Envoyer le devis signé à {devis.clientEmail}</>}
        </button>
      )}

      {/* ── CTA proéminent : envoyer pour signature électronique ──────
          Action clé du devis (convertit en CA). Mise en valeur sur fond
          coloré avec libellé. Masquée si le devis est déjà signé/refusé. */}
      {!['accepte', 'refuse', 'annule', 'en_attente_validation'].includes(devis.statut) && (
        <button
          onClick={onSignature}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm shadow-sm mb-3 active:scale-[0.98] transition-all ${
            devis.tokenUnique
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              : 'bg-gradient-to-r from-violet-600 to-violet-500 text-white hover:from-violet-700 hover:to-violet-600'
          }`}
        >
          <PenLine size={16} strokeWidth={2.5} />
          {devis.tokenUnique
            ? 'Relancer la signature électronique'
            : 'Envoyer pour signature électronique'}
        </button>
      )}

      {/* Bottom */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-base font-bold text-slate-900">{formatCurrency(montant)}</p>
          <p className="text-xs text-slate-400">
            {isTTC ? 'TTC' : 'HT'} · {formatDate(devis.dateEmission || devis.date)}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {/* Partage (WhatsApp, SMS, email, Messenger…) — un seul bouton,
              couvre tous les canaux. Remplace l'ancien bouton email isolé.
              Toujours visible : fallback presse-papiers sur navigateur sans share natif. */}
          <button
            onClick={() => shareDevis(devis, artisan, devis.tokenUnique ? `${window.location.origin}/signer/${devis.tokenUnique}` : null).then(() => haptic.light())}
            title="Partager (WhatsApp, SMS, email…)"
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Share2 size={15} />
          </button>

          {/* PDF download */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            title={devis.statut === 'accepte' ? 'Télécharger PDF signé' : 'Télécharger PDF'}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-blue-50 text-slate-400 hover:text-primary-700 transition-colors disabled:opacity-50"
          >
            {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          </button>

          {/* Verrou : indication visuelle que le devis est inaltérable */}
          <div
            title="Devis verrouillé (CGI art. 286). Utilisez Dupliquer pour créer un devis annule-et-remplace."
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 cursor-help"
          >
            <Lock size={13} />
          </div>

          <button
            onClick={onDuplicate}
            title="Dupliquer (annule et remplace)"
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-blue-50 text-slate-400 hover:text-primary-700 transition-colors"
          >
            <Files size={15} />
          </button>

          {/* Status menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              title="Changer le statut"
              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <MoreVertical size={15} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 bottom-full mb-1 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20 w-44 overflow-hidden">
                  <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                    Changer le statut
                  </p>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => { onStatus(value); setMenuOpen(false) }}
                      className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                        devis.statut === value
                          ? 'bg-slate-50 font-semibold text-primary-900'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

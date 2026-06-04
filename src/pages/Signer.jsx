import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, AlertCircle, Loader2, MapPin } from 'lucide-react'
import SignaturePad from '../components/SignaturePad'
import {
  getDevisParToken,
  getSignatureParToken,
  signerParClient,
  updateStatutDevisSupabase,
  loadArtisanProfilSupabase,
} from '../services/supabase'
import { downloadDevisPdf } from '../utils/devisPdf'

// ── Helpers ───────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—'
  try {
    const [y, m, day] = String(d).replace(/T.*$/, '').split('-')
    return `${day}/${m}/${y}`
  } catch { return String(d) }
}

function fmtMoney(n) {
  const num = Number(n ?? 0)
  const parts = num.toFixed(2).split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return parts.join(',') + ' EUR'
}

// Map Supabase snake_case fields to the camelCase expected by generateDevisPdf.
// La vraie table devis stocke : description + montant_ht + taux_tva (pas de
// prestations[] ni total_ttc) — on reconstruit une prestation unique pour le PDF.
function mapDevisForPdf(d) {
  const montantHT = Number(d.montant_ht ?? 0)
  const tauxTVA   = Number(d.taux_tva   ?? 20)
  const totalTVA  = montantHT * tauxTVA / 100
  const totalTTC  = montantHT + totalTVA

  return {
    ...d,
    numero:             d.numero,
    client:             d.client_nom,
    clientAdresse:      d.client_adresse,
    clientCodePostal:   '',
    clientVille:        '',
    clientTelephone:    d.client_telephone,
    clientEmail:        d.client_email,
    dateEmission:       d.date_emission,
    dateValidite:       d.date_validite,
    description:        d.description,
    totalHT:            montantHT,
    totalTVA:           totalTVA,
    totalTTC:           totalTTC,
    conditionsPaiement: '',
    prestations: [{
      description:    d.description || '',
      quantite:       1,
      prixUnitaireHT: montantHT,
      tauxTVA:        tauxTVA,
    }],
  }
}

// ── Page states ───────────────────────────────────────────────────

const S = {
  loading:      'loading',
  notFound:     'notFound',
  alreadySigned:'alreadySigned',
  ready:        'ready',
  submitting:   'submitting',
  success:      'success',
}

// ── Component ─────────────────────────────────────────────────────

export default function Signer() {
  const { token } = useParams()

  const [state,     setState]     = useState(S.loading)
  const [devis,     setDevis]     = useState(null)
  const [sigRecord, setSigRecord] = useState(null)
  const [artisanSig,setArtisanSig]= useState(null)
  const [artisanInfo,setArtisanInfo]= useState({})
  const [clientSig, setClientSig] = useState(null)
  const [ville,     setVille]     = useState('')
  const [agreed,    setAgreed]    = useState(false)
  const [error,     setError]     = useState(null)

  const today = useMemo(() => new Date().toLocaleDateString('fr-FR'), [])

  // ── Load data ──────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      console.log('[Signer] init() — token:', token)

      const [
        { data: devisData,  error: devisErr  },
        { data: sigData,    error: sigErr    },
        artisanProfile,
      ] = await Promise.all([
        getDevisParToken(token),
        getSignatureParToken(token),
        loadArtisanProfilSupabase(),
      ])

      console.log('[Signer] devisData:', devisData, '| devisErr:', devisErr)
      console.log('[Signer] sigData:', sigData, '| sigErr:', sigErr)
      console.log('[Signer] artisanProfile:', artisanProfile)

      if (!devisData || !sigData) {
        console.warn('[Signer] Devis ou signatures introuvable → notFound')
        setState(S.notFound)
        return
      }

      if (sigData.statut === 'signe') {
        setState(S.alreadySigned)
        setDevis(devisData)
        setSigRecord(sigData)
        return
      }

      setDevis(devisData)
      setSigRecord(sigData)

      // Source 1 : artisan_profil.signature_base64 (la plus à jour)
      // Source 2 : signatures.signature_artisan_base64 (copie faite à l'envoi)
      const fromProfil = artisanProfile?.signature_base64 || null
      const fromRecord = sigData.signature_artisan_base64  || null
      const artSig     = fromProfil || fromRecord || null

      console.log('[Signer] signature_base64 depuis artisan_profil:', fromProfil ? `présente (${fromProfil.length} chars)` : 'absente')
      console.log('[Signer] signature_artisan_base64 depuis signatures:', fromRecord ? `présente (${fromRecord.length} chars)` : 'absente')
      console.log('[Signer] artSig final utilisé pour <img>:', artSig ? `présente (${artSig.length} chars)` : "NULLE — <img> ne s'affichera pas")

      setArtisanSig(artSig)

      // Artisan info (ville, nom, siret…) depuis artisan_profil.donnees_json
      const info = artisanProfile?.donnees_json ?? {}
      console.log('[Signer] artisanInfo.ville:', info.ville)
      setArtisanInfo(info)

      setState(S.ready)
    }
    init()
  }, [token])

  // ── Submit (client signs) ──────────────────────────────────────
  async function handleSubmit() {
    if (!clientSig || !agreed) return
    setState(S.submitting)
    setError(null)

    const { error: e1 } = await signerParClient(token, {
      signatureClientBase64: clientSig,
      ville,
    })
    if (e1) { setError(e1.message); setState(S.ready); return }

    await updateStatutDevisSupabase(token, 'accepte')
    setState(S.success)

    // Generate and immediately download the signed PDF
    try {
      const devisPdf = mapDevisForPdf(devis)
      const signatures = {
        artisan:      artisanSig,
        artisanVille: artisanInfo.ville ?? '',
        client:       clientSig,
        ville,
        signeLe:      new Date().toISOString(),
      }
      downloadDevisPdf(devisPdf, artisanInfo, signatures)
    } catch (_) { /* PDF is best-effort */ }
  }

  // ── Derived data ───────────────────────────────────────────────
  // Le devis dans Supabase stocke description + montant_ht + taux_tva — on
  // synthétise une prestation unique pour l'affichage.
  const prestations = useMemo(() => {
    if (!devis) return []
    return [{
      description:    devis.description || '',
      quantite:       1,
      prixUnitaireHT: Number(devis.montant_ht ?? 0),
      tauxTVA:        Number(devis.taux_tva   ?? 20),
    }]
  }, [devis])

  const montantHT = Number(devis?.montant_ht ?? 0)
  const tauxTVA   = Number(devis?.taux_tva   ?? 20)
  const totalTTC  = montantHT * (1 + tauxTVA / 100)
  const artisanName = artisanInfo.raisonSociale || artisanInfo.nom || 'Artisan'

  // ── States: loading / notFound / alreadySigned / success ──────

  if (state === S.loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary-700" />
      </div>
    )
  }

  if (state === S.notFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 text-center">
        <AlertCircle size={48} className="text-slate-300 mb-4" />
        <h1 className="text-xl font-bold text-slate-800 mb-2">Lien introuvable</h1>
        <p className="text-sm text-slate-500">Ce lien de signature est invalide ou a expiré.</p>
      </div>
    )
  }

  if (state === S.alreadySigned) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 text-center">
        <CheckCircle size={48} className="text-emerald-400 mb-4" />
        <h1 className="text-xl font-bold text-slate-800 mb-2">Devis déjà signé</h1>
        <p className="text-sm text-slate-500">
          Ce devis a été signé le {fmtDate(sigRecord?.signe_le)}.
        </p>
      </div>
    )
  }

  if (state === S.success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
          <CheckCircle size={32} className="text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Merci !</h1>
        <p className="text-sm text-slate-500 mb-1">
          Le devis <strong>{devis?.numero}</strong> a bien été signé.
        </p>
        <p className="text-xs text-slate-400">
          Un exemplaire PDF signé a été téléchargé sur votre appareil.
        </p>
      </div>
    )
  }

  // ── Main view: ready / submitting ─────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-primary-900 text-white px-5 pt-10 pb-6">
        <p className="text-xs text-blue-300 font-semibold uppercase tracking-wide mb-1">Devis à signer</p>
        <h1 className="text-xl font-bold">{artisanName}</h1>
        <p className="text-sm text-blue-200 mt-0.5">
          {devis?.numero} &mdash; émis le {fmtDate(devis?.date_emission)}
        </p>
      </div>

      <div className="px-4 py-5 space-y-4 max-w-lg mx-auto pb-12">

        {/* ── Artisan + client info ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-slate-100">
            <div className="p-4">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Artisan</p>
              <p className="text-sm font-semibold text-slate-800">{artisanName}</p>
              {artisanInfo.adresse && <p className="text-xs text-slate-500 mt-0.5">{artisanInfo.adresse}</p>}
              {(artisanInfo.codePostal || artisanInfo.ville) && (
                <p className="text-xs text-slate-500">
                  {[artisanInfo.codePostal, artisanInfo.ville].filter(Boolean).join(' ')}
                </p>
              )}
              {artisanInfo.siret && (
                <p className="text-xs text-slate-400 mt-1">SIRET : {artisanInfo.siret}</p>
              )}
            </div>
            <div className="p-4">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Client</p>
              <p className="text-sm font-semibold text-slate-800">{devis?.client_nom}</p>
              {devis?.client_adresse && (
                <p className="text-xs text-slate-500 mt-0.5">{devis.client_adresse}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Prestations ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Prestations</p>
          </div>
          <div className="divide-y divide-slate-50">
            {prestations.map((p, i) => {
              const qty   = Number(p.quantite ?? 1)
              const puHT  = Number(p.prixUnitaireHT ?? p.prix_unitaire_ht ?? 0)
              const tva   = p.tauxTVA ?? p.taux_tva ?? 20
              const lineHT = qty * puHT
              return (
                <div key={i} className="px-4 py-3 flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800">{p.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {qty} &times; {fmtMoney(puHT)}
                      {tva ? ` · TVA ${tva} %` : ''}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 flex-shrink-0">{fmtMoney(lineHT)}</p>
                </div>
              )
            })}
          </div>
          <div className="px-4 py-3 border-t border-slate-200 bg-primary-900 rounded-b-2xl flex justify-between items-center">
            <p className="text-sm font-semibold text-blue-200">Total TTC</p>
            <p className="text-lg font-bold text-white">{fmtMoney(totalTTC)}</p>
          </div>
        </div>

        {/* ── Conditions ── */}
        {devis?.conditions_paiement && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
              Conditions de paiement
            </p>
            <p className="text-sm text-amber-800">{devis.conditions_paiement}</p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* Signatures — two columns on the document                   */}
        {/* ══════════════════════════════════════════════════════════ */}

        {/* ── Signature artisan (gauche) — tout est automatique ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Signature de l&rsquo;artisan
            </p>
          </div>
          <div className="px-4 pt-3 pb-4">
            {/* Signature image — <img> fiable, pas de canvas async */}
            {artisanSig ? (
              <div className="rounded-xl border border-slate-200 bg-white flex items-center justify-center p-2" style={{ height: 110 }}>
                <img
                  src={artisanSig}
                  alt="Signature de l'artisan"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 flex items-center justify-center px-4" style={{ height: 110 }}>
                <p className="text-xs text-amber-700 text-center">
                  Veuillez enregistrer votre signature dans les&nbsp;Paramètres
                </p>
              </div>
            )}

            {/* Fait à / le — pré-rempli automatiquement */}
            <div className="mt-3 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
              <span>Fait à </span>
              <strong className="text-slate-800">{artisanInfo.ville || '—'}</strong>
              <span> le </span>
              <strong className="text-slate-800">{today}</strong>
            </div>
          </div>
        </div>

        {/* ── Signature client (droite sur le doc, ici sous) — ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Votre signature — Bon pour accord
            </p>
          </div>
          <div className="px-4 pt-3 pb-4 space-y-4">

            {/* Mention pré-affichée */}
            <div className="px-3 py-2.5 bg-primary-50 border border-primary-100 rounded-xl">
              <p className="text-sm font-semibold text-primary-900">
                Lu et approuvé &mdash; &laquo;&nbsp;Bon pour accord&nbsp;&raquo;
              </p>
              <p className="text-xs text-primary-600 mt-0.5">Date&nbsp;: {today}</p>
            </div>

            {/* Pad de signature */}
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                Signez ici
              </p>
              <SignaturePad onSave={setClientSig} height={130} />
            </div>

            {/* Ville du client */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Fait à (votre ville)
              </label>
              <div className="relative">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  placeholder="Ex : Paris"
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary-700 focus:ring-2 focus:ring-primary-900/10"
                />
              </div>
            </div>

            {/* Checkbox confirmation */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-primary-900 flex-shrink-0"
              />
              <span className="text-sm text-slate-700">
                J&rsquo;ai lu et j&rsquo;approuve ce devis — <strong>« Bon pour accord »</strong>
              </span>
            </label>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Submit ── */}
        <button
          onClick={handleSubmit}
          disabled={!clientSig || !agreed || state === S.submitting}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary-900 text-white font-semibold text-sm shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          {state === S.submitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Validation en cours…
            </>
          ) : (
            <>
              <CheckCircle size={18} />
              Valider et signer le devis
            </>
          )}
        </button>

        <p className="text-xs text-slate-400 text-center">
          En signant, vous acceptez le devis tel que décrit ci-dessus.
          Votre signature sera sauvegardée et jointe au document officiel.
        </p>
      </div>
    </div>
  )
}

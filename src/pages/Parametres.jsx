import { useEffect, useState } from 'react'
import {
  Building2, MapPin, Hash, Shield, PenLine,
  Save, CheckCircle, AlertCircle, ChevronDown, Loader2,
  Database, Copy, Check as CheckIcon, Image as ImageIcon, Upload, Trash2,
  LogOut, Eraser,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { loadParametres, saveParametres } from '../services/parametres'
import { saveArtisanProfilSupabase, testSupabaseConnection } from '../services/supabase'
import { signOut } from '../services/auth'
import { ensureManagerEntreprise } from '../services/entrepriseService'
import { useAuth } from '../contexts/AuthContext'
import SignaturePad from '../components/SignaturePad'
import Modal from '../components/Modal'

const SETUP_SQL = `-- Étape 1 : Créer les tables (si pas encore fait)
CREATE TABLE IF NOT EXISTS artisan_profil (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom              text,
  siret            text,
  adresse          text,
  email            text,
  telephone        text,
  signature_base64 text,
  donnees_json     jsonb,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS devis (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  numero              text,
  client_nom          text,
  client_email        text,
  client_telephone    text,
  client_adresse      text,
  date_emission       date,
  date_validite       date,
  prestations         jsonb,
  total_ht            numeric,
  total_tva           numeric,
  total_ttc           numeric,
  conditions_paiement text,
  statut              text DEFAULT 'envoye',
  token_unique        text UNIQUE,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS signatures (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  devis_id                 uuid REFERENCES devis(id) ON DELETE CASCADE,
  token                    text UNIQUE,
  signature_artisan_base64 text,
  signature_client_base64  text,
  signe_le                 timestamptz,
  ville                    text,
  statut                   text DEFAULT 'en_attente',
  created_at               timestamptz DEFAULT now()
);

-- Étape 2 : Donner les droits INSERT/UPDATE/DELETE au rôle anon
GRANT ALL ON TABLE artisan_profil TO anon;
GRANT ALL ON TABLE devis TO anon;
GRANT ALL ON TABLE signatures TO anon;

-- Étape 3 : Activer RLS + créer les politiques
ALTER TABLE artisan_profil ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON artisan_profil FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON devis FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON signatures FOR ALL TO anon USING (true) WITH CHECK (true);

-- Étape 4 : Recharger le cache PostgREST (OBLIGATOIRE)
NOTIFY pgrst, 'reload schema';`

const FORMES_JURIDIQUES = [
  'Auto-entrepreneur',
  'Entreprise individuelle',
  'EIRL',
  'SARL',
  'EURL',
  'SAS',
  'SASU',
  'SA',
  'Autre',
]

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden mb-4">
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-slate-100 bg-slate-50">
        <div className="w-7 h-7 rounded-lg bg-primary-900 flex items-center justify-center flex-shrink-0">
          <Icon size={14} className="text-white" strokeWidth={2.5} />
        </div>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="px-4 py-4 space-y-3.5">{children}</div>
    </div>
  )
}

function Field({ label, error, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
      {hint  && !error && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white outline-none transition-colors focus:border-primary-700 focus:ring-2 focus:ring-primary-900/10'
const gridCls  = 'grid grid-cols-2 gap-3'

export default function Parametres() {
  const navigate = useNavigate()
  const { user, entreprise, refresh } = useAuth()
  const [form, setForm] = useState(loadParametres)
  const [saved, setSaved] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [errors, setErrors] = useState({})
  const [dbTesting, setDbTesting]     = useState(false)
  const [dbStatus,  setDbStatus]      = useState(null)   // null | 'ok' | 'error'
  const [sqlCopied, setSqlCopied]     = useState(false)
  const [showSetup, setShowSetup]     = useState(false)
  const [autoRepaired, setAutoRepaired] = useState(false)

  // Auto-réparation silencieuse : si l'utilisateur connecté n'a pas
  // d'entreprise liée, on la crée. Cela débloque l'invitation d'ouvriers
  // et toutes les requêtes RLS qui dépendent de current_entreprise_id().
  useEffect(() => {
    if (!user) return
    if (entreprise?.id) return
    let cancelled = false
    ;(async () => {
      const { entreprise: ent, repaired } = await ensureManagerEntreprise(user, {
        nom:       form.raisonSociale || form.nom || 'Mon entreprise',
        email:     form.email || user.email,
        telephone: form.telephone,
        prenom:    form.nom ? form.nom.split(' ')[0] : null,
      })
      if (cancelled) return
      if (repaired && ent) {
        setAutoRepaired(true)
        refresh()   // recharge le contexte global
        setTimeout(() => setAutoRepaired(false), 4000)
      }
    })()
    return () => { cancelled = true }
    // On dépend uniquement de user/entreprise pour ne pas retomber dans une boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, entreprise?.id])

  const [logoutOpen,  setLogoutOpen]  = useState(false)
  const [loggingOut,  setLoggingOut]  = useState(false)
  const [logoutErr,   setLogoutErr]   = useState(null)
  const [resetOpen,   setResetOpen]   = useState(false)
  const [resetting,   setResetting]   = useState(false)

  // Vide les données locales (devis + chantiers legacy + flag de migration).
  // Les données Supabase ne sont PAS touchées — voir le SQL fourni séparément.
  function handleResetLocal() {
    setResetting(true)
    try {
      localStorage.removeItem('artisanpro_devis')
      localStorage.removeItem('artisanpro_chantiers')
      localStorage.removeItem('chantiers_migrated_to_supabase_v1')
    } finally {
      setResetting(false)
      setResetOpen(false)
      // Hard reload pour que toutes les pages re-fetch
      window.location.reload()
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    setLogoutErr(null)
    const { error } = await signOut()
    setLoggingOut(false)
    if (error) {
      setLogoutErr(error.message || 'Erreur lors de la déconnexion')
      return
    }
    navigate('/login', { replace: true })
  }

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
    setSaved(false)
  }

  function validate() {
    const e = {}
    if (!form.nom?.trim() && !form.raisonSociale?.trim()) {
      e.nom = 'Nom ou raison sociale requis'
    }
    return e
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    saveParametres(form)
    setSyncing(true)

    // 1) Legacy : sauve dans artisan_profil
    await saveArtisanProfilSupabase(form).catch(() => null)

    // 2) Assure que l'utilisateur a bien un lien entreprise dans utilisateurs.
    //    Si déjà OK, ne fait rien. Sinon, crée/lie automatiquement.
    if (user) {
      await ensureManagerEntreprise(user, {
        nom:       form.raisonSociale || form.nom || 'Mon entreprise',
        email:     form.email || user.email,
        telephone: form.telephone,
      }).catch(() => null)
      refresh()
    }

    setSyncing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleTestDb() {
    setDbTesting(true)
    setDbStatus(null)
    const ok = await testSupabaseConnection()
    setDbTesting(false)
    setDbStatus(ok ? 'ok' : 'error')
  }

  function handleCopySql() {
    navigator.clipboard.writeText(SETUP_SQL).then(() => {
      setSqlCopied(true)
      setTimeout(() => setSqlCopied(false), 2500)
    })
  }

  async function handleLogoFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''   // permet de re-sélectionner le même fichier après suppression
    if (!file) return
    if (file.size > 1_500_000) {
      alert('Image trop volumineuse — 1,5 Mo maximum.')
      return
    }
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    saveLogo(base64)
  }

  function saveLogo(base64OrNull) {
    const updated = { ...form, logoArtisan: base64OrNull }
    setForm(updated)
    saveParametres(updated)
  }

  async function handleSignatureSaved(base64) {
    const updated = { ...form, signatureArtisan: base64 }
    setForm(updated)
    saveParametres(updated)
    // Sync immediately so Supabase always has the latest signature
    // (don't wait for the main "Enregistrer" button)
    await saveArtisanProfilSupabase(updated).catch(() => null)
  }

  const isAutoEntrepreneur = form.formeJuridique === 'Auto-entrepreneur'

  return (
    <div className="px-4 pt-12 pb-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary-900">Paramètres</h1>
        <p className="text-sm text-slate-500 mt-0.5">Informations utilisées dans vos devis PDF</p>
      </div>

      {/* Auto-repair confirmation */}
      {autoRepaired && (
        <div className="flex gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 text-sm text-emerald-800">
          <CheckCircle size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
          <span>Profil entreprise reconnecté. L'invitation d'ouvriers est maintenant disponible.</span>
        </div>
      )}

      {/* Banner: incomplete settings warning */}
      {(!form.siret || (!form.nom && !form.raisonSociale)) && !saved && (
        <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm text-amber-800">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <span>Renseignez vos informations pour générer des devis conformes.</span>
        </div>
      )}

      {/* Section: Identité */}
      <Section icon={Building2} title="Identité de l'entreprise">
        <Field label="Raison sociale" error={errors.raisonSociale}>
          <input
            type="text"
            value={form.raisonSociale}
            onChange={(e) => set('raisonSociale', e.target.value)}
            placeholder="Ex : Dupont Plomberie"
            className={inputCls}
          />
        </Field>

        <Field label="Nom du gérant" error={errors.nom}>
          <input
            type="text"
            value={form.nom}
            onChange={(e) => set('nom', e.target.value)}
            placeholder="Ex : Jean Dupont"
            className={inputCls}
          />
        </Field>

        <Field label="Forme juridique">
          <div className="relative">
            <select
              value={form.formeJuridique}
              onChange={(e) => set('formeJuridique', e.target.value)}
              className={`${inputCls} appearance-none pr-9`}
            >
              {FORMES_JURIDIQUES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </Field>
      </Section>

      {/* Section: Coordonnées */}
      <Section icon={MapPin} title="Coordonnées">
        <Field label="Adresse">
          <input
            type="text"
            value={form.adresse}
            onChange={(e) => set('adresse', e.target.value)}
            placeholder="12 rue des Artisans"
            className={inputCls}
          />
        </Field>

        <div className={gridCls}>
          <Field label="Code postal">
            <input
              type="text"
              value={form.codePostal}
              onChange={(e) => set('codePostal', e.target.value)}
              placeholder="75001"
              maxLength={5}
              className={inputCls}
            />
          </Field>
          <Field label="Ville">
            <input
              type="text"
              value={form.ville}
              onChange={(e) => set('ville', e.target.value)}
              placeholder="Paris"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Téléphone">
          <input
            type="tel"
            value={form.telephone}
            onChange={(e) => set('telephone', e.target.value)}
            placeholder="06 12 34 56 78"
            className={inputCls}
          />
        </Field>

        <Field label="Email professionnel">
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="contact@dupont-plomberie.fr"
            className={inputCls}
          />
        </Field>
      </Section>

      {/* Section: Informations fiscales */}
      <Section icon={Hash} title="Informations fiscales">
        <Field
          label="Numéro SIRET *"
          error={errors.siret}
          hint="14 chiffres — identifiant obligatoire sur tout devis"
        >
          <input
            type="text"
            value={form.siret}
            onChange={(e) => set('siret', e.target.value.replace(/\s/g, ''))}
            placeholder="12345678901234"
            maxLength={14}
            className={inputCls}
          />
        </Field>

        <Field
          label="N° TVA intracommunautaire"
          hint={isAutoEntrepreneur ? 'Non applicable pour les auto-entrepreneurs' : 'Ex : FR 12 345678901'}
        >
          <input
            type="text"
            value={form.tvaIntracom}
            onChange={(e) => set('tvaIntracom', e.target.value)}
            placeholder={isAutoEntrepreneur ? 'Non applicable' : 'FR 12 345678901'}
            disabled={isAutoEntrepreneur && !form.tvaIntracom}
            className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`}
          />
        </Field>

        {/* TVA toggle */}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-medium text-slate-800">Assujetti à la TVA</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {form.mentionTVA
                ? 'TVA facturée sur vos devis (20 % par défaut)'
                : 'Mention « TVA non applicable, art. 293B CGI » sur vos devis'}
            </p>
          </div>
          <button
            onClick={() => set('mentionTVA', !form.mentionTVA)}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
              form.mentionTVA ? 'bg-primary-900' : 'bg-slate-200'
            }`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              form.mentionTVA ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
      </Section>

      {/* Section: Assurances BTP — mentions légales obligatoires */}
      <Section icon={Shield} title="Assurances & mentions légales">
        <Field
          label="Assurance décennale *"
          hint="Obligatoire pour les travaux de bâtiment — sera mentionnée sur tous vos devis"
        >
          <input
            type="text"
            value={form.assuranceDecennale}
            onChange={(e) => set('assuranceDecennale', e.target.value)}
            placeholder="Ex : MAAF Pro – Contrat n° 1234567890"
            className={inputCls}
          />
        </Field>

        <Field label="Zone de couverture décennale" hint="Zone géographique couverte par l'assurance">
          <input
            type="text"
            value={form.zoneCouvertureDecennale}
            onChange={(e) => set('zoneCouvertureDecennale', e.target.value)}
            placeholder="France métropolitaine"
            className={inputCls}
          />
        </Field>

        <Field label="Assurance RC Pro" hint="Recommandé">
          <input
            type="text"
            value={form.assuranceRCPro}
            onChange={(e) => set('assuranceRCPro', e.target.value)}
            placeholder="Assureur – N° police"
            className={inputCls}
          />
        </Field>

        <Field
          label="Médiateur de la consommation"
          hint="Obligatoire (art. L612-1 C. conso) — pour les litiges avec particuliers"
        >
          <input
            type="text"
            value={form.mediateurConso}
            onChange={(e) => set('mediateurConso', e.target.value)}
            placeholder="Ex : CM2C – www.cm2c.net"
            className={inputCls}
          />
        </Field>

        <Field
          label="Conditions générales de vente"
          hint="Reprises automatiquement en bas de chaque devis"
        >
          <textarea
            value={form.cgv}
            onChange={(e) => set('cgv', e.target.value)}
            rows={5}
            className={`${inputCls} resize-none text-xs leading-relaxed`}
          />
        </Field>

        <Field
          label="Conditions de paiement par défaut"
          hint="Pré-rempli sur chaque nouveau devis"
        >
          <textarea
            value={form.conditionsPaiementDefaut}
            onChange={(e) => set('conditionsPaiementDefaut', e.target.value)}
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </Field>
      </Section>

      {/* Section: Logo */}
      <Section icon={ImageIcon} title="Logo de l'entreprise">
        <p className="text-xs text-slate-500 -mt-1 mb-3">
          Apparaîtra en haut à gauche de vos devis PDF.
        </p>

        {form.logoArtisan ? (
          <div className="space-y-2">
            <div className="rounded-xl border border-emerald-200 bg-white p-3 flex items-center justify-center" style={{ height: 130 }}>
              <img
                src={form.logoArtisan}
                alt="Logo de l'entreprise"
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="flex gap-3">
              <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
                <Upload size={13} />
                Remplacer
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={handleLogoFile}
                />
              </label>
              <button
                type="button"
                onClick={() => saveLogo(null)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-red-100 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={13} />
                Supprimer
              </button>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center cursor-pointer rounded-xl border-2 border-dashed border-slate-200 hover:border-primary-700 bg-slate-50 hover:bg-white py-6 transition-colors">
            <Upload size={20} className="text-slate-400 mb-2" />
            <span className="text-sm text-slate-600 font-medium">Choisir un fichier</span>
            <span className="text-xs text-slate-400 mt-1">PNG, JPG, SVG ou WebP · 1,5 Mo max</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleLogoFile}
            />
          </label>
        )}
      </Section>

      {/* Section: Signature */}
      <Section icon={PenLine} title="Votre signature">
        <p className="text-xs text-slate-500 -mt-1 mb-3">
          Signez une fois ici — elle sera intégrée automatiquement dans vos devis envoyés pour accord.
        </p>

        {/* Aperçu de la signature sauvegardée */}
        {form.signatureArtisan ? (
          <div className="mb-3">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1.5">
              Signature enregistrée
            </p>
            <div className="rounded-xl border border-emerald-200 bg-white p-2 flex items-center justify-center" style={{ height: 100 }}>
              <img
                src={form.signatureArtisan}
                alt="Signature artisan"
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <button
              type="button"
              onClick={() => handleSignatureSaved(null)}
              className="text-xs text-red-400 hover:text-red-600 mt-1.5 transition-colors"
            >
              Effacer et redessiner
            </button>
          </div>
        ) : (
          <div className="mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Dessinez votre signature
            </p>
            <SignaturePad
              onSave={handleSignatureSaved}
              height={130}
            />
          </div>
        )}
      </Section>

      {/* Section: Base de données */}
      <Section icon={Database} title="Base de données">
        <p className="text-xs text-slate-500 -mt-1">
          Vérifiez que les tables Supabase sont correctement configurées pour la signature électronique.
        </p>

        <div className="flex gap-2">
          <button
            onClick={handleTestDb}
            disabled={dbTesting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            {dbTesting
              ? <Loader2 size={14} className="animate-spin" />
              : <Database size={14} />}
            Tester la connexion
          </button>
          <button
            onClick={() => setShowSetup((v) => !v)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {showSetup ? 'Masquer le SQL' : 'Voir le SQL de setup'}
          </button>
        </div>

        {dbStatus === 'ok' && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
            <CheckCircle size={15} />
            Toutes les tables sont accessibles
          </div>
        )}
        {dbStatus === 'error' && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span>Une ou plusieurs tables sont inaccessibles. Exécutez le SQL ci-dessous dans l&rsquo;éditeur SQL Supabase.</span>
            </div>
            {!showSetup && (
              <button
                onClick={() => setShowSetup(true)}
                className="text-xs text-primary-700 font-semibold underline"
              >
                Afficher le SQL à exécuter
              </button>
            )}
          </div>
        )}

        {showSetup && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-600">
                Copiez ce SQL dans l&rsquo;éditeur SQL de votre projet Supabase :
              </p>
              <button
                onClick={handleCopySql}
                className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-900 transition-colors"
              >
                {sqlCopied ? <CheckIcon size={12} /> : <Copy size={12} />}
                {sqlCopied ? 'Copié !' : 'Copier'}
              </button>
            </div>
            <pre className="text-[10px] bg-slate-900 text-slate-100 rounded-xl px-3 py-3 overflow-x-auto leading-relaxed select-all">
              {SETUP_SQL}
            </pre>
            <p className="text-xs text-slate-400">
              Lien : <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary-700 underline">supabase.com/dashboard</a> → votre projet → SQL Editor → New query → coller → Run
            </p>
          </div>
        )}
      </Section>

      {/* Section : Réinitialisation locale */}
      <Section icon={Eraser} title="Données locales">
        <p className="text-xs text-slate-500 -mt-1">
          Supprime les devis et chantiers stockés localement sur cet appareil (ne touche pas vos données Supabase).
          Utile pour redémarrer à zéro côté navigateur.
        </p>
        <button
          onClick={() => setResetOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-sm transition-colors"
        >
          <Eraser size={14} />
          Vider les données locales (devis + chantiers)
        </button>
      </Section>

      {/* Modal confirmation reset local */}
      <Modal isOpen={resetOpen} onClose={() => setResetOpen(false)} title="Vider les données locales ?">
        <p className="text-sm text-slate-600 mb-2">
          Cela va supprimer de votre navigateur :
        </p>
        <ul className="text-xs text-slate-600 list-disc pl-5 space-y-1 mb-4">
          <li>Vos devis stockés localement (legacy)</li>
          <li>Vos chantiers stockés localement (legacy)</li>
          <li>Le flag de migration localStorage → Supabase</li>
        </ul>
        <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800 mb-4">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          <span>
            <strong>Ne touche pas à Supabase</strong> — vos données sur le serveur restent intactes.
            Pour vider Supabase, utilisez le SQL fourni dans l'éditeur Supabase.
          </span>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setResetOpen(false)} disabled={resetting}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors disabled:opacity-60">
            Annuler
          </button>
          <button onClick={handleResetLocal} disabled={resetting}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors disabled:opacity-60">
            {resetting ? <Loader2 size={15} className="animate-spin" /> : <Eraser size={14} />}
            Vider et recharger
          </button>
        </div>
      </Modal>

      {/* Section : Compte & déconnexion */}
      {user && (
        <Section icon={LogOut} title="Compte">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-800 to-primary-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">
                {(user.email?.[0] || '?').toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{user.email}</p>
              {entreprise?.nom && (
                <p className="text-xs text-slate-500 truncate">{entreprise.nom}</p>
              )}
              <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold uppercase tracking-wide bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded-full">
                Manager
              </span>
            </div>
          </div>

          <button
            onClick={() => setLogoutOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-sm border border-red-100 transition-colors mt-2"
          >
            <LogOut size={15} />
            Se déconnecter
          </button>

          <p className="text-[10px] text-slate-400 text-center -mt-1">
            Votre session reste active tant que vous ne vous déconnectez pas manuellement.
          </p>
        </Section>
      )}

      {/* Modal de confirmation déconnexion */}
      <Modal isOpen={logoutOpen} onClose={() => setLogoutOpen(false)} title="Confirmer la déconnexion">
        <p className="text-sm text-slate-600 mb-4">
          Vous serez redirigé vers l'écran de connexion. Vos données restent sauvegardées —
          vous pourrez vous reconnecter à tout moment avec votre email et mot de passe.
        </p>
        {logoutErr && (
          <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700 mb-3">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{logoutErr}</span>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={() => setLogoutOpen(false)} disabled={loggingOut}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors disabled:opacity-60">
            Annuler
          </button>
          <button onClick={handleLogout} disabled={loggingOut}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors disabled:opacity-60">
            {loggingOut ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={14} />}
            Déconnecter
          </button>
        </div>
      </Modal>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={syncing}
        className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all shadow-sm disabled:opacity-70 ${
          saved
            ? 'bg-emerald-500 text-white'
            : 'bg-accent-500 hover:bg-accent-600 text-white'
        }`}
      >
        {syncing ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Synchronisation…
          </>
        ) : saved ? (
          <>
            <CheckCircle size={18} />
            Paramètres enregistrés !
          </>
        ) : (
          <>
            <Save size={18} />
            Enregistrer les paramètres
          </>
        )}
      </button>

      <p className="text-xs text-slate-400 text-center mt-3">
        Ces informations sont stockées sur votre appareil et synchronisées en ligne.
      </p>
    </div>
  )
}


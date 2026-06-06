/**
 * Supabase service — toutes les opérations DB.
 *
 * ═══════════════════════════════════════════════════════════════════
 * SQL À EXÉCUTER UNE FOIS dans l'éditeur SQL Supabase :
 * ═══════════════════════════════════════════════════════════════════
 *
 * -- 1. Table artisan_profil
 * CREATE TABLE IF NOT EXISTS artisan_profil (
 *   id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   nom              text,
 *   adresse          text,
 *   ville            text,
 *   telephone        text,
 *   email            text,
 *   siret            text,
 *   tva              text,
 *   forme_juridique  text,
 *   signature_base64 text,
 *   created_at       timestamptz DEFAULT now()
 * );
 *
 * -- 2. Table devis (colonne client_nom — pas de prestations / total_ttc séparés)
 * CREATE TABLE IF NOT EXISTS devis (
 *   id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   numero           text,
 *   client_nom       text,
 *   client_telephone text,
 *   client_email     text,
 *   client_adresse   text,
 *   description      text,
 *   montant_ht       numeric,
 *   taux_tva         numeric DEFAULT 20,
 *   statut           text DEFAULT 'Envoyé',
 *   token_unique     text UNIQUE,
 *   date_emission    date,
 *   date_validite    date,
 *   created_at       timestamptz DEFAULT now()
 * );
 *
 * -- 3. Table signatures (pas de signature_artisan_base64 — lue depuis artisan_profil)
 * CREATE TABLE IF NOT EXISTS signatures (
 *   id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   devis_id                uuid REFERENCES devis(id) ON DELETE CASCADE,
 *   token                   text UNIQUE,
 *   signature_client_base64 text,
 *   ville_client            text,
 *   signe_le                timestamptz,
 *   statut                  text DEFAULT 'en_attente',
 *   created_at              timestamptz DEFAULT now()
 * );
 *
 * -- 4. GRANT : donner au rôle anon les droits INSERT/UPDATE/DELETE
 * --    (Supabase accorde SELECT par défaut, mais pas INSERT — sans ce GRANT
 * --    les insertions échouent même avec une politique RLS permissive)
 * GRANT ALL ON TABLE artisan_profil TO anon;
 * GRANT ALL ON TABLE devis          TO anon;
 * GRANT ALL ON TABLE signatures     TO anon;
 *
 * -- 5. RLS : accès anon complet (app mono-artisan sans auth)
 * ALTER TABLE artisan_profil ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE devis          ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE signatures     ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "anon_all" ON artisan_profil FOR ALL TO anon USING (true) WITH CHECK (true);
 * CREATE POLICY "anon_all" ON devis          FOR ALL TO anon USING (true) WITH CHECK (true);
 * CREATE POLICY "anon_all" ON signatures     FOR ALL TO anon USING (true) WITH CHECK (true);
 *
 * -- 6. OBLIGATOIRE après création des tables : forcer PostgREST à recharger
 * --    son cache de schéma, sinon l'erreur "Could not find the table in the
 * --    schema cache" persiste même si les tables existent.
 * NOTIFY pgrst, 'reload schema';
 * ═══════════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js'

// Client Supabase — credentials en dur, version 2.39.0 exactement.
// Utilisé en named import  : import { supabase } from '...'
// Utilisé en default import: import supabase from '...'
// Options explicites : auto-refresh + persistence localStorage pour éviter
// les déconnexions automatiques quand l'utilisateur garde l'app ouverte
// longtemps ou la met en arrière-plan.
const supabase = createClient(
  'https://zptxycatjuhjhjpsctot.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwdHh5Y2F0anVoamhqcHNjdG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDgyNDEsImV4cCI6MjA5NDI4NDI0MX0.r38Zuz-BbI9OD2tzYfc1rA0uI8xVK1wxIRJwBb6qBr8',
  {
    auth: {
      autoRefreshToken:   true,                  // renouvelle automatiquement le JWT avant expiration
      persistSession:     true,                  // session conservée entre les onglets/redémarrages
      storage:            window.localStorage,   // explicite : localStorage (pas sessionStorage)
      storageKey:         'artisanpro-auth',     // namespacée pour éviter les collisions
      detectSessionInUrl: true,                  // pour OAuth/magic links
      flowType:           'pkce',                // sécurité accrue côté navigateur
    },
  }
)

export { supabase }          // named export  — import { supabase }
export default supabase      // default export — import supabase

export const SIGNING_BASE_URL = `${window.location.origin}/signer`

const PROFILE_ID_KEY = 'artisanpro_supabase_profile_id'

// ─── Diagnostic de connexion ─────────────────────────────────────
// Appelée au démarrage (main.jsx). Vérifie que les 3 tables sont
// accessibles via l'API Supabase. Si une table échoue avec
// "schema cache" → exécuter dans l'éditeur SQL Supabase :
//   NOTIFY pgrst, 'reload schema';
export async function testSupabaseConnection() {
  const tables = ['artisan_profil', 'devis', 'signatures']
  const results = {}

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .select('count', { count: 'exact', head: true })
    results[table] = error ? `❌ ${error.message}` : '✅ OK'
  }

  console.group('[Supabase] Test de connexion au démarrage')
  console.log('URL     :', 'https://zptxycatjuhjhjpsctot.supabase.co')
  for (const [table, status] of Object.entries(results)) {
    console.log(`Table ${table.padEnd(16)}: ${status}`)
  }
  const allOk = Object.values(results).every((s) => s.startsWith('✅'))
  if (!allOk) {
    console.error(
      '[Supabase] ⚠️  Une ou plusieurs tables sont inaccessibles.\n' +
      'Solution : ouvrir l\'éditeur SQL Supabase et exécuter :\n' +
      '  NOTIFY pgrst, \'reload schema\';\n' +
      'Ensuite recharger la page.'
    )
  }
  console.groupEnd()
  return allOk
}

// ═══════════════════════════════════════════════════════════════════
// SCHÉMA RÉEL des tables (vérifié via l'API REST Supabase) :
//
// artisan_profil : id, nom, adresse, ville, telephone, email, siret, tva,
//                  forme_juridique, signature_base64, created_at
// devis          : id, numero, client_nom, client_telephone, client_email,
//                  client_adresse, description, montant_ht, taux_tva, statut,
//                  token_unique, date_emission, date_validite, created_at
// signatures     : id, devis_id, token, signature_client_base64, ville_client,
//                  signe_le, statut, created_at
//
// IMPORTANT : la table signatures n'a PAS de colonne signature_artisan_base64.
// La signature de l'artisan est lue à la demande depuis artisan_profil.
// La table devis n'a pas de prestations JSONB ni de total_ttc/tva séparés —
// on stocke uniquement description + montant_ht + taux_tva.
// ═══════════════════════════════════════════════════════════════════

// ─── artisan_profil ──────────────────────────────────────────────

function profilPayloadFromForm(form) {
  // Champs indexés dans des colonnes dédiées (rapide à requêter)
  const indexed = {
    nom:              form.raisonSociale || form.nom || '',
    adresse:          [form.adresse, form.codePostal].filter(Boolean).join(' '),
    ville:            form.ville || '',
    telephone:        form.telephone || '',
    email:            form.email || '',
    siret:            form.siret || '',
    tva:              form.tvaIntracom || '',
    forme_juridique:  form.formeJuridique || '',
    signature_base64: form.signatureArtisan || null,
  }

  // donnees_json = TOUS les paramètres (y compris assurance, CGV, logo…)
  // C'est la source de vérité pour synchroniser entre appareils.
  const { signatureArtisan, ...restForJson } = form
  const donnees_json = {
    ...restForJson,
    signatureArtisan: form.signatureArtisan || null,
  }

  return { ...indexed, donnees_json }
}

export async function saveArtisanProfilSupabase(localParams) {
  const payload = profilPayloadFromForm(localParams)
  const id = localStorage.getItem(PROFILE_ID_KEY)

  if (id) {
    const { error } = await supabase
      .from('artisan_profil')
      .update(payload)
      .eq('id', id)
    if (error) console.error('[saveArtisanProfilSupabase] UPDATE error:', error.message)
    return { error }
  }

  const { data, error } = await supabase
    .from('artisan_profil')
    .insert(payload)
    .select('id')
    .single()

  if (error) console.error('[saveArtisanProfilSupabase] INSERT error:', error.message)
  if (data?.id) localStorage.setItem(PROFILE_ID_KEY, data.id)
  return { error }
}

export async function loadArtisanSignatureSupabase() {
  const id = localStorage.getItem(PROFILE_ID_KEY)
  if (!id) return null
  const { data } = await supabase
    .from('artisan_profil')
    .select('signature_base64')
    .eq('id', id)
    .single()
  return data?.signature_base64 ?? null
}

// Fetch the most-recent artisan profile without requiring localStorage.
// Used on the public signing page where the client has no local state.
// Returns a shape compatible with the previous { donnees_json, signature_base64 }
// even though the real table stores fields separately.
export async function loadArtisanProfilSupabase() {
  const { data, error } = await supabase
    .from('artisan_profil')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[Supabase] loadArtisanProfilSupabase — erreur:', error.message)
    return null
  }
  if (!data) {
    console.log('[Supabase] loadArtisanProfilSupabase — aucun profil')
    return null
  }
  // donnees_json contient TOUS les paramètres sauvegardés depuis v2.
  // On le fusionne avec les colonnes indexées pour garantir la cohérence.
  const fromJson = data.donnees_json || {}
  return {
    signature_base64: data.signature_base64,
    donnees_json: {
      // Priorité : données JSON complètes (version la plus récente et complète)
      ...fromJson,
      // Colonnes indexées en override pour cohérence avec la DB
      nom:              data.nom              || fromJson.nom || fromJson.raisonSociale || '',
      raisonSociale:    data.nom              || fromJson.raisonSociale || '',
      adresse:          data.adresse          || fromJson.adresse || '',
      ville:            data.ville            || fromJson.ville || '',
      telephone:        data.telephone        || fromJson.telephone || '',
      email:            data.email            || fromJson.email || '',
      siret:            data.siret            || fromJson.siret || '',
      tvaIntracom:      data.tva              || fromJson.tvaIntracom || '',
      formeJuridique:   data.forme_juridique  || fromJson.formeJuridique || '',
      signatureArtisan: data.signature_base64 || fromJson.signatureArtisan || null,
    },
  }
}

// ─── Page de signature publique (via RPC sécurisées) ──────────────
// Le client n'est pas authentifié : il accède UNIQUEMENT via ces RPC
// SECURITY DEFINER scopées au token, jamais en accès direct aux tables.

// Charge devis + signature + artisan pour un token. Repli sur l'accès
// direct si la RPC n'existe pas encore (avant exécution de la migration).
export async function getSignatureContext(token) {
  const { data, error } = await supabase.rpc('get_signature_context', { p_token: token })
  if (!error && data) {
    return {
      devis:     data.devis || null,
      signature: data.signature || null,
      artisan:   data.artisan || null,
    }
  }
  // Repli (ancien chemin direct) — fonctionne tant que la migration n'est pas faite
  const [{ data: devis }, { data: signature }, artisan] = await Promise.all([
    getDevisParToken(token),
    getSignatureParToken(token),
    loadArtisanProfilSupabase(),
  ])
  return {
    devis,
    signature,
    artisan: artisan
      ? { signature_base64: artisan.signature_base64, donnees_json: artisan.donnees_json }
      : null,
  }
}

// Signe le devis (client). Repli sur l'ancien chemin si la RPC est absente.
export async function signDevisPublic(token, { signatureClientBase64, ville }) {
  const { data, error } = await supabase.rpc('sign_devis', {
    p_token: token, p_signature: signatureClientBase64, p_ville: ville,
  })
  if (!error && data?.ok) return { error: null }
  if (!error && data && data.ok === false) {
    return { error: { message: 'Lien invalide ou devis déjà signé.' } }
  }
  // Repli (ancien chemin direct)
  const { error: e1 } = await signerParClient(token, { signatureClientBase64, ville })
  if (e1) return { error: e1 }
  await updateStatutDevisSupabase(token, 'accepte')
  return { error: null }
}

// ─── devis ───────────────────────────────────────────────────────

export async function getDevisParToken(token) {
  const { data, error } = await supabase
    .from('devis')
    .select('*')
    .eq('token_unique', token)
    .single()
  return { data, error }
}

export async function creerDevisSupabase(devis, token) {
  // Résumer les prestations en une seule description texte
  let description = devis.description || ''
  if (Array.isArray(devis.prestations) && devis.prestations.length) {
    description = devis.prestations
      .map((p) => p.description)
      .filter(Boolean)
      .join(' / ')
  }

  // Montant HT total : valeur explicite OU somme des prestations
  let montant_ht = Number(devis.totalHT ?? devis.montantHT ?? 0)
  if (!montant_ht && Array.isArray(devis.prestations)) {
    montant_ht = devis.prestations.reduce((sum, p) => {
      const qty = Number(p.quantite ?? 1)
      const pu  = Number(p.prixUnitaireHT ?? 0)
      return sum + qty * pu
    }, 0)
  }

  // Taux TVA : devis.tauxTVA, ou celui de la première prestation, ou 20 par défaut
  const taux_tva = Number(
    devis.tauxTVA ?? devis.prestations?.[0]?.tauxTVA ?? 20
  )

  const adresseComplete = [
    devis.clientAdresse,
    devis.clientCodePostal,
    devis.clientVille,
  ].filter(Boolean).join(', ')

  const payload = {
    numero:           devis.numero || '',
    client_nom:       devis.client || '',
    client_email:     devis.clientEmail || '',
    client_telephone: devis.clientTelephone || devis.telephone || '',
    client_adresse:   adresseComplete,
    description,
    montant_ht,
    taux_tva,
    date_emission:    devis.dateEmission || devis.date || null,
    date_validite:    devis.dateValidite || null,
    token_unique:     token,
  }

  console.log('[creerDevisSupabase] INSERT payload:', {
    numero:       payload.numero,
    client_nom:   payload.client_nom,
    montant_ht:   payload.montant_ht,
    taux_tva:     payload.taux_tva,
    token_unique: payload.token_unique,
  })

  const { data, error } = await supabase
    .from('devis')
    .insert(payload)
    .select()
    .single()

  if (error) console.error('[creerDevisSupabase] Erreur:', error.message)
  else console.log('[creerDevisSupabase] Inséré — id:', data?.id)

  return { data, error }
}

export async function updateStatutDevisSupabase(token, statut) {
  const { error } = await supabase
    .from('devis')
    .update({ statut })
    .eq('token_unique', token)
  return { error }
}

// ─── signatures ──────────────────────────────────────────────────

export async function getSignatureParToken(token) {
  const { data, error } = await supabase
    .from('signatures')
    .select('*')
    .eq('token', token)
    .single()
  return { data, error }
}

// La table signatures n'a pas signature_artisan_base64 — l'artisan signe
// dans Paramètres, sa signature est stockée dans artisan_profil et lue
// à la demande par la page Signer.
export async function creerSignatureRecord(devisSupabaseId, token) {
  const { data, error } = await supabase
    .from('signatures')
    .insert({
      devis_id: devisSupabaseId,
      token,
      statut:   'en_attente',
    })
    .select()
    .single()
  if (error) console.error('[creerSignatureRecord] Erreur:', error.message)
  return { data, error }
}

// Pour la liste de devis locale donnée, retourne les tokens dont la signature
// a été faite côté Supabase. Permet de marquer automatiquement les devis
// signés comme « accepté » au montage de la page Devis.
export async function listTokensSignes(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) return []
  const { data, error } = await supabase
    .from('signatures')
    .select('token, statut, signe_le, ville_client')
    .in('token', tokens)
    .eq('statut', 'signe')
  if (error) {
    console.error('[listTokensSignes] erreur:', error.message)
    return []
  }
  return data || []
}

export async function signerParClient(token, { signatureClientBase64, ville }) {
  const { data, error } = await supabase
    .from('signatures')
    .update({
      signature_client_base64: signatureClientBase64,
      signe_le:                new Date().toISOString(),
      ville_client:            ville,
      statut:                  'signe',
    })
    .eq('token', token)
    .select()
    .single()
  if (error) console.error('[signerParClient] Erreur:', error.message)
  return { data, error }
}

// ─── Flow principal : envoyer un devis pour signature ────────────

export async function envoyerPourSignature(devis /* , artisan */) {
  const token = crypto.randomUUID()
  let devisId = null

  // 1 — Le devis existe déjà en base (source de vérité Supabase) → on lui
  //     attache simplement le token, SANS créer de doublon.
  if (devis?.id && devis?._source === 'supabase') {
    const { data, error } = await supabase
      .from('devis')
      .update({ token_unique: token })
      .eq('id', devis.id)
      .select('id')
      .single()
    if (error) return { error }
    devisId = data.id
  } else {
    // Sinon (ancien devis non encore migré) → on crée la ligne.
    const { data: devisData, error: devisError } = await creerDevisSupabase(devis, token)
    if (devisError) return { error: devisError }
    devisId = devisData.id
  }

  // 2 — Créer l'enregistrement de signature (la signature artisan est lue
  //     à la demande depuis artisan_profil par la page Signer).
  const { error: sigError } = await creerSignatureRecord(devisId, token)
  if (sigError) return { error: sigError }

  const signingUrl = `${SIGNING_BASE_URL}/${token}`
  return { token, signingUrl, error: null }
}

-- =============================================================================
-- SÉCURITÉ : verrouillage des accès anon (devis, signatures, artisan_profil)
-- =============================================================================
-- Problème : ces 3 tables ont des politiques `USING(true)` pour le rôle `anon`
-- (clé publique) → n'importe qui peut LIRE et SUPPRIMER tous les devis,
-- signatures et infos artisan.
--
-- Solution : la page de signature publique passe désormais par 2 fonctions
-- RPC SECURITY DEFINER scopées à UN token. On peut alors retirer tout accès
-- direct du rôle anon aux tables.
--
-- ⚠️ À exécuter APRÈS avoir déployé le code mis à jour (la page Signer utilise
--    les RPC ; un repli existe donc l'ordre n'est pas bloquant).
-- Idempotent : peut être relancé sans danger.
-- =============================================================================

-- 1) RPC : contexte de signature (devis + signature + artisan) pour UN token
CREATE OR REPLACE FUNCTION public.get_signature_context(p_token text)
RETURNS json
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT json_build_object(
    'devis', (
      SELECT to_jsonb(d) FROM public.devis d WHERE d.token_unique = p_token
    ),
    'signature', (
      SELECT to_jsonb(s) FROM public.signatures s WHERE s.token = p_token
    ),
    'artisan', (
      SELECT json_build_object(
        'signature_base64', a.signature_base64,
        'donnees_json',     a.donnees_json,
        'nom', a.nom, 'siret', a.siret, 'ville', a.ville,
        'adresse', a.adresse, 'email', a.email, 'telephone', a.telephone
      )
      FROM public.artisan_profil a
      ORDER BY a.created_at DESC LIMIT 1
    )
  );
$$;

-- 2) RPC : signature par le client (atomique, scopée au token)
CREATE OR REPLACE FUNCTION public.sign_devis(p_token text, p_signature text, p_ville text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  UPDATE public.signatures
     SET signature_client_base64 = p_signature,
         signe_le     = now(),
         ville_client = p_ville,
         statut       = 'signe'
   WHERE token = p_token AND COALESCE(statut, '') <> 'signe'
   RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'introuvable_ou_deja_signe');
  END IF;

  UPDATE public.devis
     SET statut = 'accepte'
   WHERE token_unique = p_token;

  -- Colonnes de signature si présentes (migration unification) — best effort
  BEGIN
    UPDATE public.devis SET signed_at = now(), signed_ville = p_ville WHERE token_unique = p_token;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;

  RETURN json_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.get_signature_context(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sign_devis(text, text, text) TO anon, authenticated;

-- 3) Helper : un devis appartient-il à mon entreprise ? (pour policies signatures)
CREATE OR REPLACE FUNCTION public.devis_in_my_entreprise(d_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.devis
    WHERE id = d_id AND entreprise_id = public.current_entreprise_id()
  )
$$;
GRANT EXECUTE ON FUNCTION public.devis_in_my_entreprise(uuid) TO authenticated;

-- 4) RETIRER tout accès anon direct aux 3 tables sensibles
DROP POLICY IF EXISTS anon_all          ON public.devis;
DROP POLICY IF EXISTS devis_anon_select ON public.devis;
DROP POLICY IF EXISTS devis_anon_update ON public.devis;
DROP POLICY IF EXISTS anon_all          ON public.signatures;
DROP POLICY IF EXISTS anon_all          ON public.artisan_profil;

REVOKE ALL ON public.devis          FROM anon;
REVOKE ALL ON public.signatures     FROM anon;
REVOKE ALL ON public.artisan_profil FROM anon;

ALTER TABLE public.devis          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatures     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artisan_profil ENABLE ROW LEVEL SECURITY;

-- 5) Politiques AUTHENTIFIÉES pour signatures (manager : créer/lire/màj)
DROP POLICY IF EXISTS sig_auth_select ON public.signatures;
DROP POLICY IF EXISTS sig_auth_insert ON public.signatures;
DROP POLICY IF EXISTS sig_auth_update ON public.signatures;
CREATE POLICY sig_auth_select ON public.signatures FOR SELECT TO authenticated
  USING (public.devis_in_my_entreprise(devis_id));
CREATE POLICY sig_auth_insert ON public.signatures FOR INSERT TO authenticated
  WITH CHECK (public.devis_in_my_entreprise(devis_id));
CREATE POLICY sig_auth_update ON public.signatures FOR UPDATE TO authenticated
  USING (public.devis_in_my_entreprise(devis_id));
GRANT SELECT, INSERT, UPDATE ON public.signatures TO authenticated;

-- 6) Politique AUTHENTIFIÉE pour artisan_profil (lecture/écriture connectée)
--    (table globale legacy sans entreprise_id : on la réserve aux connectés)
DROP POLICY IF EXISTS profil_auth_all ON public.artisan_profil;
CREATE POLICY profil_auth_all ON public.artisan_profil FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON public.artisan_profil TO authenticated;

-- 7) Les politiques authentifiées des devis existent déjà (devis_auth_*).
--    On s'assure du GRANT authenticated.
GRANT SELECT, INSERT, UPDATE ON public.devis TO authenticated;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- ROLLBACK D'URGENCE (à n'exécuter QUE si quelque chose casse) :
-- Redonne temporairement l'accès anon. Décommentez puis exécutez.
-- -----------------------------------------------------------------------------
-- GRANT ALL ON public.devis TO anon;
-- GRANT ALL ON public.signatures TO anon;
-- GRANT ALL ON public.artisan_profil TO anon;
-- CREATE POLICY anon_all ON public.devis          FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY anon_all ON public.signatures     FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY anon_all ON public.artisan_profil FOR ALL TO anon USING (true) WITH CHECK (true);
-- NOTIFY pgrst, 'reload schema';
-- =============================================================================

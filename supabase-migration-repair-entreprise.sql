-- =============================================================================
-- Migration : RPC de reparation du lien manager <-> entreprise
-- =============================================================================
-- Cree une fonction SECURITY DEFINER qui bypasse RLS de maniere controlee
-- pour reparer les comptes managers qui n'ont pas de lien entreprise valide
-- (cas des comptes crees avant le trigger d'inscription).
--
-- A executer dans le SQL Editor Supabase. Idempotent.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.repair_manager_entreprise(
  p_nom   text DEFAULT 'Mon entreprise',
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid          uuid;
  user_email   text;
  existing_ent uuid;
  new_ent_id   uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = uid;

  -- Si l'utilisateur a deja un lien entreprise valide, on le retourne
  SELECT u.entreprise_id INTO existing_ent
  FROM public.utilisateurs u
  WHERE u.id = uid;

  IF existing_ent IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.entreprise WHERE id = existing_ent) THEN
    RETURN existing_ent;
  END IF;

  -- Sinon cree une entreprise + insere/upsert la ligne utilisateurs
  INSERT INTO public.entreprise (nom, email)
  VALUES (
    COALESCE(NULLIF(p_nom, ''), 'Mon entreprise'),
    COALESCE(NULLIF(p_email, ''), user_email)
  )
  RETURNING id INTO new_ent_id;

  INSERT INTO public.utilisateurs (id, entreprise_id, email, role)
  VALUES (uid, new_ent_id, user_email, 'manager')
  ON CONFLICT (id) DO UPDATE
    SET entreprise_id = EXCLUDED.entreprise_id;

  RETURN new_ent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_manager_entreprise(text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

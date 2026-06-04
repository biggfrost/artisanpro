-- =============================================================================
-- Migration : permettre l'inscription d'un ouvrier rattache a une entreprise
-- =============================================================================
-- A executer une fois dans le SQL Editor Supabase.
-- Met a jour le trigger d'inscription pour distinguer manager vs ouvrier,
-- et ajoute une fonction publique permettant a la page de signup ouvrier
-- de recuperer le nom de l'entreprise (sans bypass RLS).
-- =============================================================================

-- 1) Fonction publique : retourne juste id+nom d'une entreprise pour
--    l'afficher sur l'ecran de signup ouvrier. SECURITY DEFINER pour
--    contourner RLS de maniere controlee.
CREATE OR REPLACE FUNCTION public.get_entreprise_public_info(p_id uuid)
RETURNS TABLE(id uuid, nom text)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT id, nom FROM public.entreprise WHERE id = p_id
$$;

GRANT EXECUTE ON FUNCTION public.get_entreprise_public_info(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_entreprise_public_info(uuid) TO authenticated;

-- 2) Mise a jour du trigger d'inscription pour gerer les deux cas :
--    - manager : cree une nouvelle entreprise + son profil
--    - ouvrier : rejoint une entreprise existante via metadata.entreprise_id
CREATE OR REPLACE FUNCTION public.handle_new_manager_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  new_entreprise_id uuid;
  target_ent_id     uuid;
  meta jsonb;
BEGIN
  meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);

  IF (meta->>'role') = 'ouvrier' THEN
    -- Cas ouvrier : rejoindre une entreprise existante
    BEGIN
      target_ent_id := (meta->>'entreprise_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      target_ent_id := NULL;
    END;

    IF target_ent_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.entreprise WHERE id = target_ent_id) THEN
      INSERT INTO public.utilisateurs
        (id, entreprise_id, email, nom, prenom, role, telephone, metier)
      VALUES (
        NEW.id,
        target_ent_id,
        NEW.email,
        meta->>'nom',
        meta->>'prenom',
        'ouvrier',
        meta->>'telephone',
        meta->>'metier'
      );
    END IF;
  ELSE
    -- Cas manager (defaut) : creer une nouvelle entreprise
    INSERT INTO public.entreprise (nom, email)
    VALUES (
      COALESCE(meta->>'entreprise_nom', 'Mon entreprise'),
      NEW.email
    )
    RETURNING id INTO new_entreprise_id;

    INSERT INTO public.utilisateurs
      (id, entreprise_id, email, nom, prenom, role, telephone)
    VALUES (
      NEW.id,
      new_entreprise_id,
      NEW.email,
      meta->>'nom',
      meta->>'prenom',
      'manager',
      meta->>'telephone'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Le trigger existe deja (on_auth_user_created), pas besoin de le recreer.
-- La fonction handle_new_manager_signup() a ete remplacee in-place.

NOTIFY pgrst, 'reload schema';

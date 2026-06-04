-- =============================================================================
-- ArtisanPro SaaS -- Setup Phase 1 (Fondation)
-- =============================================================================
-- A executer UNE SEULE FOIS dans l'editeur SQL de votre projet Supabase.
-- Idempotent : peut etre relance sans danger.
-- =============================================================================

-- 1) Table entreprise -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entreprise (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom              text NOT NULL,
  siret            text,
  adresse          text,
  code_postal      text,
  ville            text,
  telephone        text,
  email            text,
  logo_url         text,
  couleur_primaire text DEFAULT '#1e3a8a',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- 2) Table utilisateurs (1-to-1 avec auth.users) ----------------------------
CREATE TABLE IF NOT EXISTS public.utilisateurs (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  entreprise_id uuid NOT NULL REFERENCES public.entreprise(id) ON DELETE CASCADE,
  email         text NOT NULL,
  nom           text,
  prenom        text,
  role          text NOT NULL CHECK (role IN ('manager','ouvrier')) DEFAULT 'ouvrier',
  telephone     text,
  metier        text,
  statut        text DEFAULT 'actif' CHECK (statut IN ('actif','inactif')),
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_utilisateurs_entreprise ON public.utilisateurs(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_utilisateurs_role       ON public.utilisateurs(role);

-- 3) Table clients ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entreprise_id  uuid NOT NULL REFERENCES public.entreprise(id) ON DELETE CASCADE,
  nom            text NOT NULL,
  prenom         text,
  raison_sociale text,
  type           text DEFAULT 'particulier' CHECK (type IN ('particulier','professionnel')),
  email          text,
  telephone      text,
  adresse        text,
  code_postal    text,
  ville          text,
  notes          text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clients_entreprise ON public.clients(entreprise_id);

-- 4) Table chantiers -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chantiers (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entreprise_id uuid NOT NULL REFERENCES public.entreprise(id) ON DELETE CASCADE,
  client_id     uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  devis_id      uuid REFERENCES public.devis(id) ON DELETE SET NULL,
  nom           text NOT NULL,
  description   text,
  adresse       text,
  code_postal   text,
  ville         text,
  date_debut    date,
  date_fin      date,
  statut        text DEFAULT 'planifie' CHECK (statut IN ('planifie','en_cours','termine','annule')),
  avancement    integer DEFAULT 0 CHECK (avancement BETWEEN 0 AND 100),
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chantiers_entreprise ON public.chantiers(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_chantiers_statut     ON public.chantiers(statut);

-- 5) Table assignations ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ouvrier_id  uuid NOT NULL REFERENCES public.utilisateurs(id) ON DELETE CASCADE,
  chantier_id uuid NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
  date_debut  timestamptz,
  date_fin    timestamptz,
  notes       text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assignations_ouvrier  ON public.assignations(ouvrier_id);
CREATE INDEX IF NOT EXISTS idx_assignations_chantier ON public.assignations(chantier_id);

-- 6) Table pointages -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pointages (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ouvrier_id        uuid NOT NULL REFERENCES public.utilisateurs(id) ON DELETE CASCADE,
  chantier_id       uuid REFERENCES public.chantiers(id) ON DELETE SET NULL,
  heure_arrivee     timestamptz NOT NULL DEFAULT now(),
  heure_depart      timestamptz,
  latitude_arrivee  numeric,
  longitude_arrivee numeric,
  latitude_depart   numeric,
  longitude_depart  numeric,
  notes             text,
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pointages_ouvrier  ON public.pointages(ouvrier_id);
CREATE INDEX IF NOT EXISTS idx_pointages_chantier ON public.pointages(chantier_id);

-- 7) Table messages --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  expediteur_id   uuid NOT NULL REFERENCES public.utilisateurs(id) ON DELETE CASCADE,
  destinataire_id uuid NOT NULL REFERENCES public.utilisateurs(id) ON DELETE CASCADE,
  contenu         text NOT NULL,
  lu              boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_destinataire ON public.messages(destinataire_id);
CREATE INDEX IF NOT EXISTS idx_messages_lu           ON public.messages(lu);

-- 8) Table chantier_photos -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chantier_photos (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chantier_id uuid NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
  ouvrier_id  uuid REFERENCES public.utilisateurs(id) ON DELETE SET NULL,
  url         text NOT NULL,
  legende     text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chantier_photos_chantier ON public.chantier_photos(chantier_id);

-- =============================================================================
-- GRANTS
-- =============================================================================
GRANT ALL ON TABLE public.entreprise      TO authenticated;
GRANT ALL ON TABLE public.utilisateurs    TO authenticated;
GRANT ALL ON TABLE public.clients         TO authenticated;
GRANT ALL ON TABLE public.chantiers       TO authenticated;
GRANT ALL ON TABLE public.assignations    TO authenticated;
GRANT ALL ON TABLE public.pointages       TO authenticated;
GRANT ALL ON TABLE public.messages        TO authenticated;
GRANT ALL ON TABLE public.chantier_photos TO authenticated;

-- =============================================================================
-- HELPERS RLS
-- (renomme current_role -> current_user_role pour ne pas entrer en conflit
--  avec la fonction systeme PostgreSQL du meme nom)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.current_entreprise_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT entreprise_id FROM public.utilisateurs WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT role FROM public.utilisateurs WHERE id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.current_entreprise_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role()     TO authenticated;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.entreprise       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utilisateurs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chantiers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pointages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chantier_photos  ENABLE ROW LEVEL SECURITY;

-- entreprise
DROP POLICY IF EXISTS ent_select ON public.entreprise;
CREATE POLICY ent_select ON public.entreprise FOR SELECT TO authenticated
  USING (id = public.current_entreprise_id());

DROP POLICY IF EXISTS ent_insert ON public.entreprise;
CREATE POLICY ent_insert ON public.entreprise FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS ent_update ON public.entreprise;
CREATE POLICY ent_update ON public.entreprise FOR UPDATE TO authenticated
  USING (id = public.current_entreprise_id() AND public.current_user_role() = 'manager');

-- utilisateurs
DROP POLICY IF EXISTS users_select ON public.utilisateurs;
CREATE POLICY users_select ON public.utilisateurs FOR SELECT TO authenticated
  USING (id = auth.uid() OR entreprise_id = public.current_entreprise_id());

DROP POLICY IF EXISTS users_insert ON public.utilisateurs;
CREATE POLICY users_insert ON public.utilisateurs FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    OR (public.current_user_role() = 'manager' AND entreprise_id = public.current_entreprise_id())
  );

DROP POLICY IF EXISTS users_update ON public.utilisateurs;
CREATE POLICY users_update ON public.utilisateurs FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR (public.current_user_role() = 'manager' AND entreprise_id = public.current_entreprise_id())
  );

DROP POLICY IF EXISTS users_delete ON public.utilisateurs;
CREATE POLICY users_delete ON public.utilisateurs FOR DELETE TO authenticated
  USING (public.current_user_role() = 'manager' AND entreprise_id = public.current_entreprise_id());

-- clients
DROP POLICY IF EXISTS clients_select ON public.clients;
CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated
  USING (entreprise_id = public.current_entreprise_id());

DROP POLICY IF EXISTS clients_modify ON public.clients;
CREATE POLICY clients_modify ON public.clients FOR ALL TO authenticated
  USING (entreprise_id = public.current_entreprise_id())
  WITH CHECK (entreprise_id = public.current_entreprise_id());

-- chantiers
DROP POLICY IF EXISTS chantiers_select ON public.chantiers;
CREATE POLICY chantiers_select ON public.chantiers FOR SELECT TO authenticated
  USING (
    entreprise_id = public.current_entreprise_id()
    OR id IN (SELECT chantier_id FROM public.assignations WHERE ouvrier_id = auth.uid())
  );

DROP POLICY IF EXISTS chantiers_modify ON public.chantiers;
CREATE POLICY chantiers_modify ON public.chantiers FOR ALL TO authenticated
  USING (entreprise_id = public.current_entreprise_id())
  WITH CHECK (entreprise_id = public.current_entreprise_id());

-- assignations
DROP POLICY IF EXISTS assign_select ON public.assignations;
CREATE POLICY assign_select ON public.assignations FOR SELECT TO authenticated
  USING (
    ouvrier_id = auth.uid()
    OR chantier_id IN (SELECT id FROM public.chantiers WHERE entreprise_id = public.current_entreprise_id())
  );

DROP POLICY IF EXISTS assign_modify ON public.assignations;
CREATE POLICY assign_modify ON public.assignations FOR ALL TO authenticated
  USING (
    public.current_user_role() = 'manager'
    AND chantier_id IN (SELECT id FROM public.chantiers WHERE entreprise_id = public.current_entreprise_id())
  )
  WITH CHECK (
    public.current_user_role() = 'manager'
    AND chantier_id IN (SELECT id FROM public.chantiers WHERE entreprise_id = public.current_entreprise_id())
  );

-- pointages
DROP POLICY IF EXISTS point_select ON public.pointages;
CREATE POLICY point_select ON public.pointages FOR SELECT TO authenticated
  USING (
    ouvrier_id = auth.uid()
    OR (
      public.current_user_role() = 'manager'
      AND ouvrier_id IN (SELECT id FROM public.utilisateurs WHERE entreprise_id = public.current_entreprise_id())
    )
  );

DROP POLICY IF EXISTS point_modify ON public.pointages;
CREATE POLICY point_modify ON public.pointages FOR ALL TO authenticated
  USING (ouvrier_id = auth.uid())
  WITH CHECK (ouvrier_id = auth.uid());

-- messages
DROP POLICY IF EXISTS msg_select ON public.messages;
CREATE POLICY msg_select ON public.messages FOR SELECT TO authenticated
  USING (expediteur_id = auth.uid() OR destinataire_id = auth.uid());

DROP POLICY IF EXISTS msg_insert ON public.messages;
CREATE POLICY msg_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK (expediteur_id = auth.uid());

DROP POLICY IF EXISTS msg_update ON public.messages;
CREATE POLICY msg_update ON public.messages FOR UPDATE TO authenticated
  USING (destinataire_id = auth.uid());

-- chantier_photos
DROP POLICY IF EXISTS photos_select ON public.chantier_photos;
CREATE POLICY photos_select ON public.chantier_photos FOR SELECT TO authenticated
  USING (
    chantier_id IN (SELECT id FROM public.chantiers WHERE entreprise_id = public.current_entreprise_id())
    OR chantier_id IN (SELECT chantier_id FROM public.assignations WHERE ouvrier_id = auth.uid())
  );

DROP POLICY IF EXISTS photos_modify ON public.chantier_photos;
CREATE POLICY photos_modify ON public.chantier_photos FOR ALL TO authenticated
  USING (
    chantier_id IN (SELECT id FROM public.chantiers WHERE entreprise_id = public.current_entreprise_id())
    OR chantier_id IN (SELECT chantier_id FROM public.assignations WHERE ouvrier_id = auth.uid())
  )
  WITH CHECK (true);

-- =============================================================================
-- TRIGGER : inscription d'un nouvel utilisateur -> cree son entreprise +
-- son profil dans utilisateurs (role manager par defaut).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_manager_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  new_entreprise_id uuid;
  meta jsonb;
BEGIN
  meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);

  IF (meta->>'role') IS NULL OR (meta->>'role') = 'manager' THEN
    INSERT INTO public.entreprise (nom, email)
    VALUES (
      COALESCE(meta->>'entreprise_nom', 'Mon entreprise'),
      NEW.email
    )
    RETURNING id INTO new_entreprise_id;

    INSERT INTO public.utilisateurs (id, entreprise_id, email, nom, prenom, role, telephone)
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_manager_signup();

-- =============================================================================
-- Recharger le cache PostgREST (obligatoire apres tout changement de schema)
-- =============================================================================
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- FIX RLS : recursion infinie chantiers <-> assignations
-- =============================================================================
-- Probleme : la policy SELECT sur chantiers contenait
--   id IN (SELECT chantier_id FROM assignations WHERE ouvrier_id = auth.uid())
-- et la policy SELECT sur assignations contenait
--   chantier_id IN (SELECT id FROM chantiers WHERE entreprise_id = ...)
-- Chaque table declenche la RLS de l'autre -> cycle infini detecte par Postgres.
--
-- Solution : remplacer les inline subqueries cross-tables par des fonctions
-- SECURITY DEFINER. Ces fonctions s'executent avec les droits du proprietaire
-- (postgres) et bypassent RLS de maniere controlee.
--
-- Idempotent : peut etre relance sans danger.
-- =============================================================================

-- 1) Drop toutes les policies pour repartir propre
DROP POLICY IF EXISTS ent_select        ON public.entreprise;
DROP POLICY IF EXISTS ent_insert        ON public.entreprise;
DROP POLICY IF EXISTS ent_update        ON public.entreprise;
DROP POLICY IF EXISTS users_select      ON public.utilisateurs;
DROP POLICY IF EXISTS users_insert      ON public.utilisateurs;
DROP POLICY IF EXISTS users_update      ON public.utilisateurs;
DROP POLICY IF EXISTS users_delete      ON public.utilisateurs;
DROP POLICY IF EXISTS clients_select    ON public.clients;
DROP POLICY IF EXISTS clients_modify    ON public.clients;
DROP POLICY IF EXISTS chantiers_select  ON public.chantiers;
DROP POLICY IF EXISTS chantiers_modify  ON public.chantiers;
DROP POLICY IF EXISTS assign_select     ON public.assignations;
DROP POLICY IF EXISTS assign_modify     ON public.assignations;
DROP POLICY IF EXISTS point_select      ON public.pointages;
DROP POLICY IF EXISTS point_modify      ON public.pointages;
DROP POLICY IF EXISTS msg_select        ON public.messages;
DROP POLICY IF EXISTS msg_insert        ON public.messages;
DROP POLICY IF EXISTS msg_update        ON public.messages;
DROP POLICY IF EXISTS photos_select     ON public.chantier_photos;
DROP POLICY IF EXISTS photos_modify     ON public.chantier_photos;

-- 2) Helpers de base
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

-- 3) Helpers SECURITY DEFINER pour cross-tables (cassent les cycles RLS)
CREATE OR REPLACE FUNCTION public.user_has_assignment_for_chantier(c_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignations
    WHERE chantier_id = c_id AND ouvrier_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.chantier_in_my_entreprise(c_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chantiers
    WHERE id = c_id AND entreprise_id = public.current_entreprise_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.user_in_my_entreprise(u_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.utilisateurs
    WHERE id = u_id AND entreprise_id = public.current_entreprise_id()
  )
$$;

GRANT EXECUTE ON FUNCTION public.current_entreprise_id()                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role()                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_assignment_for_chantier(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.chantier_in_my_entreprise(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_in_my_entreprise(uuid)                TO authenticated;

-- 4) RECREATE policies sans cross-references inline
-- entreprise
CREATE POLICY ent_select ON public.entreprise FOR SELECT TO authenticated
  USING (id = public.current_entreprise_id());

CREATE POLICY ent_insert ON public.entreprise FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY ent_update ON public.entreprise FOR UPDATE TO authenticated
  USING (id = public.current_entreprise_id() AND public.current_user_role() = 'manager');

-- utilisateurs
CREATE POLICY users_select ON public.utilisateurs FOR SELECT TO authenticated
  USING (id = auth.uid() OR entreprise_id = public.current_entreprise_id());

CREATE POLICY users_insert ON public.utilisateurs FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    OR (public.current_user_role() = 'manager' AND entreprise_id = public.current_entreprise_id())
  );

CREATE POLICY users_update ON public.utilisateurs FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR (public.current_user_role() = 'manager' AND entreprise_id = public.current_entreprise_id())
  );

CREATE POLICY users_delete ON public.utilisateurs FOR DELETE TO authenticated
  USING (public.current_user_role() = 'manager' AND entreprise_id = public.current_entreprise_id());

-- clients
CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated
  USING (entreprise_id = public.current_entreprise_id());

CREATE POLICY clients_modify ON public.clients FOR ALL TO authenticated
  USING      (entreprise_id = public.current_entreprise_id())
  WITH CHECK (entreprise_id = public.current_entreprise_id());

-- chantiers
CREATE POLICY chantiers_select ON public.chantiers FOR SELECT TO authenticated
  USING (
    entreprise_id = public.current_entreprise_id()
    OR public.user_has_assignment_for_chantier(id)
  );

CREATE POLICY chantiers_modify ON public.chantiers FOR ALL TO authenticated
  USING      (entreprise_id = public.current_entreprise_id())
  WITH CHECK (entreprise_id = public.current_entreprise_id());

-- assignations
CREATE POLICY assign_select ON public.assignations FOR SELECT TO authenticated
  USING (
    ouvrier_id = auth.uid()
    OR public.chantier_in_my_entreprise(chantier_id)
  );

CREATE POLICY assign_modify ON public.assignations FOR ALL TO authenticated
  USING (
    public.current_user_role() = 'manager'
    AND public.chantier_in_my_entreprise(chantier_id)
  )
  WITH CHECK (
    public.current_user_role() = 'manager'
    AND public.chantier_in_my_entreprise(chantier_id)
  );

-- pointages
CREATE POLICY point_select ON public.pointages FOR SELECT TO authenticated
  USING (
    ouvrier_id = auth.uid()
    OR (public.current_user_role() = 'manager' AND public.user_in_my_entreprise(ouvrier_id))
  );

CREATE POLICY point_modify ON public.pointages FOR ALL TO authenticated
  USING      (ouvrier_id = auth.uid())
  WITH CHECK (ouvrier_id = auth.uid());

-- messages
CREATE POLICY msg_select ON public.messages FOR SELECT TO authenticated
  USING (expediteur_id = auth.uid() OR destinataire_id = auth.uid());

CREATE POLICY msg_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK (expediteur_id = auth.uid());

CREATE POLICY msg_update ON public.messages FOR UPDATE TO authenticated
  USING (destinataire_id = auth.uid());

-- chantier_photos
CREATE POLICY photos_select ON public.chantier_photos FOR SELECT TO authenticated
  USING (
    public.chantier_in_my_entreprise(chantier_id)
    OR public.user_has_assignment_for_chantier(chantier_id)
  );

CREATE POLICY photos_modify ON public.chantier_photos FOR ALL TO authenticated
  USING (
    public.chantier_in_my_entreprise(chantier_id)
    OR public.user_has_assignment_for_chantier(chantier_id)
  )
  WITH CHECK (true);

-- 5) Reload schema cache
NOTIFY pgrst, 'reload schema';

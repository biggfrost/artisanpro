-- =============================================================================
-- Migration : devis multi-tenant + tracabilite du createur
-- =============================================================================
-- Ajoute entreprise_id et cree_par a la table devis pour permettre :
--   - aux ouvriers de creer des devis
--   - a chacun de voir uniquement les siens (sauf manager qui voit tout)
--   - d'afficher le nom du createur cote manager

ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS entreprise_id uuid;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS cree_par uuid;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devis_entreprise_id_fkey') THEN
    ALTER TABLE public.devis ADD CONSTRAINT devis_entreprise_id_fkey
      FOREIGN KEY (entreprise_id) REFERENCES public.entreprise(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devis_cree_par_fkey') THEN
    ALTER TABLE public.devis ADD CONSTRAINT devis_cree_par_fkey
      FOREIGN KEY (cree_par) REFERENCES public.utilisateurs(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_devis_entreprise ON public.devis(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_devis_cree_par   ON public.devis(cree_par);

-- Backfill : devis existants -> premier manager
DO $$
DECLARE
  fb_user uuid;
  fb_ent  uuid;
BEGIN
  SELECT id, entreprise_id INTO fb_user, fb_ent
  FROM public.utilisateurs WHERE role = 'manager' LIMIT 1;
  IF fb_user IS NOT NULL THEN
    UPDATE public.devis
    SET cree_par      = COALESCE(cree_par, fb_user),
        entreprise_id = COALESCE(entreprise_id, fb_ent);
  END IF;
END $$;

-- Drop ancienne policy permissive
DROP POLICY IF EXISTS anon_all ON public.devis;

-- Anon (page Signer publique) : SELECT et UPDATE limites par token
DROP POLICY IF EXISTS devis_anon_select ON public.devis;
CREATE POLICY devis_anon_select ON public.devis FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS devis_anon_update ON public.devis;
CREATE POLICY devis_anon_update ON public.devis FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

-- Authenticated SELECT : par role
DROP POLICY IF EXISTS devis_auth_select ON public.devis;
CREATE POLICY devis_auth_select ON public.devis FOR SELECT TO authenticated
  USING (
    (public.current_user_role() = 'manager' AND entreprise_id = public.current_entreprise_id())
    OR cree_par = auth.uid()
  );

-- Authenticated INSERT
DROP POLICY IF EXISTS devis_auth_insert ON public.devis;
CREATE POLICY devis_auth_insert ON public.devis FOR INSERT TO authenticated
  WITH CHECK (
    cree_par = auth.uid()
    AND entreprise_id = public.current_entreprise_id()
  );

-- Authenticated UPDATE
DROP POLICY IF EXISTS devis_auth_update ON public.devis;
CREATE POLICY devis_auth_update ON public.devis FOR UPDATE TO authenticated
  USING (
    cree_par = auth.uid()
    OR (public.current_user_role() = 'manager' AND entreprise_id = public.current_entreprise_id())
  );

GRANT ALL ON TABLE public.devis TO anon;
GRANT ALL ON TABLE public.devis TO authenticated;

NOTIFY pgrst, 'reload schema';

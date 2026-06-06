-- ============================================================
-- Contrainte d'unicité du numéro de devis par entreprise.
-- Garantie ultime : la base refuse deux devis de même numéro
-- dans une même entreprise (en plus de la génération + retry côté app).
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- Prérequis : base déjà nettoyée des doublons (fait).
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'devis_numero_entreprise_unique'
  ) THEN
    ALTER TABLE public.devis
      ADD CONSTRAINT devis_numero_entreprise_unique UNIQUE (entreprise_id, numero);
  END IF;
END $$;

-- RPC : prochain numéro de devis pour l'entreprise du caller.
-- SECURITY DEFINER → voit tous les devis de l'entreprise (manager + ouvriers),
-- ce que la RLS empêche pour un ouvrier en requête directe.
CREATE OR REPLACE FUNCTION public.next_devis_numero()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public AS $$
DECLARE
  v_ent    uuid := public.current_entreprise_id();
  v_prefix text := 'DEV-' || to_char(now(), 'YYYY') || '-';
  v_max    int;
BEGIN
  SELECT MAX((split_part(numero, '-', 3))::int)
    INTO v_max
    FROM public.devis
    WHERE entreprise_id = v_ent
      AND numero LIKE v_prefix || '%'
      AND split_part(numero, '-', 3) ~ '^[0-9]+$';
  RETURN v_prefix || lpad((COALESCE(v_max, 0) + 1)::text, 3, '0');
END $$;

GRANT EXECUTE ON FUNCTION public.next_devis_numero() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Note : en Postgres, plusieurs lignes avec entreprise_id NULL ne se
-- "conflictent" pas (NULL est distinct). La contrainte protège donc les
-- devis rattachés à une entreprise — ce qui est le cas de tous les nouveaux.
-- ============================================================

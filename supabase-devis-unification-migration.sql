-- ============================================================
-- MIGRATION : Unification des devis dans Supabase
-- Ajoute les colonnes manquantes pour stocker le DÉTAIL complet
-- (lignes de prestations, totaux, infos de signature) directement en base,
-- afin d'avoir UNE seule source de vérité.
--
-- 100 % ADDITIF : aucune donnée existante n'est supprimée ni modifiée.
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE devis ADD COLUMN IF NOT EXISTS prestations          jsonb;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS total_ttc            numeric;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS conditions_paiement  text;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS acompte_pct          numeric;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS signed_at            timestamptz;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS signed_ville         text;

-- Recharger le cache PostgREST
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Après exécution : rechargez l'application. Les nouveaux devis
-- stockeront le détail complet des lignes. Vos anciens devis
-- restent lisibles (compatibilité assurée par le code).
-- ============================================================

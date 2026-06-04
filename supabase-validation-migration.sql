-- ============================================================
-- MIGRATION : Workflow de validation des devis ouvriers
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- URL : https://supabase.com/dashboard/project/zptxycatjuhjhjpsctot/sql/new
-- ============================================================

-- 1. Si la colonne statut a une contrainte CHECK, on l'élargit.
--    Si elle n'en a pas, cette commande ne fait rien de dangereux.
ALTER TABLE devis
  DROP CONSTRAINT IF EXISTS devis_statut_check;

ALTER TABLE devis
  ADD CONSTRAINT devis_statut_check CHECK (
    statut IN (
      'en_attente_validation',   -- devis ouvrier en attente d'approbation manager
      'Envoyé',                  -- valeur legacy Supabase
      'envoye',
      'Accepté',
      'accepte',
      'Refusé',
      'refuse',
      'Annulé',
      'annule'
    )
  );

-- 2. S'assurer que la valeur par défaut ne bloque pas la nouvelle valeur
--    (certains projets ont un DEFAULT 'Envoyé' qui court-circuite notre INSERT).
--    On laisse le DEFAULT tel quel — l'app passe toujours statut explicitement.

-- 3. Vérification : compter les devis par statut
SELECT statut, COUNT(*) FROM devis GROUP BY statut ORDER BY statut;

-- ============================================================
-- RÉSULTAT ATTENDU : la requête SELECT retourne les statuts existants
-- La contrainte CHECK doit s'exécuter sans erreur.
-- ============================================================

-- =============================================================================
-- Migration : ajout colonne client_nom (texte libre) sur chantiers
-- =============================================================================
-- La page Chantiers historique utilisait un champ "client" en texte libre.
-- On preserve cette UX en ajoutant client_nom plutot que de forcer un FK
-- vers la table clients (qui pourra etre branche plus tard).
-- =============================================================================

ALTER TABLE public.chantiers ADD COLUMN IF NOT EXISTS client_nom text;

NOTIFY pgrst, 'reload schema';

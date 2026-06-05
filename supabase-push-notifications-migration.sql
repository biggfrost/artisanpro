-- ============================================================
-- MIGRATION : Notifications push (Web Push) — table des abonnements
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Table des abonnements push (un appareil = une ligne)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   text UNIQUE NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

-- 2. RLS : chaque utilisateur gère ses propres abonnements
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_own_select" ON push_subscriptions;
DROP POLICY IF EXISTS "push_own_insert" ON push_subscriptions;
DROP POLICY IF EXISTS "push_own_update" ON push_subscriptions;
DROP POLICY IF EXISTS "push_own_delete" ON push_subscriptions;

CREATE POLICY "push_own_select" ON push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "push_own_insert" ON push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_own_update" ON push_subscriptions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_own_delete" ON push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 3. Recharger le cache PostgREST
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- L'Edge Function "notify" lit cette table avec la clé service_role
-- (bypass RLS) pour envoyer les push aux bons utilisateurs.
-- ============================================================

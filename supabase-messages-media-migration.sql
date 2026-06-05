-- ============================================================
-- MIGRATION : Médias dans la messagerie (photos, vidéos, documents, vocaux)
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- URL : https://supabase.com/dashboard/project/zptxycatjuhjhjpsctot/sql/new
-- ============================================================

-- 1. Colonnes média sur la table messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS type         text DEFAULT 'texte';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url    text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_nom    text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_taille bigint;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_duree  numeric;  -- secondes (audio/vidéo)

-- 2. Bucket de stockage public pour les médias de messagerie
INSERT INTO storage.buckets (id, name, public)
VALUES ('messages-media', 'messages-media', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Politiques de stockage
--    Upload : tout utilisateur authentifié ; Lecture : publique (liens directs)
DROP POLICY IF EXISTS "msg_media_upload" ON storage.objects;
DROP POLICY IF EXISTS "msg_media_read"   ON storage.objects;

CREATE POLICY "msg_media_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'messages-media');

CREATE POLICY "msg_media_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'messages-media');

-- 4. Recharger le cache PostgREST
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Après exécution : rechargez l'application. L'envoi de photos,
-- vidéos, documents et messages vocaux sera opérationnel.
-- ============================================================

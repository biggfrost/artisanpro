-- ============================================================
-- POINT 4 : notification push "devis signé" même app fermée
-- Quand un client signe (RPC sign_devis, côté serveur), on déclenche
-- directement l'Edge Function `notify` via pg_net → push au manager.
-- Aucun webhook à configurer.
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- ============================================================

-- 1) Activer pg_net (HTTP sortant depuis Postgres) — souvent déjà actif.
--    Sur Supabase, l'extension expose les fonctions dans le schéma `net`.
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2) sign_devis : signe + notifie le manager via l'Edge Function
CREATE OR REPLACE FUNCTION public.sign_devis(p_token text, p_signature text, p_ville text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_id    uuid;
  v_devis public.devis;
BEGIN
  -- a) Enregistre la signature client (si pas déjà signé)
  UPDATE public.signatures
     SET signature_client_base64 = p_signature,
         signe_le     = now(),
         ville_client = p_ville,
         statut       = 'signe'
   WHERE token = p_token AND COALESCE(statut, '') <> 'signe'
   RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'introuvable_ou_deja_signe');
  END IF;

  -- b) Passe le devis en "accepté"
  UPDATE public.devis
     SET statut = 'accepte'
   WHERE token_unique = p_token
   RETURNING * INTO v_devis;

  -- Colonnes de signature si présentes (best effort)
  BEGIN
    UPDATE public.devis SET signed_at = now(), signed_ville = p_ville WHERE token_unique = p_token;
  EXCEPTION WHEN undefined_column THEN NULL; END;

  -- c) Notifie le manager via l'Edge Function notify (push, même app fermée).
  --    Best-effort : si pg_net indisponible, la signature aboutit quand même.
  BEGIN
    PERFORM net.http_post(
      url     := 'https://zptxycatjuhjhjpsctot.supabase.co/functions/v1/notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwdHh5Y2F0anVoamhqcHNjdG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDgyNDEsImV4cCI6MjA5NDI4NDI0MX0.r38Zuz-BbI9OD2tzYfc1rA0uI8xVK1wxIRJwBb6qBr8'
      ),
      body    := jsonb_build_object(
        'type', 'UPDATE',
        'table', 'devis',
        'record', to_jsonb(v_devis),
        'old_record', jsonb_build_object('statut', 'envoye')
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN json_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.sign_devis(text, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

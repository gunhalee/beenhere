-- Feed-state compatibility repair.
-- Purpose:
-- 1) ensure feed_state table/policy exists
-- 2) ensure get_feed_state / refresh_feed_state RPCs exist
-- 3) ensure execute grants are applied idempotently

CREATE TABLE IF NOT EXISTS feed_state (
  id                      boolean     PRIMARY KEY DEFAULT true CHECK (id = true),
  version                 bigint      NOT NULL DEFAULT 0,
  source_last_activity_at timestamptz,
  refreshed_at            timestamptz NOT NULL DEFAULT now()
);

INSERT INTO feed_state (id, version, source_last_activity_at, refreshed_at)
VALUES (true, 0, NULL, now())
ON CONFLICT (id) DO NOTHING;

ALTER TABLE feed_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feed_state'
      AND policyname = 'feed_state_public_read'
  ) THEN
    CREATE POLICY "feed_state_public_read"
      ON feed_state FOR SELECT
      USING (true);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_feed_state()
RETURNS TABLE (
  version                 bigint,
  source_last_activity_at timestamptz,
  refreshed_at            timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest_activity timestamptz;
BEGIN
  SELECT MAX(p.last_activity_at) INTO v_latest_activity
  FROM posts p
  WHERE p.status = 'active'
    AND p.active_until > now();

  UPDATE feed_state fs
  SET
    version = CASE
      WHEN fs.source_last_activity_at IS DISTINCT FROM v_latest_activity
        THEN fs.version + 1
      ELSE fs.version
    END,
    source_last_activity_at = v_latest_activity,
    refreshed_at = now()
  WHERE fs.id = true;

  IF NOT FOUND THEN
    INSERT INTO feed_state (id, version, source_last_activity_at, refreshed_at)
    VALUES (true, 1, v_latest_activity, now());
  END IF;

  RETURN QUERY
  SELECT fs.version, fs.source_last_activity_at, fs.refreshed_at
  FROM feed_state fs
  WHERE fs.id = true;
END;
$$;

CREATE OR REPLACE FUNCTION get_feed_state()
RETURNS TABLE (
  version                 bigint,
  source_last_activity_at timestamptz,
  refreshed_at            timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feed_state WHERE id = true) THEN
    PERFORM refresh_feed_state();
  END IF;

  RETURN QUERY
  SELECT fs.version, fs.source_last_activity_at, fs.refreshed_at
  FROM feed_state fs
  WHERE fs.id = true;
END;
$$;

REVOKE ALL ON FUNCTION public.get_feed_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_feed_state() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.get_feed_state() TO anon, authenticated;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.refresh_feed_state() TO service_role;
  END IF;
END;
$$;


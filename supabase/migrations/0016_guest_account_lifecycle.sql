-- =============================================================
-- Guest account lifecycle
-- =============================================================
-- Scope:
--   1) Track guest/member lifecycle fields on profiles
--   2) Merge guest data into member account (member wins on conflicts)
--   3) Anonymize inactive guest profiles after retention window
-- =============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'member'
    CHECK (account_type IN ('guest', 'member')),
  ADD COLUMN IF NOT EXISTS guest_status text
    CHECK (guest_status IN ('active', 'merged', 'anonymized')),
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS anonymized_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_into_user_id uuid REFERENCES auth.users(id);

-- Backfill account type from auth.users when possible.
UPDATE profiles p
SET
  account_type = CASE WHEN u.is_anonymous THEN 'guest' ELSE 'member' END,
  guest_status = CASE WHEN u.is_anonymous THEN COALESCE(p.guest_status, 'active') ELSE NULL END
FROM auth.users u
WHERE u.id = p.id;

CREATE TABLE IF NOT EXISTS account_merges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_account_merges_guest_user_id
  ON account_merges(guest_user_id);
CREATE INDEX IF NOT EXISTS idx_account_merges_member_user_id
  ON account_merges(member_user_id);
CREATE INDEX IF NOT EXISTS idx_account_merges_started_at
  ON account_merges(started_at DESC);

CREATE TABLE IF NOT EXISTS guest_conversion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  guest_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  member_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_conversion_events_name_created
  ON guest_conversion_events(event_name, created_at DESC);

CREATE OR REPLACE FUNCTION touch_profile_activity(
  p_user_id uuid,
  p_is_anonymous boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET
    last_active_at = now(),
    account_type = CASE WHEN p_is_anonymous THEN 'guest' ELSE 'member' END,
    guest_status = CASE
      WHEN p_is_anonymous THEN
        CASE WHEN guest_status = 'merged' THEN 'merged' ELSE 'active' END
      ELSE NULL
    END,
    anonymized_at = CASE
      WHEN p_is_anonymous AND guest_status <> 'merged' THEN NULL
      ELSE anonymized_at
    END
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION merge_guest_account(
  p_guest_user_id uuid,
  p_member_user_id uuid
)
RETURNS TABLE (
  merged_posts int,
  merged_post_locations int,
  merged_likes int,
  merged_blocks int,
  merged_reports int
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_merge_id uuid;
  v_guest_is_anonymous boolean;
  v_posts_count int := 0;
  v_post_locations_count int := 0;
  v_likes_count int := 0;
  v_blocks_count int := 0;
  v_reports_count int := 0;
  v_tmp_count int := 0;
BEGIN
  IF p_guest_user_id IS NULL OR p_member_user_id IS NULL THEN
    RAISE EXCEPTION 'Guest/member ids are required' USING ERRCODE = '22023';
  END IF;

  IF p_guest_user_id = p_member_user_id THEN
    RETURN QUERY SELECT 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  SELECT u.is_anonymous
  INTO v_guest_is_anonymous
  FROM auth.users u
  WHERE u.id = p_guest_user_id;

  IF v_guest_is_anonymous IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Guest account is invalid or already upgraded' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_member_user_id) THEN
    RAISE EXCEPTION 'Member account not found' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM account_merges am
    WHERE am.guest_user_id = p_guest_user_id
      AND am.member_user_id = p_member_user_id
      AND am.status = 'completed'
  ) THEN
    RETURN QUERY SELECT 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  INSERT INTO account_merges (
    guest_user_id,
    member_user_id,
    status
  )
  VALUES (
    p_guest_user_id,
    p_member_user_id,
    'running'
  )
  RETURNING id INTO v_merge_id;

  -- Ensure member profile exists (member-first merge policy).
  INSERT INTO profiles (id, nickname, account_type, guest_status, last_active_at)
  VALUES (
    p_member_user_id,
    'member_' || substr(replace(p_member_user_id::text, '-', ''), 1, 10),
    'member',
    NULL,
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  UPDATE profiles
  SET
    account_type = 'member',
    guest_status = NULL,
    merged_into_user_id = NULL,
    last_active_at = now()
  WHERE id = p_member_user_id;

  UPDATE posts
  SET author_id = p_member_user_id
  WHERE author_id = p_guest_user_id;
  GET DIAGNOSTICS v_posts_count = ROW_COUNT;

  UPDATE post_locations
  SET shared_by_id = p_member_user_id
  WHERE shared_by_id = p_guest_user_id;
  GET DIAGNOSTICS v_post_locations_count = ROW_COUNT;

  DELETE FROM likes guest_likes
  USING likes member_likes
  WHERE guest_likes.user_id = p_guest_user_id
    AND member_likes.user_id = p_member_user_id
    AND member_likes.post_id = guest_likes.post_id;

  UPDATE likes
  SET user_id = p_member_user_id
  WHERE user_id = p_guest_user_id;
  GET DIAGNOSTICS v_likes_count = ROW_COUNT;

  INSERT INTO blocks (blocker_id, blocked_id, created_at)
  SELECT p_member_user_id, b.blocked_id, b.created_at
  FROM blocks b
  WHERE b.blocker_id = p_guest_user_id
    AND b.blocked_id <> p_member_user_id
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
  GET DIAGNOSTICS v_blocks_count = ROW_COUNT;

  INSERT INTO blocks (blocker_id, blocked_id, created_at)
  SELECT b.blocker_id, p_member_user_id, b.created_at
  FROM blocks b
  WHERE b.blocked_id = p_guest_user_id
    AND b.blocker_id <> p_member_user_id
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
  GET DIAGNOSTICS v_tmp_count = ROW_COUNT;
  v_blocks_count := v_blocks_count + v_tmp_count;

  DELETE FROM blocks
  WHERE blocker_id = p_guest_user_id
     OR blocked_id = p_guest_user_id;

  INSERT INTO reports (post_id, reporter_id, reason_code, created_at)
  SELECT r.post_id, p_member_user_id, r.reason_code, r.created_at
  FROM reports r
  WHERE r.reporter_id = p_guest_user_id
  ON CONFLICT (post_id, reporter_id) DO NOTHING;
  GET DIAGNOSTICS v_reports_count = ROW_COUNT;

  DELETE FROM reports
  WHERE reporter_id = p_guest_user_id;

  UPDATE profiles
  SET
    account_type = 'guest',
    guest_status = 'merged',
    merged_into_user_id = p_member_user_id,
    last_active_at = now()
  WHERE id = p_guest_user_id;

  INSERT INTO guest_conversion_events (
    event_name,
    guest_user_id,
    member_user_id,
    metadata
  )
  VALUES (
    'conversion_completed',
    p_guest_user_id,
    p_member_user_id,
    jsonb_build_object(
      'merged_posts', v_posts_count,
      'merged_post_locations', v_post_locations_count,
      'merged_likes', v_likes_count,
      'merged_blocks', v_blocks_count,
      'merged_reports', v_reports_count
    )
  );

  UPDATE account_merges
  SET
    status = 'completed',
    completed_at = now(),
    details = jsonb_build_object(
      'merged_posts', v_posts_count,
      'merged_post_locations', v_post_locations_count,
      'merged_likes', v_likes_count,
      'merged_blocks', v_blocks_count,
      'merged_reports', v_reports_count
    )
  WHERE id = v_merge_id;

  RETURN QUERY SELECT
    v_posts_count,
    v_post_locations_count,
    v_likes_count,
    v_blocks_count,
    v_reports_count;
EXCEPTION
  WHEN OTHERS THEN
    IF v_merge_id IS NOT NULL THEN
      UPDATE account_merges
      SET
        status = 'failed',
        completed_at = now(),
        error = SQLERRM
      WHERE id = v_merge_id;
    END IF;
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION anonymize_inactive_guest_profiles(
  p_inactive_days int DEFAULT 365,
  p_limit int DEFAULT 500
)
RETURNS TABLE (
  anonymized_count int
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_inactive_days < 1 OR p_limit < 1 THEN
    RAISE EXCEPTION 'Invalid anonymization options' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH targets AS (
    SELECT p.id
    FROM profiles p
    WHERE p.account_type = 'guest'
      AND COALESCE(p.guest_status, 'active') = 'active'
      AND p.last_active_at < now() - make_interval(days => p_inactive_days)
    ORDER BY p.last_active_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE profiles p
    SET
      nickname = 'anon_' || substr(replace(p.id::text, '-', ''), 1, 10),
      guest_status = 'anonymized',
      anonymized_at = now()
    FROM targets t
    WHERE p.id = t.id
    RETURNING p.id
  )
  SELECT COUNT(*)::int
  FROM updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_profile_activity(uuid, boolean)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.merge_guest_account(uuid, uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.anonymize_inactive_guest_profiles(int, int)
TO service_role;

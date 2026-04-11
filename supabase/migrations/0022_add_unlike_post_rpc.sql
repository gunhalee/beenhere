-- Add unlike_post RPC to support like toggle (unlike).
-- Authenticated users can remove their own like and receive updated like_count.

CREATE OR REPLACE FUNCTION public.unlike_post(
  p_post_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post_location_id uuid;
  v_like_count bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM posts
    WHERE id = p_post_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Post not found or not active' USING ERRCODE = 'P0003';
  END IF;

  SELECT l.post_location_id
  INTO v_post_location_id
  FROM likes l
  WHERE l.post_id = p_post_id
    AND l.user_id = auth.uid()
  LIMIT 1;

  -- Idempotent behavior: if already unliked, return current count.
  IF v_post_location_id IS NULL THEN
    SELECT like_count
    INTO v_like_count
    FROM posts
    WHERE id = p_post_id;

    RETURN jsonb_build_object('like_count', COALESCE(v_like_count, 0));
  END IF;

  DELETE FROM likes
  WHERE post_id = p_post_id
    AND user_id = auth.uid();

  DELETE FROM post_locations
  WHERE id = v_post_location_id;

  SELECT like_count
  INTO v_like_count
  FROM posts
  WHERE id = p_post_id;

  RETURN jsonb_build_object('like_count', COALESCE(v_like_count, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlike_post(uuid) TO authenticated;

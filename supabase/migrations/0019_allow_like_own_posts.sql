-- Allow users to like their own posts.
-- Keeps existing RPC contract/error codes except the own-post restriction.

CREATE OR REPLACE FUNCTION like_post(
  p_post_id uuid,
  p_latitude float8,
  p_longitude float8,
  p_place_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_location_id uuid;
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

  IF EXISTS (
    SELECT 1
    FROM likes
    WHERE post_id = p_post_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Already liked' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO post_locations (post_id, shared_by_id, latitude, longitude, place_label)
  VALUES (p_post_id, auth.uid(), p_latitude, p_longitude, p_place_label)
  RETURNING id INTO v_location_id;

  INSERT INTO likes (post_id, user_id, post_location_id)
  VALUES (p_post_id, auth.uid(), v_location_id);

  UPDATE posts
  SET
    last_activity_at = now(),
    active_until = now() + interval '30 days'
  WHERE id = p_post_id;

  SELECT like_count
  INTO v_like_count
  FROM posts
  WHERE id = p_post_id;

  RETURN jsonb_build_object('like_count', COALESCE(v_like_count, 0));
END;
$$;

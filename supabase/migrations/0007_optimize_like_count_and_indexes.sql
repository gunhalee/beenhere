-- Performance patch (phase: 2/3/4 only)
-- 2) Remove runtime like-count aggregation JOIN by denormalizing posts.like_count.
-- 3) Add composite indexes for profile/liker cursor queries.
-- 4) Keep API contract unchanged while replacing heavy COUNT/JOIN paths.

-- =============================================================
-- 1. posts.like_count column (denormalized counter)
-- =============================================================

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS like_count bigint NOT NULL DEFAULT 0;

-- Existing data backfill
UPDATE posts p
SET like_count = counts.like_count
FROM (
  SELECT post_id, COUNT(*)::bigint AS like_count
  FROM likes
  GROUP BY post_id
) counts
WHERE p.id = counts.post_id;

-- =============================================================
-- 2. keep posts.like_count in sync via likes trigger
-- =============================================================

DROP TRIGGER IF EXISTS trg_likes_sync_post_like_count ON likes;
DROP FUNCTION IF EXISTS sync_post_like_count();

CREATE FUNCTION sync_post_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts
    SET like_count = like_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE posts
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.post_id IS DISTINCT FROM OLD.post_id THEN
    UPDATE posts
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = OLD.post_id;

    UPDATE posts
    SET like_count = like_count + 1
    WHERE id = NEW.post_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_likes_sync_post_like_count
AFTER INSERT OR DELETE OR UPDATE OF post_id ON likes
FOR EACH ROW
EXECUTE FUNCTION sync_post_like_count();

-- =============================================================
-- 3. index reinforcement for cursor queries
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_post_locations_post_shared_created
  ON post_locations(post_id, shared_by_id, created_at);

CREATE INDEX IF NOT EXISTS idx_likes_user_created_id
  ON likes(user_id, created_at DESC, id);

CREATE INDEX IF NOT EXISTS idx_likes_post_created_id
  ON likes(post_id, created_at DESC, id);

-- =============================================================
-- 4. RPC replacements to use posts.like_count directly
-- =============================================================

-- 4-1) like_post: replace SELECT COUNT(*) with posts.like_count read
CREATE OR REPLACE FUNCTION like_post(
  p_post_id     uuid,
  p_latitude    float8,
  p_longitude   float8,
  p_place_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_location_id uuid;
  v_like_count  bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM posts
    WHERE id = p_post_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Post not found or not active' USING ERRCODE = 'P0003';
  END IF;

  IF EXISTS (
    SELECT 1 FROM posts
    WHERE id = p_post_id AND author_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Cannot like own post' USING ERRCODE = 'P0004';
  END IF;

  IF EXISTS (
    SELECT 1 FROM likes
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

-- 4-2) list_nearby_feed: remove post_like_counts JOIN
CREATE OR REPLACE FUNCTION list_nearby_feed(
  viewer_lat              float8,
  viewer_lng              float8,
  radius_meters           float8      DEFAULT 10000,
  cursor_distance_meters  float8      DEFAULT NULL,
  cursor_last_activity_at timestamptz DEFAULT NULL,
  cursor_post_id          uuid        DEFAULT NULL,
  result_limit            int         DEFAULT 21
)
RETURNS TABLE (
  post_id              uuid,
  content              text,
  author_id            uuid,
  author_nickname      text,
  last_sharer_id       uuid,
  last_sharer_nickname text,
  place_label          text,
  distance_meters      float8,
  last_activity_at     timestamptz,
  like_count           bigint,
  my_like              boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH
  blocked_ids AS (
    SELECT blocked_id AS uid FROM blocks WHERE blocker_id = auth.uid()
    UNION
    SELECT blocker_id AS uid FROM blocks WHERE blocked_id = auth.uid()
  ),
  candidate_locations AS (
    SELECT
      pl.id AS location_id,
      pl.post_id,
      pl.shared_by_id,
      pl.place_label,
      (
        6371000.0 * acos(
          LEAST(
            1.0,
            cos(radians(viewer_lat)) * cos(radians(pl.latitude))
            * cos(radians(pl.longitude) - radians(viewer_lng))
            + sin(radians(viewer_lat)) * sin(radians(pl.latitude))
          )
        )
      )::float8 AS dist_m
    FROM post_locations pl
    JOIN posts p ON p.id = pl.post_id
    WHERE
      p.status = 'active'
      AND p.active_until > now()
      AND p.author_id NOT IN (SELECT uid FROM blocked_ids)
      AND pl.shared_by_id NOT IN (SELECT uid FROM blocked_ids)
  ),
  within_radius AS (
    SELECT * FROM candidate_locations
    WHERE dist_m <= radius_meters
  ),
  closest_per_post AS (
    SELECT DISTINCT ON (wr.post_id)
      wr.post_id,
      wr.location_id,
      wr.shared_by_id AS closest_sharer_id,
      wr.place_label AS closest_place_label,
      wr.dist_m
    FROM within_radius wr
    ORDER BY wr.post_id, wr.dist_m ASC
  ),
  feed_rows AS (
    SELECT
      cpp.post_id,
      p.content,
      p.author_id,
      author_pr.nickname AS author_nickname,
      cpp.closest_sharer_id AS last_sharer_id,
      sharer_pr.nickname AS last_sharer_nickname,
      cpp.closest_place_label AS place_label,
      cpp.dist_m AS distance_meters,
      p.last_activity_at,
      p.like_count AS like_count,
      (
        auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM likes l
          WHERE l.post_id = cpp.post_id
            AND l.user_id = auth.uid()
        )
      ) AS my_like
    FROM closest_per_post cpp
    JOIN posts p ON p.id = cpp.post_id
    JOIN profiles author_pr ON author_pr.id = p.author_id
    JOIN profiles sharer_pr ON sharer_pr.id = cpp.closest_sharer_id
  )
  SELECT
    fr.post_id,
    fr.content,
    fr.author_id,
    fr.author_nickname,
    fr.last_sharer_id,
    fr.last_sharer_nickname,
    fr.place_label,
    fr.distance_meters,
    fr.last_activity_at,
    fr.like_count,
    fr.my_like
  FROM feed_rows fr
  WHERE
    cursor_distance_meters IS NULL
    OR (
      fr.distance_meters > cursor_distance_meters
      OR (
        fr.distance_meters = cursor_distance_meters
        AND fr.last_activity_at < cursor_last_activity_at
      )
      OR (
        fr.distance_meters = cursor_distance_meters
        AND fr.last_activity_at = cursor_last_activity_at
        AND fr.post_id > cursor_post_id
      )
    )
  ORDER BY
    fr.distance_meters ASC,
    fr.last_activity_at DESC,
    fr.post_id ASC
  LIMIT result_limit;
END;
$$;

-- 4-3) get_profile_posts: remove post_like_counts JOIN
CREATE OR REPLACE FUNCTION get_profile_posts(
  target_user_id uuid,
  cursor_post_id uuid DEFAULT NULL,
  cursor_created_at timestamptz DEFAULT NULL,
  result_limit int DEFAULT 21
)
RETURNS TABLE (
  post_id uuid,
  content text,
  place_label text,
  last_activity_at timestamptz,
  post_created_at timestamptz,
  like_count bigint,
  my_like boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = target_user_id)
       OR (blocker_id = target_user_id AND blocked_id = auth.uid())
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id AS post_id,
    p.content,
    orig_loc.place_label,
    p.last_activity_at,
    p.created_at AS post_created_at,
    p.like_count AS like_count,
    (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM likes l
        WHERE l.post_id = p.id
          AND l.user_id = auth.uid()
      )
    ) AS my_like
  FROM posts p
  LEFT JOIN LATERAL (
    SELECT pl.place_label
    FROM post_locations pl
    WHERE pl.post_id = p.id
      AND pl.shared_by_id = p.author_id
    ORDER BY pl.created_at ASC
    LIMIT 1
  ) orig_loc ON true
  WHERE
    p.author_id = target_user_id
    AND p.status = 'active'
    AND (
      cursor_created_at IS NULL
      OR p.created_at < cursor_created_at
      OR (p.created_at = cursor_created_at AND p.id > cursor_post_id)
    )
  ORDER BY p.created_at DESC, p.id ASC
  LIMIT result_limit;
END;
$$;

-- 4-4) get_profile_likes: remove post_like_counts JOIN
CREATE OR REPLACE FUNCTION get_profile_likes(
  target_user_id    uuid,
  cursor_like_id    uuid        DEFAULT NULL,
  cursor_created_at timestamptz DEFAULT NULL,
  result_limit      int         DEFAULT 21
)
RETURNS TABLE (
  post_id          uuid,
  content          text,
  author_id        uuid,
  author_nickname  text,
  place_label      text,
  last_activity_at timestamptz,
  like_id          uuid,
  like_created_at  timestamptz,
  like_count       bigint,
  my_like          boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = target_user_id)
       OR (blocker_id = target_user_id AND blocked_id = auth.uid())
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id AS post_id,
    p.content,
    p.author_id,
    author_pr.nickname AS author_nickname,
    like_loc.place_label,
    p.last_activity_at,
    l.id AS like_id,
    l.created_at AS like_created_at,
    p.like_count AS like_count,
    (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM likes l2
        WHERE l2.post_id = p.id
          AND l2.user_id = auth.uid()
      )
    ) AS my_like
  FROM likes l
  JOIN posts p ON p.id = l.post_id
  JOIN profiles author_pr ON author_pr.id = p.author_id
  JOIN post_locations like_loc ON like_loc.id = l.post_location_id
  WHERE
    l.user_id = target_user_id
    AND p.status = 'active'
    AND p.author_id NOT IN (
      SELECT blocked_id FROM blocks WHERE blocker_id = auth.uid()
      UNION
      SELECT blocker_id FROM blocks WHERE blocked_id = auth.uid()
    )
    AND (
      cursor_created_at IS NULL
      OR l.created_at < cursor_created_at
      OR (l.created_at = cursor_created_at AND l.id > cursor_like_id)
    )
  ORDER BY l.created_at DESC, l.id ASC
  LIMIT result_limit;
END;
$$;

-- Ensure deterministic closest-location selection per post when distances tie.
-- This avoids unstable "last sharer" resolution across pagination calls.

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
      pl.id           AS location_id,
      pl.post_id,
      pl.shared_by_id,
      pl.place_label,
      pl.created_at   AS location_created_at,
      (
        6371000.0 * acos(
          LEAST(1.0,
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
    SELECT DISTINCT ON (post_id)
      post_id,
      location_id,
      shared_by_id   AS closest_sharer_id,
      place_label    AS closest_place_label,
      dist_m
    FROM within_radius
    ORDER BY post_id, dist_m ASC, location_created_at DESC, location_id ASC
  ),
  feed_rows AS (
    SELECT
      cpp.post_id,
      p.content,
      p.author_id,
      author_pr.nickname               AS author_nickname,
      cpp.closest_sharer_id            AS last_sharer_id,
      sharer_pr.nickname               AS last_sharer_nickname,
      cpp.closest_place_label          AS place_label,
      cpp.dist_m                       AS distance_meters,
      p.last_activity_at,
      COALESCE(lc.like_count, 0)       AS like_count,
      (
        auth.uid() IS NOT NULL AND EXISTS (
          SELECT 1 FROM likes l
          WHERE l.post_id = cpp.post_id
            AND l.user_id = auth.uid()
        )
      )                                AS my_like
    FROM closest_per_post cpp
    JOIN posts p ON p.id = cpp.post_id
    JOIN profiles author_pr ON author_pr.id = p.author_id
    JOIN profiles sharer_pr ON sharer_pr.id = cpp.closest_sharer_id
    LEFT JOIN post_like_counts lc ON lc.post_id = cpp.post_id
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


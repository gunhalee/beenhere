-- Nearby feed liker-display update (2026-04-10)
-- Adds ordered liker nickname arrays for "Liked by" rendering.

DROP FUNCTION IF EXISTS public.list_nearby_feed(
  double precision,
  double precision,
  double precision,
  double precision,
  timestamptz,
  uuid,
  integer
);

CREATE FUNCTION public.list_nearby_feed(
  viewer_lat double precision,
  viewer_lng double precision,
  radius_meters double precision DEFAULT 10000,
  cursor_distance_meters double precision DEFAULT NULL,
  cursor_last_activity_at timestamptz DEFAULT NULL,
  cursor_post_id uuid DEFAULT NULL,
  result_limit int DEFAULT 21
)
RETURNS TABLE (
  post_id uuid,
  content text,
  author_id uuid,
  author_nickname text,
  last_sharer_id uuid,
  last_sharer_nickname text,
  place_label text,
  distance_meters double precision,
  last_activity_at timestamptz,
  original_place_label text,
  original_distance_meters double precision,
  original_created_at timestamptz,
  like_count bigint,
  my_like boolean,
  liker_user_ids text[],
  liker_nicknames text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      pl.created_at AS location_created_at,
      (
        6371000.0 * acos(
          LEAST(
            1.0,
            cos(radians(viewer_lat)) * cos(radians(pl.latitude))
            * cos(radians(pl.longitude) - radians(viewer_lng))
            + sin(radians(viewer_lat)) * sin(radians(pl.latitude))
          )
        )
      )::double precision AS dist_m
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
      wr.location_created_at AS closest_shared_at,
      wr.dist_m
    FROM within_radius wr
    ORDER BY wr.post_id, wr.dist_m ASC, wr.location_created_at DESC, wr.location_id ASC
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
      orig_loc.place_label AS original_place_label,
      CASE
        WHEN orig_loc.latitude IS NULL OR orig_loc.longitude IS NULL THEN NULL
        ELSE (
          6371000.0 * acos(
            LEAST(
              1.0,
              cos(radians(viewer_lat)) * cos(radians(orig_loc.latitude))
              * cos(radians(orig_loc.longitude) - radians(viewer_lng))
              + sin(radians(viewer_lat)) * sin(radians(orig_loc.latitude))
            )
          )
        )::double precision
      END AS original_distance_meters,
      p.created_at AS original_created_at,
      COALESCE(lc.like_count, 0) AS like_count,
      (
        auth.uid() IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM likes l
          WHERE l.post_id = cpp.post_id
            AND l.user_id = auth.uid()
        )
      ) AS my_like,
      COALESCE(liker_meta.liker_user_ids, ARRAY[]::text[]) AS liker_user_ids,
      COALESCE(liker_meta.liker_nicknames, ARRAY[]::text[]) AS liker_nicknames
    FROM closest_per_post cpp
    JOIN posts p ON p.id = cpp.post_id
    JOIN profiles author_pr ON author_pr.id = p.author_id
    JOIN profiles sharer_pr ON sharer_pr.id = cpp.closest_sharer_id
    LEFT JOIN post_like_counts lc ON lc.post_id = cpp.post_id
    LEFT JOIN LATERAL (
      SELECT
        ARRAY_AGG(
          liker_entry.user_id_text
          ORDER BY
            liker_entry.viewer_priority ASC,
            liker_entry.dist_m ASC,
            liker_entry.liked_at DESC,
            liker_entry.like_id ASC
        ) AS liker_user_ids,
        ARRAY_AGG(
          liker_entry.nickname
          ORDER BY
            liker_entry.viewer_priority ASC,
            liker_entry.dist_m ASC,
            liker_entry.liked_at DESC,
            liker_entry.like_id ASC
        ) AS liker_nicknames
      FROM (
        SELECT
          l.id AS like_id,
          l.created_at AS liked_at,
          l.user_id::text AS user_id_text,
          liker_pr.nickname,
          CASE
            WHEN auth.uid() IS NOT NULL AND l.user_id = auth.uid() THEN 0
            ELSE 1
          END AS viewer_priority,
          (
            6371000.0 * acos(
              LEAST(
                1.0,
                cos(radians(viewer_lat)) * cos(radians(like_loc.latitude))
                * cos(radians(like_loc.longitude) - radians(viewer_lng))
                + sin(radians(viewer_lat)) * sin(radians(like_loc.latitude))
              )
            )
          )::double precision AS dist_m
        FROM likes l
        JOIN post_locations like_loc ON like_loc.id = l.post_location_id
        JOIN profiles liker_pr ON liker_pr.id = l.user_id
        WHERE l.post_id = cpp.post_id
          AND l.user_id NOT IN (SELECT uid FROM blocked_ids)
      ) liker_entry
    ) liker_meta ON true
    LEFT JOIN LATERAL (
      SELECT
        pl.place_label,
        pl.latitude,
        pl.longitude
      FROM post_locations pl
      WHERE pl.post_id = cpp.post_id
        AND pl.shared_by_id = p.author_id
      ORDER BY pl.created_at ASC
      LIMIT 1
    ) orig_loc ON true
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
    fr.original_place_label,
    fr.original_distance_meters,
    fr.original_created_at,
    fr.like_count,
    fr.my_like,
    fr.liker_user_ids,
    fr.liker_nicknames
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

GRANT EXECUTE ON FUNCTION public.list_nearby_feed(
  double precision,
  double precision,
  double precision,
  double precision,
  timestamptz,
  uuid,
  integer
) TO anon, authenticated;

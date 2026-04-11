-- Split nearby feed read path into page, metadata, and preview RPCs.
-- Goal:
-- 1) cheap radius probing / pagination
-- 2) metadata enrichment only for selected post ids
-- 3) optional liker preview batch path

CREATE OR REPLACE FUNCTION public.list_nearby_feed_page(
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
  distance_meters double precision,
  last_activity_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH blocked_ids AS (
    SELECT blocked_id AS uid FROM blocks WHERE blocker_id = auth.uid()
    UNION
    SELECT blocker_id AS uid FROM blocks WHERE blocked_id = auth.uid()
  ),
  candidate_locations AS (
    SELECT
      pl.id AS location_id,
      pl.post_id,
      pl.shared_by_id,
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
      wr.dist_m AS distance_meters
    FROM within_radius wr
    ORDER BY wr.post_id, wr.dist_m ASC, wr.location_created_at DESC, wr.location_id ASC
  ),
  page_rows AS (
    SELECT
      cpp.post_id,
      cpp.distance_meters,
      p.last_activity_at
    FROM closest_per_post cpp
    JOIN posts p ON p.id = cpp.post_id
  )
  SELECT
    pr.post_id,
    pr.distance_meters,
    pr.last_activity_at
  FROM page_rows pr
  WHERE
    cursor_distance_meters IS NULL
    OR (
      pr.distance_meters > cursor_distance_meters
      OR (
        pr.distance_meters = cursor_distance_meters
        AND pr.last_activity_at < cursor_last_activity_at
      )
      OR (
        pr.distance_meters = cursor_distance_meters
        AND pr.last_activity_at = cursor_last_activity_at
        AND pr.post_id > cursor_post_id
      )
    )
  ORDER BY
    pr.distance_meters ASC,
    pr.last_activity_at DESC,
    pr.post_id ASC
  LIMIT result_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_feed_post_metadata_batch(
  viewer_lat double precision,
  viewer_lng double precision,
  post_ids uuid[]
)
RETURNS TABLE (
  post_id uuid,
  content text,
  author_id uuid,
  author_nickname text,
  place_label text,
  distance_meters double precision,
  created_at timestamptz,
  like_count bigint,
  my_like boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH blocked_ids AS (
    SELECT blocked_id AS uid FROM blocks WHERE blocker_id = auth.uid()
    UNION
    SELECT blocker_id AS uid FROM blocks WHERE blocked_id = auth.uid()
  ),
  input_posts AS (
    SELECT DISTINCT unnest(post_ids) AS post_id
  )
  SELECT
    p.id AS post_id,
    p.content,
    p.author_id,
    author_pr.nickname AS author_nickname,
    orig_loc.place_label,
    (
      6371000.0 * acos(
        LEAST(
          1.0,
          cos(radians(viewer_lat)) * cos(radians(orig_loc.latitude))
          * cos(radians(orig_loc.longitude) - radians(viewer_lng))
          + sin(radians(viewer_lat)) * sin(radians(orig_loc.latitude))
        )
      )
    )::double precision AS distance_meters,
    p.created_at,
    COALESCE(lc.like_count, 0) AS like_count,
    (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM likes l
        WHERE l.post_id = p.id
          AND l.user_id = auth.uid()
      )
    ) AS my_like
  FROM input_posts ip
  JOIN posts p ON p.id = ip.post_id
  JOIN profiles author_pr ON author_pr.id = p.author_id
  LEFT JOIN post_like_counts lc ON lc.post_id = p.id
  LEFT JOIN LATERAL (
    SELECT
      pl.place_label,
      pl.latitude,
      pl.longitude
    FROM post_locations pl
    WHERE pl.post_id = p.id
      AND pl.shared_by_id = p.author_id
    ORDER BY pl.created_at ASC
    LIMIT 1
  ) orig_loc ON true
  WHERE
    p.status = 'active'
    AND p.active_until > now()
    AND p.author_id NOT IN (SELECT uid FROM blocked_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_feed_post_likers_preview_batch(
  viewer_lat double precision,
  viewer_lng double precision,
  post_ids uuid[]
)
RETURNS TABLE (
  post_id uuid,
  liker_user_ids text[],
  liker_nicknames text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH blocked_ids AS (
    SELECT blocked_id AS uid FROM blocks WHERE blocker_id = auth.uid()
    UNION
    SELECT blocker_id AS uid FROM blocks WHERE blocked_id = auth.uid()
  ),
  input_posts AS (
    SELECT DISTINCT unnest(post_ids) AS post_id
  )
  SELECT
    ip.post_id,
    COALESCE(liker_meta.liker_user_ids, ARRAY[]::text[]) AS liker_user_ids,
    COALESCE(liker_meta.liker_nicknames, ARRAY[]::text[]) AS liker_nicknames
  FROM input_posts ip
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
      WHERE l.post_id = ip.post_id
        AND l.user_id NOT IN (SELECT uid FROM blocked_ids)
    ) liker_entry
  ) liker_meta ON true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_nearby_feed_page(
  double precision,
  double precision,
  double precision,
  double precision,
  timestamptz,
  uuid,
  integer
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_feed_post_metadata_batch(
  double precision,
  double precision,
  uuid[]
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_feed_post_likers_preview_batch(
  double precision,
  double precision,
  uuid[]
) TO anon, authenticated;

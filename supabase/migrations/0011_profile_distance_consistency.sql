-- Profile distance consistency patch (2026-04-09)
-- Adds optional viewer coordinates to profile list RPCs and returns distance_meters.

DROP FUNCTION IF EXISTS public.get_profile_posts(uuid, uuid, timestamptz, integer);
DROP FUNCTION IF EXISTS public.get_profile_posts(
  uuid,
  uuid,
  timestamptz,
  integer,
  double precision,
  double precision
);

CREATE FUNCTION public.get_profile_posts(
  target_user_id uuid,
  cursor_post_id uuid DEFAULT NULL,
  cursor_created_at timestamptz DEFAULT NULL,
  result_limit int DEFAULT 21,
  viewer_lat double precision DEFAULT NULL,
  viewer_lng double precision DEFAULT NULL
)
RETURNS TABLE (
  post_id uuid,
  content text,
  place_label text,
  distance_meters double precision,
  last_activity_at timestamptz,
  post_created_at timestamptz,
  like_count bigint,
  my_like boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    CASE
      WHEN viewer_lat IS NULL
        OR viewer_lng IS NULL
        OR orig_loc.latitude IS NULL
        OR orig_loc.longitude IS NULL
      THEN NULL
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
    END AS distance_meters,
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

DROP FUNCTION IF EXISTS public.get_profile_likes(uuid, uuid, timestamptz, integer);
DROP FUNCTION IF EXISTS public.get_profile_likes(
  uuid,
  uuid,
  timestamptz,
  integer,
  double precision,
  double precision
);

CREATE FUNCTION public.get_profile_likes(
  target_user_id uuid,
  cursor_like_id uuid DEFAULT NULL,
  cursor_created_at timestamptz DEFAULT NULL,
  result_limit int DEFAULT 21,
  viewer_lat double precision DEFAULT NULL,
  viewer_lng double precision DEFAULT NULL
)
RETURNS TABLE (
  post_id uuid,
  content text,
  author_id uuid,
  author_nickname text,
  place_label text,
  distance_meters double precision,
  last_activity_at timestamptz,
  like_id uuid,
  like_created_at timestamptz,
  like_count bigint,
  my_like boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    p.author_id,
    author_pr.nickname AS author_nickname,
    like_loc.place_label,
    CASE
      WHEN viewer_lat IS NULL OR viewer_lng IS NULL THEN NULL
      ELSE (
        6371000.0 * acos(
          LEAST(
            1.0,
            cos(radians(viewer_lat)) * cos(radians(like_loc.latitude))
            * cos(radians(like_loc.longitude) - radians(viewer_lng))
            + sin(radians(viewer_lat)) * sin(radians(like_loc.latitude))
          )
        )
      )::double precision
    END AS distance_meters,
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

GRANT EXECUTE ON FUNCTION public.get_profile_posts(
  uuid,
  uuid,
  timestamp with time zone,
  integer,
  double precision,
  double precision
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_profile_likes(
  uuid,
  uuid,
  timestamp with time zone,
  integer,
  double precision,
  double precision
) TO anon, authenticated;

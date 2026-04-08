-- get_profile_posts: avoid ambiguous reference with RETURNS TABLE output variable.
-- In PL/pgSQL, output columns are visible as variables. Unqualified
-- "place_label" inside the lateral subquery can clash with the output variable.

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
  -- blocked relationship check (both directions)
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
  FROM posts p
  LEFT JOIN LATERAL (
    SELECT pl.place_label
    FROM post_locations pl
    WHERE pl.post_id = p.id
      AND pl.shared_by_id = p.author_id
    ORDER BY pl.created_at ASC
    LIMIT 1
  ) orig_loc ON true
  LEFT JOIN post_like_counts lc ON lc.post_id = p.id
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

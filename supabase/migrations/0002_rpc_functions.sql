-- =============================================================
-- beenhere — 핵심 RPC 함수
-- =============================================================
-- 모든 함수는 SECURITY DEFINER로 실행되어 RLS를 우회하고
-- 내부에서 auth.uid()로 호출자를 검증한다.
-- =============================================================

-- =============================================================
-- 헬퍼: 차단 관계 조회
-- =============================================================
-- 뷰로 만들지 않고 인라인 CTE로 사용 (뷰는 auth.uid() 캐싱 문제)

-- =============================================================
-- 1. create_post
-- =============================================================
-- 글 작성 + 최초 post_location 생성을 원자적으로 처리.
-- 위치 정보는 앱에서 100m 격자로 양자화한 뒤 전달한다.

CREATE OR REPLACE FUNCTION create_post(
  p_content     text,
  p_latitude    float8,
  p_longitude   float8,
  p_place_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post_id uuid;
BEGIN
  -- 인증 확인
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  -- 글 저장
  INSERT INTO posts (author_id, content)
  VALUES (auth.uid(), p_content)
  RETURNING id INTO v_post_id;

  -- 최초 좌표 저장 (shared_by = 원작성자)
  INSERT INTO post_locations (post_id, shared_by_id, latitude, longitude, place_label)
  VALUES (v_post_id, auth.uid(), p_latitude, p_longitude, p_place_label);

  RETURN jsonb_build_object('post_id', v_post_id);
END;
$$;

-- =============================================================
-- 2. like_post
-- =============================================================
-- 라이크 = 재공유.
--   1. 새 post_location을 라이커의 현재 위치에 생성한다.
--   2. likes 레코드를 생성한다.
--   3. posts.last_activity_at과 posts.active_until을 갱신한다.
--
-- 오류 코드:
--   P0001 — 미인증
--   P0002 — 이미 라이크한 글
--   P0003 — 존재하지 않거나 비활성 글
--   P0004 — 자신의 글에 라이크 불가

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
  -- 인증 확인
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  -- 글 존재·활성 상태 확인 + 자기 글 라이크 방지
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

  -- 중복 라이크 확인
  IF EXISTS (
    SELECT 1 FROM likes
    WHERE post_id = p_post_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Already liked' USING ERRCODE = 'P0002';
  END IF;

  -- 재공유 좌표 생성
  INSERT INTO post_locations (post_id, shared_by_id, latitude, longitude, place_label)
  VALUES (p_post_id, auth.uid(), p_latitude, p_longitude, p_place_label)
  RETURNING id INTO v_location_id;

  -- 라이크 기록 생성
  INSERT INTO likes (post_id, user_id, post_location_id)
  VALUES (p_post_id, auth.uid(), v_location_id);

  -- 글 활성 기간 갱신 (last_activity_at = now, active_until = now + 30일)
  UPDATE posts
  SET
    last_activity_at = now(),
    active_until     = now() + interval '30 days'
  WHERE id = p_post_id;

  -- 최신 라이크 수 반환
  SELECT COUNT(*) INTO v_like_count
  FROM likes
  WHERE post_id = p_post_id;

  RETURN jsonb_build_object('like_count', v_like_count);
END;
$$;

-- =============================================================
-- 3. list_nearby_feed
-- =============================================================
-- 위치 기반 피드 조회.
--
-- 정렬: 거리 ASC → 최신 활동 DESC → post_id ASC (tiebreaker)
--
-- 중복 제거(PRD 9.1):
--   동일 글이 10km 내 여러 좌표에 존재해도 가장 가까운 좌표 1개만 노출.
--   "직전 공유자"는 해당 가장 가까운 좌표의 shared_by_id.
--
-- 차단 필터:
--   차단 관계에 있는 사용자가 작성하거나 직전 공유한 글은 숨긴다.
--   (단 원작성자가 차단 대상이 아닌데 공유자만 차단인 경우도 숨긴다 — PRD 7.8)
--
-- 커서 방식: (distance_meters ASC, last_activity_at DESC, post_id ASC)
--   다음 페이지 조건:
--     distance > cur_dist
--     OR (distance = cur_dist AND last_activity_at < cur_activity)
--     OR (distance = cur_dist AND last_activity_at = cur_activity AND post_id > cur_id)

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
  -- 차단 관계: 뷰어와 차단 관계에 있는 모든 user_id
  blocked_ids AS (
    SELECT blocked_id AS uid FROM blocks WHERE blocker_id = auth.uid()
    UNION
    SELECT blocker_id AS uid FROM blocks WHERE blocked_id = auth.uid()
  ),
  -- 활성 글의 모든 좌표 + 거리 계산
  candidate_locations AS (
    SELECT
      pl.id           AS location_id,
      pl.post_id,
      pl.shared_by_id,
      pl.place_label,
      -- Haversine 근사 거리 (단위: 미터)
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
      p.status       = 'active'
      AND p.active_until > now()
      -- 차단된 원작성자의 글 제외
      AND p.author_id NOT IN (SELECT uid FROM blocked_ids)
      -- 차단된 사람이 공유한 좌표 제외
      AND pl.shared_by_id NOT IN (SELECT uid FROM blocked_ids)
  ),
  -- 10km 내 좌표만 필터
  within_radius AS (
    SELECT * FROM candidate_locations
    WHERE dist_m <= radius_meters
  ),
  -- 글 단위 중복 제거: post_id별 가장 가까운 좌표 1개 선택
  closest_per_post AS (
    SELECT DISTINCT ON (post_id)
      post_id,
      location_id,
      shared_by_id   AS closest_sharer_id,
      place_label    AS closest_place_label,
      dist_m
    FROM within_radius
    ORDER BY post_id, dist_m ASC
  ),
  -- 피드 행 조립
  feed_rows AS (
    SELECT
      cpp.post_id,
      p.content,
      p.author_id,
      author_pr.nickname              AS author_nickname,
      cpp.closest_sharer_id          AS last_sharer_id,
      sharer_pr.nickname              AS last_sharer_nickname,
      cpp.closest_place_label         AS place_label,
      cpp.dist_m                      AS distance_meters,
      p.last_activity_at,
      COALESCE(lc.like_count, 0)      AS like_count,
      (
        auth.uid() IS NOT NULL AND EXISTS (
          SELECT 1 FROM likes l
          WHERE l.post_id = cpp.post_id
            AND l.user_id = auth.uid()
        )
      )                               AS my_like
    FROM closest_per_post cpp
    JOIN posts   p         ON p.id         = cpp.post_id
    JOIN profiles author_pr ON author_pr.id = p.author_id
    JOIN profiles sharer_pr ON sharer_pr.id = cpp.closest_sharer_id
    LEFT JOIN post_like_counts lc ON lc.post_id = cpp.post_id
  )
  SELECT *
  FROM feed_rows
  WHERE
    -- 커서 조건 (커서가 없으면 처음부터)
    cursor_distance_meters IS NULL
    OR (
      distance_meters > cursor_distance_meters
      OR (
        distance_meters = cursor_distance_meters
        AND last_activity_at < cursor_last_activity_at
      )
      OR (
        distance_meters     = cursor_distance_meters
        AND last_activity_at = cursor_last_activity_at
        AND post_id         > cursor_post_id
      )
    )
  ORDER BY
    distance_meters   ASC,
    last_activity_at  DESC,
    post_id           ASC
  LIMIT result_limit;
END;
$$;

-- =============================================================
-- 4. get_profile_posts
-- =============================================================
-- 특정 사용자가 작성한 글 목록 (프로필 탐색용).
-- active_until 만료 여부와 무관하게 status = 'active' 인 글 전부 반환.
-- 차단 관계에 있으면 빈 결과 반환.

CREATE OR REPLACE FUNCTION get_profile_posts(
  target_user_id uuid,
  cursor_post_id uuid        DEFAULT NULL,
  cursor_created_at timestamptz DEFAULT NULL,
  result_limit   int         DEFAULT 21
)
RETURNS TABLE (
  post_id          uuid,
  content          text,
  place_label      text,   -- 원작성 위치 라벨 (최초 post_location)
  last_activity_at timestamptz,
  post_created_at  timestamptz, -- 커서용
  like_count       bigint,
  my_like          boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 차단 관계 확인 (어느 방향이든)
  IF EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = target_user_id)
       OR (blocker_id = target_user_id AND blocked_id = auth.uid())
  ) THEN
    RETURN; -- 빈 결과
  END IF;

  RETURN QUERY
  SELECT
    p.id                            AS post_id,
    p.content,
    orig_loc.place_label,
    p.last_activity_at,
    p.created_at                    AS post_created_at,
    COALESCE(lc.like_count, 0)      AS like_count,
    (
      auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM likes l
        WHERE l.post_id = p.id
          AND l.user_id = auth.uid()
      )
    )                               AS my_like
  FROM posts p
  -- 최초 좌표 (shared_by_id = author_id)를 장소 라벨로 사용
  LEFT JOIN LATERAL (
    SELECT place_label
    FROM post_locations pl
    WHERE pl.post_id     = p.id
      AND pl.shared_by_id = p.author_id
    ORDER BY pl.created_at ASC
    LIMIT 1
  ) orig_loc ON true
  LEFT JOIN post_like_counts lc ON lc.post_id = p.id
  WHERE
    p.author_id = target_user_id
    AND p.status = 'active'
    -- 커서
    AND (
      cursor_created_at IS NULL
      OR p.created_at < cursor_created_at
      OR (p.created_at = cursor_created_at AND p.id > cursor_post_id)
    )
  ORDER BY p.created_at DESC, p.id ASC
  LIMIT result_limit;
END;
$$;

-- =============================================================
-- 5. get_profile_likes
-- =============================================================
-- 특정 사용자가 라이크한 글 목록 (프로필 탐색용).
-- 마찬가지로 active_until 만료 무관, 차단 관계면 빈 결과.

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
  place_label      text,   -- 라이크한 위치 라벨
  last_activity_at timestamptz,
  like_id          uuid,        -- 커서용
  like_created_at  timestamptz, -- 커서용
  like_count       bigint,
  my_like          boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 차단 관계 확인
  IF EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = target_user_id)
       OR (blocker_id = target_user_id AND blocked_id = auth.uid())
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id                          AS post_id,
    p.content,
    p.author_id,
    author_pr.nickname            AS author_nickname,
    like_loc.place_label,
    p.last_activity_at,
    l.id                          AS like_id,
    l.created_at                  AS like_created_at,
    COALESCE(lc.like_count, 0)    AS like_count,
    (
      auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM likes l2
        WHERE l2.post_id = p.id
          AND l2.user_id = auth.uid()
      )
    )                             AS my_like
  FROM likes l
  JOIN posts    p         ON p.id         = l.post_id
  JOIN profiles author_pr ON author_pr.id = p.author_id
  -- 라이크 시 생성된 post_location에서 장소 라벨 가져오기
  JOIN post_locations like_loc ON like_loc.id = l.post_location_id
  LEFT JOIN post_like_counts lc ON lc.post_id = p.id
  WHERE
    l.user_id  = target_user_id
    AND p.status = 'active'
    -- 원작성자가 차단된 경우 제외
    AND p.author_id NOT IN (
      SELECT blocked_id FROM blocks WHERE blocker_id = auth.uid()
      UNION
      SELECT blocker_id FROM blocks WHERE blocked_id = auth.uid()
    )
    -- 커서
    AND (
      cursor_created_at IS NULL
      OR l.created_at < cursor_created_at
      OR (l.created_at = cursor_created_at AND l.id > cursor_like_id)
    )
  ORDER BY l.created_at DESC, l.id ASC
  LIMIT result_limit;
END;
$$;

-- =============================================================
-- 6. get_post_likers  (작성자 전용)
-- =============================================================
-- 내 글을 라이크한 사람 목록. 작성자 본인만 호출 가능.
-- 차단 관계에 있는 사람은 목록에서 제외된다(PRD 7.8).

CREATE OR REPLACE FUNCTION get_post_likers(
  p_post_id         uuid,
  cursor_like_id    uuid        DEFAULT NULL,
  cursor_created_at timestamptz DEFAULT NULL,
  result_limit      int         DEFAULT 51
)
RETURNS TABLE (
  user_id          uuid,
  nickname         text,
  liked_at         timestamptz,
  like_id          uuid,   -- 커서용
  like_place_label text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 작성자 본인 확인
  IF NOT EXISTS (
    SELECT 1 FROM posts
    WHERE id = p_post_id AND author_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    l.user_id,
    pr.nickname,
    l.created_at  AS liked_at,
    l.id          AS like_id,
    pl.place_label AS like_place_label
  FROM likes l
  JOIN profiles       pr ON pr.id = l.user_id
  JOIN post_locations pl ON pl.id = l.post_location_id
  WHERE
    l.post_id = p_post_id
    -- 차단 관계의 라이커는 목록에서 제외
    AND l.user_id NOT IN (
      SELECT blocked_id FROM blocks WHERE blocker_id = auth.uid()
      UNION
      SELECT blocker_id FROM blocks WHERE blocked_id = auth.uid()
    )
    -- 커서
    AND (
      cursor_created_at IS NULL
      OR l.created_at < cursor_created_at
      OR (l.created_at = cursor_created_at AND l.id > cursor_like_id)
    )
  ORDER BY l.created_at DESC, l.id ASC
  LIMIT result_limit;
END;
$$;

-- =============================================================
-- 7. delete_post  (작성자 전용)
-- =============================================================
-- posts.status = 'deleted' 로 변경.
-- post_locations는 RLS가 status='active' 조건으로 자동 비노출.

CREATE OR REPLACE FUNCTION delete_post(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE posts
  SET status = 'deleted'
  WHERE id = p_post_id
    AND author_id = auth.uid()
    AND status    = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found or already deleted' USING ERRCODE = 'P0003';
  END IF;
END;
$$;

-- =============================================================
-- 8. report_post
-- =============================================================

CREATE OR REPLACE FUNCTION report_post(
  p_post_id     uuid,
  p_reason_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO reports (post_id, reporter_id, reason_code)
  VALUES (p_post_id, auth.uid(), p_reason_code)
  ON CONFLICT (post_id, reporter_id) DO NOTHING;
END;
$$;

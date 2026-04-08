-- =============================================================
-- beenhere — 초기 스키마
-- =============================================================
-- 설계 원칙
--   1. 글(post)은 여러 좌표(post_locations)에 동시에 존재할 수 있다.
--   2. 라이크는 반드시 재공유(새 post_location 생성)를 수반한다.
--   3. 노출 기간(active_until)은 글 단위로 관리되며, 라이크마다 30일 갱신된다.
--   4. 차단 관계는 양방향으로 피드·프로필 노출을 차단한다.
--   5. 좌표는 서버 내부에서만 사용하며 클라이언트에 직접 노출하지 않는다 (PRD 9.4).
-- =============================================================

-- =============================================================
-- 1. PROFILES
-- =============================================================
-- auth.users 와 1:1 연결. 공개 프로필은 닉네임만 포함한다.

CREATE TABLE profiles (
  id                  uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname            text        NOT NULL UNIQUE CHECK (char_length(nickname) BETWEEN 2 AND 30),
  -- 닉네임 재생성 쿨다운 관리. NULL이면 한 번도 재생성하지 않은 상태.
  nickname_changed_at timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  profiles                      IS '사용자 공개 프로필. auth.users와 1:1 매핑.';
COMMENT ON COLUMN profiles.nickname             IS '랜덤 생성된 공개 닉네임. 계정당 하나만 활성 상태로 유지.';
COMMENT ON COLUMN profiles.nickname_changed_at  IS '마지막 닉네임 재생성 시각. 쿨다운 판정에 사용.';

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_public_read"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_self_update"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_self_insert"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =============================================================
-- 2. POSTS
-- =============================================================
-- 글의 원본(내용, 작성자, 수명).
-- 위치 정보는 post_locations 에 분리 저장한다.

CREATE TABLE posts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id        uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content          text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 300),

  -- 'active'  : 정상 노출
  -- 'deleted' : 작성자 삭제 — 모든 좌표 비노출
  -- 'hidden'  : 운영자 조치 — 모든 좌표 비노출
  status           text        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'deleted', 'hidden')),

  -- 마지막 활동(작성 또는 라이크) 시각 — UI 상대시간 표시에 사용
  last_activity_at timestamptz NOT NULL DEFAULT now(),

  -- 지리 피드 노출 종료 시각 = last_activity_at + 30일
  -- 라이크가 발생할 때마다 now() + 30일로 갱신된다
  active_until     timestamptz NOT NULL DEFAULT now() + interval '30 days',

  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  posts                  IS '글 원본. 위치와 분리되어 있으며, 여러 post_locations에 참조된다.';
COMMENT ON COLUMN posts.last_activity_at IS '작성 또는 가장 최근 라이크 시각. 피드 표시용 상대시간 기준.';
COMMENT ON COLUMN posts.active_until     IS '지리 피드 노출 종료 시각. 라이크마다 now()+30일로 갱신됨.';

CREATE INDEX idx_posts_author_id    ON posts(author_id);
CREATE INDEX idx_posts_active_until ON posts(active_until) WHERE status = 'active';
CREATE INDEX idx_posts_status       ON posts(status);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts_active_public_read"
  ON posts FOR SELECT
  USING (status = 'active');

CREATE POLICY "posts_self_insert"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- 작성자는 자신의 글을 'deleted'로만 바꿀 수 있다
-- 운영자 'hidden' 처리는 service_role 또는 별도 admin 정책으로 수행
CREATE POLICY "posts_self_delete"
  ON posts FOR UPDATE
  USING (auth.uid() = author_id AND status = 'active')
  WITH CHECK (status = 'deleted');

-- =============================================================
-- 3. POST_LOCATIONS
-- =============================================================
-- 글이 지도 위에 존재하는 각각의 좌표 핀.
--
-- 글 작성 시  → 1개 생성 (shared_by_id = author_id)
-- 라이크 시   → 1개 추가 생성 (shared_by_id = 라이크한 사용자)
--
-- "직전 공유자" = 피드에서 보여주는 해당 좌표의 shared_by_id.
-- 피드에서 한 글을 한 번만 보여줄 때는 가장 가까운 좌표의 shared_by_id를 사용한다.

CREATE TABLE post_locations (
  id                    uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id               uuid    NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

  -- 이 좌표를 만든 사람 (원작성자 또는 라이크한 사람)
  shared_by_id          uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- 정밀 좌표 (서버 내부 거리 계산용, 클라이언트에 직접 노출 안 함 — PRD 9.4)
  latitude              float8  NOT NULL,
  longitude             float8  NOT NULL,

  -- 사용자에게 표시하는 장소 라벨.
  -- 행정동(洞) 단위보다 느슨한 구(區) 수준 또는 광역 지명으로 저장한다.
  -- 예: "마포구", "해운대구", "제주시"
  -- 앱 레이어에서 역지오코딩 후 문자열로 전달받아 저장한다.
  place_label           text    NOT NULL,

  created_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  post_locations              IS '글이 지도에 존재하는 각 좌표 핀. 글 1개당 여러 개 존재할 수 있다.';
COMMENT ON COLUMN post_locations.shared_by_id IS '이 좌표를 고정한 사람. 원작성자(최초)이거나 라이크한 사람(재공유).';
COMMENT ON COLUMN post_locations.place_label  IS '구(區) 수준 장소 라벨. 행정동 단위 미사용. 앱에서 역지오코딩 후 전달.';

CREATE INDEX idx_post_locations_post_id    ON post_locations(post_id);
CREATE INDEX idx_post_locations_shared_by  ON post_locations(shared_by_id);
-- 위치 기반 피드 쿼리용 — 좌표 인덱스 (Haversine 계산 시 스캔 범위 축소)
CREATE INDEX idx_post_locations_lat_lng    ON post_locations(latitude, longitude);

ALTER TABLE post_locations ENABLE ROW LEVEL SECURITY;

-- 글이 active 상태인 경우만 위치도 공개
CREATE POLICY "post_locations_public_read"
  ON post_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_locations.post_id
        AND posts.status = 'active'
    )
  );

-- 삽입은 RPC 함수(SECURITY DEFINER)가 대신 수행하므로
-- 직접 INSERT는 본인만 허용 (RPC 우회 방어용)
CREATE POLICY "post_locations_self_insert"
  ON post_locations FOR INSERT
  WITH CHECK (auth.uid() = shared_by_id);

-- =============================================================
-- 4. LIKES
-- =============================================================
-- 라이크 = 재공유. 라이크 1건 = post_locations 1건과 항상 1:1 대응.
--
-- 제약:
--   - 한 사용자는 같은 글을 한 번만 라이크할 수 있다 (UNIQUE 제약).
--   - 자기 글 라이크 불가 — like_post RPC에서 체크 (FK 순환 구조상 DB CHECK로 표현 불가).

CREATE TABLE likes (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id          uuid        NOT NULL REFERENCES posts(id)          ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES profiles(id)        ON DELETE CASCADE,
  -- 이 라이크로 생성된 post_location (1:1 관계)
  post_location_id uuid        NOT NULL REFERENCES post_locations(id)  ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),

  UNIQUE (post_id, user_id)
);

COMMENT ON TABLE  likes                  IS '라이크 기록. 각 라이크는 재공유 좌표(post_location)와 1:1 대응.';
COMMENT ON COLUMN likes.post_location_id IS '이 라이크가 생성한 post_location. 라이크 취소 시 해당 좌표도 제거됨.';

CREATE INDEX idx_likes_post_id  ON likes(post_id);
CREATE INDEX idx_likes_user_id  ON likes(user_id);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- 라이크 수는 모두에게 공개 (집계 쿼리용)
CREATE POLICY "likes_public_read"
  ON likes FOR SELECT
  USING (true);

-- 삽입은 RPC 함수(SECURITY DEFINER)가 처리
CREATE POLICY "likes_self_insert"
  ON likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================================
-- 5. BLOCKS
-- =============================================================
-- 차단은 단방향 선언이지만 양방향으로 효과가 적용된다.
-- 피드·프로필·라이크한 사람 목록에서 상호 노출 차단.

CREATE TABLE blocks (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (blocker_id, blocked_id),
  CHECK  (blocker_id <> blocked_id)
);

COMMENT ON TABLE blocks IS '차단 관계. 단방향 선언이지만 피드·프로필에서 양방향 차단 효과.';

CREATE INDEX idx_blocks_blocker_id ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked_id ON blocks(blocked_id);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

-- 내가 차단한 목록만 볼 수 있다 (상대가 나를 차단했는지는 RPC에서 판별)
CREATE POLICY "blocks_self_read"
  ON blocks FOR SELECT
  USING (auth.uid() = blocker_id);

CREATE POLICY "blocks_self_manage"
  ON blocks FOR ALL
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);

-- =============================================================
-- 6. REPORTS
-- =============================================================
-- 사용자 신고. 운영자 검토 후 posts.status = 'hidden' 처리.

CREATE TABLE reports (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid        NOT NULL REFERENCES posts(id)     ON DELETE CASCADE,
  reporter_id uuid        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  reason_code text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (post_id, reporter_id)
);

COMMENT ON TABLE reports IS '게시글 신고. 운영자가 검토 후 posts.status를 hidden으로 변경한다.';

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_self_insert"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- 자신이 신고한 내역만 조회 (중복 신고 방지 UI용)
CREATE POLICY "reports_self_read"
  ON reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- =============================================================
-- 7. VIEWS
-- =============================================================

-- 글별 라이크 수 집계
CREATE VIEW post_like_counts AS
SELECT
  post_id,
  COUNT(*) AS like_count
FROM likes
GROUP BY post_id;

COMMENT ON VIEW post_like_counts IS '글별 라이크 수. 피드 및 프로필에서 JOIN하여 사용.';

// =============================================================
// beenhere — DB Row 타입 (Supabase 테이블/RPC 응답과 1:1 대응)
// =============================================================
// 규칙:
//   - DB 컬럼명은 snake_case 그대로 사용 (변환은 레포지토리 레이어에서)
//   - nullable 컬럼은 명시적으로 null 포함
// =============================================================

// ---------------------------
// profiles
// ---------------------------
export type ProfileRow = {
  id:                  string;
  nickname:            string;
  nickname_changed_at: string | null;
  created_at:          string;
};

// ---------------------------
// posts
// ---------------------------
export type PostStatus = 'active' | 'deleted' | 'hidden';

export type PostRow = {
  id:               string;
  author_id:        string;
  content:          string;
  client_request_id: string | null;
  status:           PostStatus;
  last_activity_at: string;
  active_until:     string;
  created_at:       string;
};

// ---------------------------
// post_locations
// ---------------------------
export type PostLocationRow = {
  id:           string;
  post_id:      string;
  shared_by_id: string;
  latitude:     number;
  longitude:    number;
  place_label:  string;
  created_at:   string;
};

// ---------------------------
// likes
// ---------------------------
export type LikeRow = {
  id:               string;
  post_id:          string;
  user_id:          string;
  post_location_id: string;
  created_at:       string;
};

// ---------------------------
// blocks
// ---------------------------
export type BlockRow = {
  id:         string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

// ---------------------------
// reports
// ---------------------------
export type ReportRow = {
  id:          string;
  post_id:     string;
  reporter_id: string;
  reason_code: string;
  created_at:  string;
};

// ---------------------------
// Views
// ---------------------------
export type PostLikeCountRow = {
  post_id:    string;
  like_count: number;
};

// ---------------------------
// RPC: list_nearby_feed 반환 행
// ---------------------------
export type NearbyFeedRow = {
  post_id:              string;
  content:              string;
  author_id:            string;
  author_nickname:      string;
  last_sharer_id:       string;
  last_sharer_nickname: string;
  place_label:          string;
  distance_meters:      number;
  last_activity_at:     string;
  like_count:           number;
  my_like:              boolean;
};

// ---------------------------
// RPC: get_profile_posts 반환 행
// ---------------------------
export type ProfilePostRow = {
  post_id:          string;
  content:          string;
  place_label:      string | null;
  distance_meters:  number | null;
  last_activity_at: string;
  post_created_at:  string;   // 커서용
  like_count:       number;
  my_like:          boolean;
};

// ---------------------------
// RPC: get_profile_likes 반환 행
// ---------------------------
export type ProfileLikeRow = {
  post_id:          string;
  content:          string;
  author_id:        string;
  author_nickname:  string;
  place_label:      string;
  distance_meters:  number | null;
  last_activity_at: string;
  like_id:          string;   // 커서용
  like_created_at:  string;   // 커서용
  like_count:       number;
  my_like:          boolean;
};

// ---------------------------
// RPC: get_post_likers 반환 행
// ---------------------------
export type PostLikerRow = {
  user_id:          string;
  nickname:         string;
  liked_at:         string;
  like_id:          string;   // 커서용
  like_place_label: string;
};

// ---------------------------
// RPC: create_post 반환
// ---------------------------
export type CreatePostRpcResult = {
  post_id: string;
};

// ---------------------------
// RPC: like_post 반환
// ---------------------------
export type LikePostRpcResult = {
  like_count: number;
};

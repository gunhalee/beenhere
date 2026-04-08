// =============================================================
// beenhere — 도메인(앱 레이어) 타입
// =============================================================
// DB Row 타입을 앱에서 사용하는 camelCase 형태로 변환한 타입.
// UI 컴포넌트와 훅에서는 이 타입을 사용한다.
// =============================================================

// ---------------------------
// 피드 아이템
// ---------------------------
// 피드는 항상 거리 순으로 정렬된다 (PRD 7.5, 사용자 선택 없음)
export type FeedItem = {
  postId:             string;
  content:            string;
  authorId:           string;
  authorNickname:     string;
  // 직전 공유자. authorId와 같으면 UI에서 표시 생략.
  lastSharerId:       string;
  lastSharerNickname: string;
  placeLabel:         string;
  distanceMeters:     number;
  // 사용자에게 표시하는 상대시간 문자열 (예: "3분 전")
  relativeTime:       string;
  likeCount:          number;
  myLike:             boolean;
};

export type FeedState = {
  items:        FeedItem[];
  // API가 반환하는 base64url 인코딩 커서 문자열 (클라이언트는 불투명하게 취급)
  nextCursor:   string | null;
  loading:      boolean;
  loadingMore:  boolean;
  empty:        boolean;
  errorMessage: string | null;
};

// 커서 (distance ASC, last_activity_at DESC, post_id ASC)
export type FeedCursor = {
  distanceMeters:   number;
  lastActivityAt:   string;  // ISO 8601
  postId:           string;
};

// ---------------------------
// 글 작성
// ---------------------------
export type ComposeState = {
  content:           string;
  charCount:         number;
  submitting:        boolean;
  locationResolved:  boolean;
  resolvedPlaceLabel: string | null;
  errorMessage:      string | null;
};

// ---------------------------
// 프로필
// ---------------------------
// 타인에게 공개되는 프로필 정보
export type Profile = {
  id:        string;
  nickname:  string;
  createdAt: string;
};

// 본인만 접근하는 프로필 정보 (닉네임 재생성 쿨다운 판정 등)
export type MyProfile = Profile & {
  nicknameChangedAt: string | null;
};

// 프로필의 작성글 아이템
export type ProfilePostItem = {
  postId:         string;
  content:        string;
  placeLabel:     string | null;
  relativeTime:   string;
  likeCount:      number;
  myLike:         boolean;
};

// 프로필의 라이크한 글 아이템
export type ProfileLikeItem = {
  postId:          string;
  content:         string;
  authorId:        string;
  authorNickname:  string;
  placeLabel:      string;
  relativeTime:    string;
  likeCount:       number;
  myLike:          boolean;
};

// 내 글의 라이커 아이템 (작성자 전용)
export type PostLikerItem = {
  userId:        string;
  nickname:      string;
  likedAt:       string;
  likedAtRelative: string;
  likePlaceLabel: string;
};

// ---------------------------
// 차단
// ---------------------------
export type Block = {
  id:        string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
};

// ---------------------------
// 라이크 결과 (UI 낙관적 업데이트용)
// ---------------------------
export type LikeResult = {
  postId:     string;
  likeCount:  number;
  myLike:     true;
};

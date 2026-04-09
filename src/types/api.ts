// =============================================================
// beenhere — API 요청/응답 타입 (Next.js Route Handler)
// =============================================================

import type { FeedItem, ProfileLikeItem, ProfilePostItem, PostLikerItem } from './domain';

// ---------------------------
// 공통 API 응답 래퍼
// ---------------------------
export type ApiOk<T>  = { ok: true;  data: T };
export type ApiErrorDetails = Record<string, unknown>;
export type ApiErr    = { ok: false; error: string; code?: string; details?: ApiErrorDetails };
export type ApiResult<T> = ApiOk<T> | ApiErr;

// ---------------------------
// POST /api/posts
// ---------------------------
export type CreatePostBody = {
  content:    string;
  latitude:   number;
  longitude:  number;
  // 앱에서 역지오코딩한 구(區) 수준 장소 라벨. 예: "마포구", "해운대구"
  placeLabel: string;
};

export type CreatePostResponse = ApiResult<{ postId: string }>;

// ---------------------------
// POST /api/posts/:postId/like
// ---------------------------
export type LikePostBody = {
  latitude:   number;
  longitude:  number;
  placeLabel: string;
};

export type LikePostResponse = ApiResult<{ likeCount: number }>;

// ---------------------------
// DELETE /api/posts/:postId
// ---------------------------
export type DeletePostResponse = ApiResult<{ postId: string }>;

// ---------------------------
// POST /api/posts/:postId/report
// ---------------------------
export type ReportPostBody = {
  reasonCode: string;
};

export type ReportPostResponse = ApiResult<{ postId: string }>;

// ---------------------------
// GET /api/feed/nearby
// ---------------------------
export type NearbyFeedQuery = {
  latitude:  string;  // number as string (query param)
  longitude: string;
  cursor?:   string;  // base64url encoded FeedCursor
  limit?:    string;
};

export type NearbyFeedResponse = ApiResult<{
  items:      FeedItem[];
  nextCursor: string | null;  // base64url encoded FeedCursor
  stateVersion: string | null;
}>;

// ---------------------------
// GET /api/feed/state
// ---------------------------
export type FeedStateResponse = ApiResult<{
  stateVersion: string;
  refreshedAt: string;
}>;

// ---------------------------
// GET /api/profiles/:userId  (공개 프로필 — 타인도 조회 가능)
// ---------------------------
export type GetProfileResponse = ApiResult<{
  id:       string;
  nickname: string;
}>;

// GET /api/profiles/me  (본인 프로필 — 닉네임 쿨다운 정보 포함)
export type GetMyProfileResponse = ApiResult<{
  id:                 string;
  nickname:           string;
  nicknameChangedAt:  string | null;
}>;

// PATCH /api/profiles/me (닉네임 재생성)
export type RegenerateMyNicknameResponse = ApiResult<{
  nickname: string;
  nicknameChangedAt: string;
}>;

// ---------------------------
// GET /api/profiles/:userId/posts
// ---------------------------
export type GetProfilePostsQuery = {
  cursor?: string;
  limit?:  string;
};

export type GetProfilePostsResponse = ApiResult<{
  items:      ProfilePostItem[];
  nextCursor: string | null;
}>;

// ---------------------------
// GET /api/profiles/:userId/likes
// ---------------------------
export type GetProfileLikesResponse = ApiResult<{
  items:      ProfileLikeItem[];
  nextCursor: string | null;
}>;

// ---------------------------
// GET /api/posts/:postId/likers  (작성자 전용)
// ---------------------------
export type GetPostLikersResponse = ApiResult<{
  items:      PostLikerItem[];
  nextCursor: string | null;
}>;

// ---------------------------
// POST /api/blocks
// ---------------------------
export type CreateBlockBody    = { blockedUserId: string };
export type CreateBlockResponse = ApiResult<{ blocked: true }>;

// ---------------------------
// DELETE /api/blocks/:userId
// ---------------------------
export type DeleteBlockResponse = ApiResult<{ unblocked: true }>;

// ---------------------------
// GET /api/internal/moderation/reports
// ---------------------------
export type ModerationReportItem = {
  reportId: string;
  postId: string;
  reporterId: string;
  reporterNickname: string | null;
  reasonCode: string;
  reportedAt: string;
  postStatus: "active" | "deleted" | "hidden" | null;
  postAuthorId: string | null;
  postContent: string | null;
};

export type InternalModerationReportsResponse = ApiResult<{
  items: ModerationReportItem[];
}>;

// ---------------------------
// POST /api/internal/moderation/reports/:reportId/hide
// ---------------------------
export type InternalModerationHideResponse = ApiResult<{
  reportId: string;
  postId: string;
  hidden: boolean;
  alreadyHidden: boolean;
}>;

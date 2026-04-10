export type ApiOk<T> = { ok: true; data: T };
export type ApiErrorDetails = Record<string, unknown>;
export type ApiErr = {
  ok: false;
  error: string;
  code?: string;
  details?: ApiErrorDetails;
};
export type ApiResult<T> = ApiOk<T> | ApiErr;

export type CreatePostBody = {
  content: string;
  latitude: number;
  longitude: number;
  placeLabel: string;
  clientRequestId?: string;
};

export type LikePostBody = {
  latitude: number;
  longitude: number;
  placeLabel: string;
};

export type ReportPostBody = {
  reasonCode: string;
};

export type CreateBlockBody = {
  blockedUserId: string;
};

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
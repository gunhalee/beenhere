/**
 * 피드 및 포스트 관련 클라이언트 사이드 API 호출 함수.
 * 서버에 직접 fetch하지 않고 이 함수들을 통해 호출한다.
 */

import { fetchApi } from "./client";
import { API_TIMEOUT_CODE } from "./common-errors";
import type { FeedItem } from "@/types/domain";

const FEED_STATE_TIMEOUT_MS = 1200;
const FEED_NEARBY_TIMEOUT_MS = 3000;
const FEED_WRITE_TIMEOUT_MS = 5000;

// ---------------------------
// 피드
// ---------------------------

type FeedData = {
  items: FeedItem[];
  nextCursor: string | null;
  stateVersion: string | null;
};

type FeedStateData = {
  stateVersion: string;
  refreshedAt: string;
};

export async function fetchNearbyFeed(params: {
  latitude: number;
  longitude: number;
  cursor?: string;
  limit?: number;
}) {
  const sp = new URLSearchParams({
    latitude: String(params.latitude),
    longitude: String(params.longitude),
  });
  if (params.cursor) sp.set("cursor", params.cursor);
  if (params.limit != null) sp.set("limit", String(params.limit));

  return fetchApi<FeedData>(`/api/feed/nearby?${sp.toString()}`, {
    timeoutMs: FEED_NEARBY_TIMEOUT_MS,
    timeoutErrorMessage: "피드 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
    timeoutCode: API_TIMEOUT_CODE.TIMEOUT_NEARBY,
  });
}

export async function fetchFeedState() {
  return fetchApi<FeedStateData>("/api/feed/state", {
    timeoutMs: FEED_STATE_TIMEOUT_MS,
    timeoutErrorMessage: "피드 상태 확인이 지연되고 있어요.",
    timeoutCode: API_TIMEOUT_CODE.TIMEOUT_STATE,
  });
}

// ---------------------------
// 포스트 작성
// ---------------------------

export async function createPostClient(body: {
  content: string;
  latitude: number;
  longitude: number;
  placeLabel: string;
}) {
  return fetchApi<{ postId: string }>("/api/posts", {
    method: "POST",
    body,
    timeoutMs: FEED_WRITE_TIMEOUT_MS,
    timeoutErrorMessage: "글 작성 요청이 지연되고 있어요. 다시 시도해 주세요.",
    timeoutCode: API_TIMEOUT_CODE.TIMEOUT_POST_CREATE,
  });
}

// ---------------------------
// 라이크
// ---------------------------

export async function likePostClient(
  postId: string,
  body: { latitude: number; longitude: number; placeLabel: string },
) {
  return fetchApi<{ likeCount: number }>(`/api/posts/${postId}/like`, {
    method: "POST",
    body,
    timeoutMs: FEED_WRITE_TIMEOUT_MS,
    timeoutErrorMessage: "라이크 요청이 지연되고 있어요. 다시 시도해 주세요.",
    timeoutCode: API_TIMEOUT_CODE.TIMEOUT_POST_LIKE,
  });
}

// ---------------------------
// 삭제
// ---------------------------

export async function deletePostClient(postId: string) {
  return fetchApi<{ postId: string }>(`/api/posts/${postId}`, {
    method: "DELETE",
    timeoutMs: FEED_WRITE_TIMEOUT_MS,
    timeoutErrorMessage: "삭제 요청이 지연되고 있어요. 다시 시도해 주세요.",
    timeoutCode: API_TIMEOUT_CODE.TIMEOUT_POST_DELETE,
  });
}

// ---------------------------
// 신고
// ---------------------------

export async function reportPostClient(postId: string, reasonCode: string) {
  return fetchApi<{ postId: string }>(`/api/posts/${postId}/report`, {
    method: "POST",
    body: { reasonCode },
    timeoutMs: FEED_WRITE_TIMEOUT_MS,
    timeoutErrorMessage: "신고 요청이 지연되고 있어요. 다시 시도해 주세요.",
    timeoutCode: API_TIMEOUT_CODE.TIMEOUT_POST_REPORT,
  });
}

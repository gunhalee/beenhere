/**
 * 피드 및 포스트 관련 클라이언트 사이드 API 호출 함수.
 * 서버에 직접 fetch하지 않고 이 함수들을 통해 호출한다.
 */

import { fetchApi } from "./client";
import type { FeedItem } from "@/types/domain";

// ---------------------------
// 피드
// ---------------------------

type FeedData = { items: FeedItem[]; nextCursor: string | null };

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

  return fetchApi<FeedData>(`/api/feed/nearby?${sp.toString()}`);
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
  return fetchApi<{ postId: string }>("/api/posts", { method: "POST", body });
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
  });
}

// ---------------------------
// 삭제
// ---------------------------

export async function deletePostClient(postId: string) {
  return fetchApi<{ postId: string }>(`/api/posts/${postId}`, {
    method: "DELETE",
  });
}

// ---------------------------
// 신고
// ---------------------------

export async function reportPostClient(postId: string, reasonCode: string) {
  return fetchApi<{ postId: string }>(`/api/posts/${postId}/report`, {
    method: "POST",
    body: { reasonCode },
  });
}

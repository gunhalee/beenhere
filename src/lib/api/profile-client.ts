/**
 * 프로필 관련 클라이언트 사이드 API 호출 함수.
 */

import { fetchApi } from "./client";
import type { ProfilePostItem, ProfileLikeItem, PostLikerItem } from "@/types/domain";

// ---------------------------
// 프로필 조회
// ---------------------------

export async function fetchProfileClient(userId: string) {
  return fetchApi<{ id: string; nickname: string }>(`/api/profiles/${userId}`);
}

export async function fetchMyProfileClient() {
  return fetchApi<{
    id: string;
    nickname: string;
    nicknameChangedAt: string | null;
  }>("/api/profiles/me");
}

// ---------------------------
// 작성한 글 목록
// ---------------------------

export async function fetchProfilePostsClient(
  userId: string,
  cursor?: string,
  limit = 20,
) {
  const sp = new URLSearchParams({ limit: String(limit) });
  if (cursor) sp.set("cursor", cursor);

  return fetchApi<{ items: ProfilePostItem[]; nextCursor: string | null }>(
    `/api/profiles/${userId}/posts?${sp.toString()}`,
  );
}

// ---------------------------
// 라이크한 글 목록
// ---------------------------

export async function fetchProfileLikesClient(
  userId: string,
  cursor?: string,
  limit = 20,
) {
  const sp = new URLSearchParams({ limit: String(limit) });
  if (cursor) sp.set("cursor", cursor);

  return fetchApi<{ items: ProfileLikeItem[]; nextCursor: string | null }>(
    `/api/profiles/${userId}/likes?${sp.toString()}`,
  );
}

// ---------------------------
// 내 글 라이커 목록 (작성자 전용)
// ---------------------------

export async function fetchPostLikersClient(
  postId: string,
  cursor?: string,
  limit = 20,
) {
  const sp = new URLSearchParams({ limit: String(limit) });
  if (cursor) sp.set("cursor", cursor);

  return fetchApi<{ items: PostLikerItem[]; nextCursor: string | null }>(
    `/api/posts/${postId}/likers?${sp.toString()}`,
  );
}

// ---------------------------
// 차단 / 차단 해제
// ---------------------------

export async function blockUserClient(blockedUserId: string) {
  return fetchApi<{ blocked: true }>("/api/blocks", {
    method: "POST",
    body: { blockedUserId },
  });
}

export async function unblockUserClient(blockedUserId: string) {
  return fetchApi<{ unblocked: true }>(`/api/blocks/${blockedUserId}`, {
    method: "DELETE",
  });
}

// ---------------------------
// 닉네임 재생성
// ---------------------------

export async function regenNicknameClient() {
  return fetchApi<{ nickname: string }>("/api/profiles/me", {
    method: "PATCH",
  });
}

/**
 * 프로필 관련 클라이언트 사이드 API 호출 함수.
 */

import { fetchApi } from "./client";
import { API_ERROR_CODE, API_TIMEOUT_CODE } from "./common-errors";
import { createKeyedValueCache, createSingleValueCache } from "./request-cache";
import type { ApiResult } from "@/types/api";
import type { ProfilePostItem, ProfileLikeItem, PostLikerItem } from "@/types/domain";
import { getCachedBrowserCoordinates } from "@/lib/geo/browser-location";

const PROFILE_READ_TIMEOUT_MS = 3000;
const PROFILE_WRITE_TIMEOUT_MS = 5000;
const MY_PROFILE_CACHE_TTL_MS = 30_000;
const PROFILE_CACHE_TTL_MS = 30_000;
const PROFILE_LIST_CACHE_TTL_MS = 10_000;

type PublicProfileData = {
  id: string;
  nickname: string;
};

type MyProfileData = {
  id: string;
  nickname: string;
  nicknameChangedAt: string | null;
  profileCreated: boolean;
  isAnonymous: boolean;
};

type ProfileListData<TItem> = {
  items: TItem[];
  nextCursor: string | null;
};

const myProfileCache = createSingleValueCache<MyProfileData>();
const publicProfileCache = createKeyedValueCache<PublicProfileData>();
const profilePostsCache = createKeyedValueCache<ProfileListData<ProfilePostItem>>();
const profileLikesCache = createKeyedValueCache<ProfileListData<ProfileLikeItem>>();

function appendCachedCoordinates(searchParams: URLSearchParams) {
  const cachedCoords = getCachedBrowserCoordinates();
  if (!cachedCoords) return;

  searchParams.set("latitude", String(cachedCoords.latitude));
  searchParams.set("longitude", String(cachedCoords.longitude));
}

export function clearMyProfileCache() {
  myProfileCache.clear();
}

export function clearProfileCache(userId?: string) {
  if (userId) {
    publicProfileCache.clear(userId);
    profilePostsCache.clearByPrefix(`/api/profiles/${userId}/posts?`);
    profileLikesCache.clearByPrefix(`/api/profiles/${userId}/likes?`);
    return;
  }

  publicProfileCache.clear();
  profilePostsCache.clear();
  profileLikesCache.clear();
}

export function updateMyProfileCacheNickname(input: {
  nickname: string;
  nicknameChangedAt: string;
}) {
  const cached = myProfileCache.getCached();
  if (!cached) return;

  myProfileCache.set(
    {
      ...cached,
      nickname: input.nickname,
      nicknameChangedAt: input.nicknameChangedAt,
    },
    MY_PROFILE_CACHE_TTL_MS,
  );
}

// ---------------------------
// 프로필 조회
// ---------------------------

export async function fetchProfileClient(
  userId: string,
  options?: { force?: boolean },
) {
  return publicProfileCache.read(userId, {
    force: options?.force,
    ttlMs: PROFILE_CACHE_TTL_MS,
    load: () =>
      fetchApi<PublicProfileData>(`/api/profiles/${userId}`, {
        timeoutMs: PROFILE_READ_TIMEOUT_MS,
        timeoutErrorMessage: "프로필 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
        timeoutCode: API_TIMEOUT_CODE.TIMEOUT_PROFILE,
      }),
  });
}

export async function fetchMyProfileClient(options?: { force?: boolean }) {
  return myProfileCache.read({
    force: options?.force,
    ttlMs: MY_PROFILE_CACHE_TTL_MS,
    load: () =>
      fetchApi<MyProfileData>("/api/profiles/me", {
        timeoutMs: PROFILE_READ_TIMEOUT_MS,
        timeoutErrorMessage: "내 프로필 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
        timeoutCode: API_TIMEOUT_CODE.TIMEOUT_PROFILE_ME,
      }),
    onResult: (result) => {
      if (!result.ok && result.code === API_ERROR_CODE.UNAUTHORIZED) {
        clearMyProfileCache();
        clearProfileCache();
      }
    },
  });
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
  appendCachedCoordinates(sp);

  const path = `/api/profiles/${userId}/posts?${sp.toString()}`;
  return profilePostsCache.read(path, {
    ttlMs: PROFILE_LIST_CACHE_TTL_MS,
    load: () =>
      fetchApi<ProfileListData<ProfilePostItem>>(path, {
        timeoutMs: PROFILE_READ_TIMEOUT_MS,
        timeoutErrorMessage: "작성 글 목록 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
        timeoutCode: API_TIMEOUT_CODE.TIMEOUT_PROFILE_POSTS,
      }),
  });
}

export async function fetchProfileLikesClient(
  userId: string,
  cursor?: string,
  limit = 20,
) {
  const sp = new URLSearchParams({ limit: String(limit) });
  if (cursor) sp.set("cursor", cursor);
  appendCachedCoordinates(sp);

  const path = `/api/profiles/${userId}/likes?${sp.toString()}`;
  return profileLikesCache.read(path, {
    ttlMs: PROFILE_LIST_CACHE_TTL_MS,
    load: () =>
      fetchApi<ProfileListData<ProfileLikeItem>>(path, {
        timeoutMs: PROFILE_READ_TIMEOUT_MS,
        timeoutErrorMessage: "수집한 글 목록 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
        timeoutCode: API_TIMEOUT_CODE.TIMEOUT_PROFILE_LIKES,
      }),
  });
}

export async function fetchPostLikersClient(
  postId: string,
  cursor?: string,
  limit = 20,
) {
  const sp = new URLSearchParams({ limit: String(limit) });
  if (cursor) sp.set("cursor", cursor);

  return fetchApi<{ items: PostLikerItem[]; nextCursor: string | null }>(
    `/api/posts/${postId}/likers?${sp.toString()}`,
    {
      timeoutMs: PROFILE_READ_TIMEOUT_MS,
      timeoutErrorMessage: "수집한 사람 목록 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
      timeoutCode: API_TIMEOUT_CODE.TIMEOUT_POST_LIKERS,
    },
  );
}

// ---------------------------
// 차단 / 차단 해제
// ---------------------------

export async function blockUserClient(blockedUserId: string) {
  return fetchApi<{ blocked: true; alreadyBlocked: boolean }>("/api/blocks", {
    method: "POST",
    body: { blockedUserId },
    timeoutMs: PROFILE_WRITE_TIMEOUT_MS,
    timeoutErrorMessage: "차단 요청이 지연되고 있어요. 다시 시도해 주세요.",
    timeoutCode: API_TIMEOUT_CODE.TIMEOUT_BLOCK_CREATE,
  });
}

export async function unblockUserClient(blockedUserId: string) {
  return fetchApi<{ unblocked: true; alreadyUnblocked: boolean }>(
    `/api/blocks/${blockedUserId}`,
    {
    method: "DELETE",
    timeoutMs: PROFILE_WRITE_TIMEOUT_MS,
    timeoutErrorMessage: "차단 해제 요청이 지연되고 있어요. 다시 시도해 주세요.",
    timeoutCode: API_TIMEOUT_CODE.TIMEOUT_BLOCK_DELETE,
    },
  );
}

// ---------------------------
// 닉네임 재생성
// ---------------------------

export async function regenNicknameClient() {
  return fetchApi<{ nickname: string; nicknameChangedAt: string }>("/api/profiles/me", {
    method: "PATCH",
    timeoutMs: PROFILE_WRITE_TIMEOUT_MS,
    timeoutErrorMessage: "닉네임 변경 요청이 지연되고 있어요. 다시 시도해 주세요.",
    timeoutCode: API_TIMEOUT_CODE.TIMEOUT_PROFILE_NICKNAME,
  });
}

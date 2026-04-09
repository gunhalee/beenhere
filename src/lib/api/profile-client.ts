/**
 * ?꾨줈??愿???대씪?댁뼵???ъ씠??API ?몄텧 ?⑥닔.
 */

import { fetchApi } from "./client";
import { API_ERROR_CODE, API_TIMEOUT_CODE } from "./common-errors";
import type { ApiResult } from "@/types/api";
import type { ProfilePostItem, ProfileLikeItem, PostLikerItem } from "@/types/domain";

const PROFILE_READ_TIMEOUT_MS = 3000;
const PROFILE_WRITE_TIMEOUT_MS = 5000;
const MY_PROFILE_CACHE_TTL_MS = 30_000;
const PROFILE_CACHE_TTL_MS = 30_000;

type PublicProfileData = {
  id: string;
  nickname: string;
};

type MyProfileData = {
  id: string;
  nickname: string;
  nicknameChangedAt: string | null;
};

type CachedMyProfile = {
  data: MyProfileData;
  expiresAt: number;
};

type CachedPublicProfile = {
  data: PublicProfileData;
  expiresAt: number;
};

let cachedMyProfile: CachedMyProfile | null = null;
let inFlightMyProfileRequest: Promise<ApiResult<MyProfileData>> | null = null;
const cachedProfiles = new Map<string, CachedPublicProfile>();
const inFlightProfileRequests = new Map<string, Promise<ApiResult<PublicProfileData>>>();

function hasFreshMyProfileCache() {
  if (!cachedMyProfile) return false;
  return cachedMyProfile.expiresAt > Date.now();
}

function setMyProfileCache(data: MyProfileData) {
  cachedMyProfile = {
    data,
    expiresAt: Date.now() + MY_PROFILE_CACHE_TTL_MS,
  };
}

function hasFreshProfileCache(userId: string) {
  const cached = cachedProfiles.get(userId);
  if (!cached) return false;
  if (cached.expiresAt <= Date.now()) {
    cachedProfiles.delete(userId);
    return false;
  }
  return true;
}

function setProfileCache(userId: string, data: PublicProfileData) {
  cachedProfiles.set(userId, {
    data,
    expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
  });
}

export function clearMyProfileCache() {
  cachedMyProfile = null;
  inFlightMyProfileRequest = null;
}

export function clearProfileCache(userId?: string) {
  if (userId) {
    cachedProfiles.delete(userId);
    inFlightProfileRequests.delete(userId);
    return;
  }

  cachedProfiles.clear();
  inFlightProfileRequests.clear();
}

export function updateMyProfileCacheNickname(input: {
  nickname: string;
  nicknameChangedAt: string;
}) {
  if (!cachedMyProfile) return;

  cachedMyProfile = {
    data: {
      ...cachedMyProfile.data,
      nickname: input.nickname,
      nicknameChangedAt: input.nicknameChangedAt,
    },
    expiresAt: Date.now() + MY_PROFILE_CACHE_TTL_MS,
  };
}

// ---------------------------
// ?꾨줈??議고쉶
// ---------------------------

export async function fetchProfileClient(
  userId: string,
  options?: { force?: boolean },
) {
  const force = options?.force ?? false;

  if (!force && hasFreshProfileCache(userId)) {
    const cached = cachedProfiles.get(userId);
    if (cached) {
      return { ok: true, data: cached.data } as const;
    }
  }

  if (!force) {
    const inFlight = inFlightProfileRequests.get(userId);
    if (inFlight) return inFlight;
  }

  const requestPromise = fetchApi<PublicProfileData>(`/api/profiles/${userId}`, {
    timeoutMs: PROFILE_READ_TIMEOUT_MS,
    timeoutErrorMessage: "?꾨줈???묐떟??吏?곕릺怨??덉뼱?? ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??",
    timeoutCode: API_TIMEOUT_CODE.TIMEOUT_PROFILE,
  })
    .then((result) => {
      const isLatestRequest = inFlightProfileRequests.get(userId) === requestPromise;
      if (result.ok && isLatestRequest) {
        setProfileCache(userId, result.data);
      }
      return result;
    })
    .finally(() => {
      const currentInFlight = inFlightProfileRequests.get(userId);
      if (currentInFlight === requestPromise) {
        inFlightProfileRequests.delete(userId);
      }
    });

  inFlightProfileRequests.set(userId, requestPromise);
  return requestPromise;
}

export async function fetchMyProfileClient(options?: { force?: boolean }) {
  const force = options?.force ?? false;

  if (!force && hasFreshMyProfileCache() && cachedMyProfile) {
    return { ok: true, data: cachedMyProfile.data } as const;
  }

  if (!force && inFlightMyProfileRequest) {
    return inFlightMyProfileRequest;
  }

  const requestPromise = fetchApi<MyProfileData>("/api/profiles/me", {
    timeoutMs: PROFILE_READ_TIMEOUT_MS,
    timeoutErrorMessage: "???꾨줈???묐떟??吏?곕릺怨??덉뼱?? ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??",
    timeoutCode: API_TIMEOUT_CODE.TIMEOUT_PROFILE_ME,
  })
    .then((result) => {
      const isLatestRequest = inFlightMyProfileRequest === requestPromise;
      if (!isLatestRequest) {
        return result;
      }

      if (result.ok) {
        setMyProfileCache(result.data);
      } else if (result.code === API_ERROR_CODE.UNAUTHORIZED) {
        clearMyProfileCache();
        clearProfileCache();
      }
      return result;
    })
    .finally(() => {
      if (inFlightMyProfileRequest === requestPromise) {
        inFlightMyProfileRequest = null;
      }
    });

  inFlightMyProfileRequest = requestPromise;
  return requestPromise;
}

// ---------------------------
// ?묒꽦??湲 紐⑸줉
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
    {
      timeoutMs: PROFILE_READ_TIMEOUT_MS,
      timeoutErrorMessage: "?묒꽦 湲 紐⑸줉 ?묐떟??吏?곕릺怨??덉뼱?? ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??",
      timeoutCode: API_TIMEOUT_CODE.TIMEOUT_PROFILE_POSTS,
    },
  );
}

// ---------------------------
// ?쇱씠?ы븳 湲 紐⑸줉
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
    {
      timeoutMs: PROFILE_READ_TIMEOUT_MS,
      timeoutErrorMessage: "?쇱씠??紐⑸줉 ?묐떟??吏?곕릺怨??덉뼱?? ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??",
      timeoutCode: API_TIMEOUT_CODE.TIMEOUT_PROFILE_LIKES,
    },
  );
}

// ---------------------------
// ??湲 ?쇱씠而?紐⑸줉 (?묒꽦???꾩슜)
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
    {
      timeoutMs: PROFILE_READ_TIMEOUT_MS,
      timeoutErrorMessage: "?쇱씠而?紐⑸줉 ?묐떟??吏?곕릺怨??덉뼱?? ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??",
      timeoutCode: API_TIMEOUT_CODE.TIMEOUT_POST_LIKERS,
    },
  );
}

// ---------------------------
// 李⑤떒 / 李⑤떒 ?댁젣
// ---------------------------

export async function blockUserClient(blockedUserId: string) {
  return fetchApi<{ blocked: true }>("/api/blocks", {
    method: "POST",
    body: { blockedUserId },
    timeoutMs: PROFILE_WRITE_TIMEOUT_MS,
    timeoutErrorMessage: "李⑤떒 ?붿껌??吏?곕릺怨??덉뼱?? ?ㅼ떆 ?쒕룄??二쇱꽭??",
    timeoutCode: API_TIMEOUT_CODE.TIMEOUT_BLOCK_CREATE,
  });
}

export async function unblockUserClient(blockedUserId: string) {
  return fetchApi<{ unblocked: true }>(`/api/blocks/${blockedUserId}`, {
    method: "DELETE",
    timeoutMs: PROFILE_WRITE_TIMEOUT_MS,
    timeoutErrorMessage: "李⑤떒 ?댁젣 ?붿껌??吏?곕릺怨??덉뼱?? ?ㅼ떆 ?쒕룄??二쇱꽭??",
    timeoutCode: API_TIMEOUT_CODE.TIMEOUT_BLOCK_DELETE,
  });
}

// ---------------------------
// ?됰꽕???ъ깮??
// ---------------------------

export async function regenNicknameClient() {
  return fetchApi<{ nickname: string; nicknameChangedAt: string }>("/api/profiles/me", {
    method: "PATCH",
    timeoutMs: PROFILE_WRITE_TIMEOUT_MS,
    timeoutErrorMessage: "?됰꽕??蹂寃??붿껌??吏?곕릺怨??덉뼱?? ?ㅼ떆 ?쒕룄??二쇱꽭??",
    timeoutCode: API_TIMEOUT_CODE.TIMEOUT_PROFILE_NICKNAME,
  });
}



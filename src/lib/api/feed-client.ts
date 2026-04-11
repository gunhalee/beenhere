/**
 * Feed and post-related client-side API helpers.
 * This module centralizes dedupe, short-lived caching, and retry behavior.
 */

import { fetchApi } from "./client";
import { API_ERROR_CODE, API_TIMEOUT_CODE } from "./common-errors";
import type { ApiResult } from "@/types/api";
import type { FeedItem } from "@/types/domain";

const FEED_STATE_TIMEOUT_MS = 1200;
const FEED_NEARBY_TIMEOUT_MS = 3000;
const FEED_WRITE_TIMEOUT_MS = 5000;
const FEED_STATE_CACHE_TTL_MS = 2000;

type FeedData = {
  items: FeedItem[];
  nextCursor: string | null;
  stateVersion: string | null;
};

type FeedStateData = {
  stateVersion: string;
  refreshedAt: string;
};

type CachedFeedState = {
  data: FeedStateData;
  expiresAt: number;
};

type NearbyFeedParams = {
  latitude: number;
  longitude: number;
  cursor?: string;
  limit?: number;
};

type CreatePostBodyClient = {
  content: string;
  latitude: number;
  longitude: number;
  placeLabel: string;
  clientRequestId?: string;
};

type RateLimitConsentResponse = {
  consent: string;
  grantedAt: string;
};

const inFlightNearbyRequests = new Map<string, Promise<ApiResult<FeedData>>>();
let cachedFeedState: CachedFeedState | null = null;
let inFlightFeedStateRequest: Promise<ApiResult<FeedStateData>> | null = null;

function createNearbyRequestKey(params: NearbyFeedParams) {
  const cursor = params.cursor ?? "";
  const limit = params.limit != null ? String(params.limit) : "";
  return `${params.latitude}|${params.longitude}|${cursor}|${limit}`;
}

function createNearbyQuery(params: NearbyFeedParams) {
  const searchParams = new URLSearchParams({
    latitude: String(params.latitude),
    longitude: String(params.longitude),
  });

  if (params.cursor) searchParams.set("cursor", params.cursor);
  if (params.limit != null) searchParams.set("limit", String(params.limit));

  return searchParams.toString();
}

function hasFreshFeedStateCache() {
  return cachedFeedState != null && cachedFeedState.expiresAt > Date.now();
}

function setFeedStateCache(data: FeedStateData) {
  cachedFeedState = {
    data,
    expiresAt: Date.now() + FEED_STATE_CACHE_TTL_MS,
  };
}

function clearFeedStateCache() {
  cachedFeedState = null;
  inFlightFeedStateRequest = null;
}

function isRetryableWriteResult<T>(result: ApiResult<T>) {
  if (result.ok) return false;

  if (result.code === API_ERROR_CODE.NETWORK_ERROR) {
    return true;
  }

  return (
    result.code === API_TIMEOUT_CODE.TIMEOUT_POST_CREATE ||
    result.code === API_TIMEOUT_CODE.TIMEOUT_POST_LIKE ||
    result.code === API_TIMEOUT_CODE.TIMEOUT_POST_UNLIKE ||
    result.code === API_TIMEOUT_CODE.TIMEOUT_POST_REPORT
  );
}

async function runWithSingleRetry<T>(request: () => Promise<ApiResult<T>>) {
  const first = await request();
  if (!isRetryableWriteResult(first)) {
    return first;
  }

  return request();
}

function generateClientRequestId() {
  const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (randomUUID) {
    return randomUUID();
  }

  return `post_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// ---------------------------
// Feed
// ---------------------------

export async function fetchNearbyFeed(params: NearbyFeedParams) {
  const requestKey = createNearbyRequestKey(params);
  const inFlight = inFlightNearbyRequests.get(requestKey);
  if (inFlight) {
    return inFlight;
  }

  const request = fetchApi<FeedData>(`/api/feed/nearby?${createNearbyQuery(params)}`, {
    timeoutMs: FEED_NEARBY_TIMEOUT_MS,
    timeoutErrorMessage: "피드 요청이 지연되고 있어요. 다시 시도해 주세요.",
    timeoutCode: API_TIMEOUT_CODE.TIMEOUT_NEARBY,
  }).finally(() => {
    if (inFlightNearbyRequests.get(requestKey) === request) {
      inFlightNearbyRequests.delete(requestKey);
    }
  });

  inFlightNearbyRequests.set(requestKey, request);
  return request;
}

export async function fetchFeedState(options?: { force?: boolean }) {
  const force = options?.force ?? false;

  if (!force && hasFreshFeedStateCache() && cachedFeedState) {
    return { ok: true, data: cachedFeedState.data } as const;
  }

  if (!force && inFlightFeedStateRequest) {
    return inFlightFeedStateRequest;
  }

  const request = fetchApi<FeedStateData>("/api/feed/state", {
    timeoutMs: FEED_STATE_TIMEOUT_MS,
    timeoutErrorMessage: "피드 상태 확인이 지연되고 있어요.",
    timeoutCode: API_TIMEOUT_CODE.TIMEOUT_STATE,
  })
    .then((result) => {
      const isLatest = inFlightFeedStateRequest === request;
      if (result.ok && isLatest) {
        setFeedStateCache(result.data);
      }
      return result;
    })
    .finally(() => {
      if (inFlightFeedStateRequest === request) {
        inFlightFeedStateRequest = null;
      }
    });

  inFlightFeedStateRequest = request;
  return request;
}

// ---------------------------
// Create post
// ---------------------------

export async function createPostClient(body: CreatePostBodyClient) {
  const clientRequestId = body.clientRequestId?.trim() || generateClientRequestId();

  return runWithSingleRetry(() =>
    fetchApi<{ postId: string }>("/api/posts", {
      method: "POST",
      body: {
        ...body,
        clientRequestId,
      },
      timeoutMs: FEED_WRITE_TIMEOUT_MS,
      timeoutErrorMessage: "글 작성 요청이 지연되고 있어요. 다시 시도해 주세요.",
      timeoutCode: API_TIMEOUT_CODE.TIMEOUT_POST_CREATE,
    }),
  );
}

export async function submitRateLimitConsentClient() {
  return fetchApi<RateLimitConsentResponse>("/api/consents/rate-limit", {
    method: "POST",
    timeoutMs: FEED_WRITE_TIMEOUT_MS,
    timeoutErrorMessage: "동의 처리가 지연되고 있어요. 잠시 후 다시 시도해 주세요.",
    timeoutCode: API_TIMEOUT_CODE.TIMEOUT_POST_CREATE,
  });
}

// ---------------------------
// Like
// ---------------------------

export async function likePostClient(
  postId: string,
  body: { latitude: number; longitude: number; placeLabel: string },
) {
  return runWithSingleRetry(() =>
    fetchApi<{ likeCount: number }>(`/api/posts/${postId}/like`, {
      method: "POST",
      body,
      timeoutMs: FEED_WRITE_TIMEOUT_MS,
      timeoutErrorMessage: "라이크 요청이 지연되고 있어요. 다시 시도해 주세요.",
      timeoutCode: API_TIMEOUT_CODE.TIMEOUT_POST_LIKE,
    }),
  );
}

export async function unlikePostClient(postId: string) {
  return runWithSingleRetry(() =>
    fetchApi<{ likeCount: number }>(`/api/posts/${postId}/like`, {
      method: "DELETE",
      timeoutMs: FEED_WRITE_TIMEOUT_MS,
      timeoutErrorMessage: "라이크 취소 요청이 지연되고 있어요. 다시 시도해 주세요.",
      timeoutCode: API_TIMEOUT_CODE.TIMEOUT_POST_UNLIKE,
    }),
  );
}

// ---------------------------
// Delete
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
// Report
// ---------------------------

export async function reportPostClient(postId: string, reasonCode: string) {
  return runWithSingleRetry(() =>
    fetchApi<{ postId: string }>(`/api/posts/${postId}/report`, {
      method: "POST",
      body: { reasonCode },
      timeoutMs: FEED_WRITE_TIMEOUT_MS,
      timeoutErrorMessage: "신고 요청이 지연되고 있어요. 다시 시도해 주세요.",
      timeoutCode: API_TIMEOUT_CODE.TIMEOUT_POST_REPORT,
    }),
  );
}

export function clearFeedClientCache() {
  clearFeedStateCache();
  inFlightNearbyRequests.clear();
}

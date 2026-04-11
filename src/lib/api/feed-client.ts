/**
 * Feed and post-related client-side API helpers.
 * This module centralizes dedupe, short-lived caching, and retry behavior.
 */

import { fetchApi } from "./client";
import { API_ERROR_CODE, API_TIMEOUT_CODE } from "./common-errors";
import { createKeyedValueCache, createSingleValueCache } from "./request-cache";
import type {
  ApiResult,
  CreatePostBody,
  FeedLikersPreviewItem,
  LikePostBody,
} from "@/types/api";
import type { FeedItem, FeedLikerPreview } from "@/types/domain";

const FEED_STATE_TIMEOUT_MS = 1200;
const FEED_NEARBY_TIMEOUT_MS = 3000;
const FEED_WRITE_TIMEOUT_MS = 5000;
const FEED_STATE_CACHE_TTL_MS = 2000;

type FeedData = {
  items: FeedItem[];
  nextCursor: string | null;
  stateVersion: string | null;
  radiusMeters?: number;
};

type FeedStateData = {
  stateVersion: string;
  refreshedAt: string;
};

type NearbyFeedParams = {
  latitude: number;
  longitude: number;
  cursor?: string;
  limit?: number;
};

type FeedLikersPreviewParams = {
  latitude: number;
  longitude: number;
  postIds: string[];
};

type RateLimitConsentResponse = {
  consent: string;
  grantedAt: string;
};

const nearbyFeedCache = createKeyedValueCache<FeedData>();
const feedLikersPreviewCache = createKeyedValueCache<{
  items: FeedLikersPreviewItem[];
}>();
const feedStateCache = createSingleValueCache<FeedStateData>();

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

function createFeedLikersPreviewKey(params: FeedLikersPreviewParams) {
  return `${params.latitude}|${params.longitude}|${params.postIds.join(",")}`;
}

function createFeedLikersPreviewQuery(params: FeedLikersPreviewParams) {
  const searchParams = new URLSearchParams({
    latitude: String(params.latitude),
    longitude: String(params.longitude),
    postIds: params.postIds.join(","),
  });

  return searchParams.toString();
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
  return nearbyFeedCache.read(requestKey, {
    load: () =>
      fetchApi<FeedData>(`/api/feed/nearby?${createNearbyQuery(params)}`, {
        timeoutMs: FEED_NEARBY_TIMEOUT_MS,
        timeoutErrorMessage: "피드 요청이 지연되고 있어요. 다시 시도해 주세요.",
        timeoutCode: API_TIMEOUT_CODE.TIMEOUT_NEARBY,
      }),
  });
}

export async function fetchFeedLikersPreview(params: FeedLikersPreviewParams) {
  const requestKey = createFeedLikersPreviewKey(params);
  return feedLikersPreviewCache.read(requestKey, {
    ttlMs: FEED_STATE_CACHE_TTL_MS,
    load: () =>
      fetchApi<{ items: FeedLikersPreviewItem[] }>(
        `/api/posts/likers-preview?${createFeedLikersPreviewQuery(params)}`,
        {
          timeoutMs: FEED_NEARBY_TIMEOUT_MS,
          timeoutErrorMessage:
            "수집한 사람 미리보기를 불러오는 중 지연이 발생했어요.",
          timeoutCode: API_TIMEOUT_CODE.TIMEOUT_NEARBY,
        },
      ),
  });
}

export async function fetchFeedState(options?: { force?: boolean }) {
  return feedStateCache.read({
    force: options?.force,
    ttlMs: FEED_STATE_CACHE_TTL_MS,
    load: () =>
      fetchApi<FeedStateData>("/api/feed/state", {
        timeoutMs: FEED_STATE_TIMEOUT_MS,
        timeoutErrorMessage: "피드 상태 확인이 지연되고 있어요.",
        timeoutCode: API_TIMEOUT_CODE.TIMEOUT_STATE,
      }),
  });
}

// ---------------------------
// Create post
// ---------------------------

export async function createPostClient(body: CreatePostBody) {
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
  body: LikePostBody,
) {
  return runWithSingleRetry(() =>
    fetchApi<{ likeCount: number }>(`/api/posts/${postId}/like`, {
      method: "POST",
      body,
      timeoutMs: FEED_WRITE_TIMEOUT_MS,
      timeoutErrorMessage: "수집 요청이 지연되고 있어요. 다시 시도해 주세요.",
      timeoutCode: API_TIMEOUT_CODE.TIMEOUT_POST_LIKE,
    }),
  );
}

export async function unlikePostClient(postId: string) {
  return runWithSingleRetry(() =>
    fetchApi<{ likeCount: number }>(`/api/posts/${postId}/like`, {
      method: "DELETE",
      timeoutMs: FEED_WRITE_TIMEOUT_MS,
      timeoutErrorMessage: "수집 취소 요청이 지연되고 있어요. 다시 시도해 주세요.",
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
    fetchApi<{ postId: string; alreadyReported: boolean }>(`/api/posts/${postId}/report`, {
      method: "POST",
      body: { reasonCode },
      timeoutMs: FEED_WRITE_TIMEOUT_MS,
      timeoutErrorMessage: "신고 요청이 지연되고 있어요. 다시 시도해 주세요.",
      timeoutCode: API_TIMEOUT_CODE.TIMEOUT_POST_REPORT,
    }),
  );
}

export function clearFeedClientCache() {
  feedStateCache.clear();
  nearbyFeedCache.clear();
  feedLikersPreviewCache.clear();
}

export function mapFeedLikerPreviewByPostId(
  items: FeedLikersPreviewItem[],
): Record<string, FeedLikerPreview[]> {
  return Object.fromEntries(
    items.map((item) => [
      item.postId,
      item.likers.map((liker) => ({
        userId: liker.userId,
        nickname: liker.nickname,
      })),
    ]),
  );
}

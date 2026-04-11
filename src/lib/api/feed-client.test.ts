import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchApi } from "./client";
import { API_ERROR_CODE, API_TIMEOUT_CODE } from "./common-errors";
import {
  clearFeedClientCache,
  createPostClient,
  fetchFeedState,
  fetchNearbyFeed,
  likePostClient,
  unlikePostClient,
  reportPostClient,
} from "./feed-client";

vi.mock("./client", () => ({
  fetchApi: vi.fn(),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("feed-client read caching and dedupe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFeedClientCache();
  });

  it("returns cached feed state response inside TTL window", async () => {
    vi.mocked(fetchApi).mockResolvedValue({
      ok: true,
      data: {
        stateVersion: "v1",
        refreshedAt: "2026-04-09T01:00:00.000Z",
      },
    });

    const first = await fetchFeedState();
    const second = await fetchFeedState();

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(fetchApi).toHaveBeenCalledTimes(1);
  });

  it("dedupes in-flight feed state requests", async () => {
    const deferred = createDeferred<{
      ok: true;
      data: { stateVersion: string; refreshedAt: string };
    }>();
    vi.mocked(fetchApi).mockReturnValue(deferred.promise);

    const firstPromise = fetchFeedState();
    const secondPromise = fetchFeedState();

    expect(fetchApi).toHaveBeenCalledTimes(1);

    deferred.resolve({
      ok: true,
      data: {
        stateVersion: "v2",
        refreshedAt: "2026-04-09T01:01:00.000Z",
      },
    });

    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first).toEqual(second);
  });

  it("bypasses state cache when force=true", async () => {
    vi.mocked(fetchApi)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          stateVersion: "v1",
          refreshedAt: "2026-04-09T01:00:00.000Z",
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          stateVersion: "v2",
          refreshedAt: "2026-04-09T01:02:00.000Z",
        },
      });

    await fetchFeedState();
    const forced = await fetchFeedState({ force: true });

    expect(fetchApi).toHaveBeenCalledTimes(2);
    expect(forced.ok).toBe(true);
    if (forced.ok) {
      expect(forced.data.stateVersion).toBe("v2");
    }
  });

  it("dedupes in-flight nearby feed requests for same key", async () => {
    const deferred = createDeferred<{
      ok: true;
      data: { items: []; nextCursor: null; stateVersion: string };
    }>();
    vi.mocked(fetchApi).mockReturnValue(deferred.promise);

    const params = { latitude: 37.5, longitude: 127.0 };
    const firstPromise = fetchNearbyFeed(params);
    const secondPromise = fetchNearbyFeed(params);

    expect(fetchApi).toHaveBeenCalledTimes(1);

    deferred.resolve({
      ok: true,
      data: {
        items: [],
        nextCursor: null,
        stateVersion: "v1",
      },
    });

    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first).toEqual(second);
  });
});

describe("feed-client write retries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFeedClientCache();
  });

  it("retries create-post once on timeout and keeps same clientRequestId", async () => {
    vi.mocked(fetchApi)
      .mockResolvedValueOnce({
        ok: false,
        error: "timeout",
        code: API_TIMEOUT_CODE.TIMEOUT_POST_CREATE,
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { postId: "post-1" },
      });

    const result = await createPostClient({
      content: "hello",
      latitude: 37.5,
      longitude: 127.0,
      placeLabel: "Gangnam-gu",
      clientRequestId: "req_20260409_0001",
    });

    expect(fetchApi).toHaveBeenCalledTimes(2);
    expect(fetchApi).toHaveBeenNthCalledWith(
      1,
      "/api/posts",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          clientRequestId: "req_20260409_0001",
        }),
      }),
    );
    expect(fetchApi).toHaveBeenNthCalledWith(
      2,
      "/api/posts",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          clientRequestId: "req_20260409_0001",
        }),
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("retries like once on network error", async () => {
    vi.mocked(fetchApi)
      .mockResolvedValueOnce({
        ok: false,
        error: "network",
        code: API_ERROR_CODE.NETWORK_ERROR,
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { likeCount: 4 },
      });

    const result = await likePostClient("post-1", {
      latitude: 37.5,
      longitude: 127.0,
      placeLabel: "Gangnam-gu",
    });

    expect(fetchApi).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it("does not retry report on non-retryable validation error", async () => {
    vi.mocked(fetchApi).mockResolvedValue({
      ok: false,
      error: "bad reason",
      code: "INVALID_REASON_CODE",
    });

    const result = await reportPostClient("post-1", "INVALID");

    expect(fetchApi).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
  });

  it("retries unlike once on timeout", async () => {
    vi.mocked(fetchApi)
      .mockResolvedValueOnce({
        ok: false,
        error: "timeout",
        code: API_TIMEOUT_CODE.TIMEOUT_POST_UNLIKE,
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { likeCount: 2 },
      });

    const result = await unlikePostClient("post-1");

    expect(fetchApi).toHaveBeenCalledTimes(2);
    expect(fetchApi).toHaveBeenNthCalledWith(
      1,
      "/api/posts/post-1/like",
      expect.objectContaining({
        method: "DELETE",
      }),
    );
    expect(result.ok).toBe(true);
  });
});

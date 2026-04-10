import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItem } from "@/types/domain";
import { useFeed } from "./use-feed";
import {
  getCachedBrowserCoordinates,
  getCurrentBrowserCoordinates,
  getGeoErrorMessage,
  isGeoPermissionDenied,
} from "@/lib/geo/browser-location";
import { fetchFeedState, fetchNearbyFeed } from "@/lib/api/feed-client";
import { useVisiblePolling } from "./use-visible-polling";

vi.mock("@/lib/geo/browser-location", () => ({
  getCachedBrowserCoordinates: vi.fn(),
  getCurrentBrowserCoordinates: vi.fn(),
  getGeoErrorMessage: vi.fn(),
  isGeoPermissionDenied: vi.fn(),
}));

vi.mock("@/lib/api/feed-client", () => ({
  fetchNearbyFeed: vi.fn(),
  fetchFeedState: vi.fn(),
}));

type VisiblePollingParams = {
  enabled: boolean;
  onTick: (isCancelled: () => boolean) => Promise<void | boolean> | void | boolean;
};

let latestPollingParams: VisiblePollingParams | null = null;

vi.mock("./use-visible-polling", () => ({
  useVisiblePolling: vi.fn((params: VisiblePollingParams) => {
    latestPollingParams = params;
  }),
}));

function makeFeedItem(postId: string): FeedItem {
  return {
    postId,
    content: `content-${postId}`,
    authorId: "author-1",
    authorNickname: "작성자",
    lastSharerId: "author-1",
    lastSharerNickname: "작성자",
    likerUserIds: [],
    likerNicknames: [],
    placeLabel: "강남구",
    distanceMeters: 120,
    relativeTime: "방금 전",
    likeCount: 0,
    myLike: false,
  };
}

describe("useFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestPollingParams = null;
    vi.mocked(getCachedBrowserCoordinates).mockReturnValue(null);
    vi.mocked(getGeoErrorMessage).mockReturnValue(
      "현재 위치를 확인하지 못했어요. 다시 시도해 주세요.",
    );
    vi.mocked(isGeoPermissionDenied).mockReturnValue(false);
    vi.mocked(fetchFeedState).mockResolvedValue({
      ok: true,
      data: {
        stateVersion: "v1",
        refreshedAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("마운트 시 위치를 가져와 첫 페이지를 로드한다", async () => {
    vi.mocked(getCurrentBrowserCoordinates).mockResolvedValue({
      latitude: 37.5,
      longitude: 127.0,
    });
    vi.mocked(fetchNearbyFeed).mockResolvedValue({
      ok: true,
      data: {
        items: [makeFeedItem("p1")],
        nextCursor: "cursor-1",
        stateVersion: "v1",
      },
    });

    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    expect(result.current.state.items).toHaveLength(1);
    expect(result.current.state.nextCursor).toBe("cursor-1");
    expect(fetchNearbyFeed).toHaveBeenCalledWith({
      latitude: 37.5,
      longitude: 127.0,
      cursor: undefined,
    });
  });

  it("캐시 좌표가 있으면 즉시 피드를 로드하고 위치 재확인은 백그라운드로 처리한다", async () => {
    vi.mocked(getCachedBrowserCoordinates).mockReturnValue({
      latitude: 37.51,
      longitude: 127.01,
    });
    vi.mocked(getCurrentBrowserCoordinates).mockRejectedValue(
      new Error("GEOLOCATION_TIMEOUT"),
    );
    vi.mocked(fetchNearbyFeed).mockResolvedValue({
      ok: true,
      data: {
        items: [makeFeedItem("cached-1")],
        nextCursor: null,
        stateVersion: "v1",
      },
    });

    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    expect(fetchNearbyFeed).toHaveBeenCalledWith({
      latitude: 37.51,
      longitude: 127.01,
      cursor: undefined,
    });
  });

  it("loadMore 호출 시 다음 페이지를 append 한다", async () => {
    vi.mocked(getCurrentBrowserCoordinates).mockResolvedValue({
      latitude: 37.5,
      longitude: 127.0,
    });
    vi.mocked(fetchNearbyFeed)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          items: [makeFeedItem("p1")],
          nextCursor: "cursor-1",
          stateVersion: "v1",
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          items: [makeFeedItem("p2")],
          nextCursor: null,
          stateVersion: "v1",
        },
      });

    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.state.items.map((i) => i.postId)).toEqual(["p1", "p2"]);
    expect(fetchNearbyFeed).toHaveBeenNthCalledWith(2, {
      latitude: 37.5,
      longitude: 127.0,
      cursor: "cursor-1",
    });
  });

  it("위치 권한 거부 시 locationDenied 상태로 전환한다", async () => {
    vi.mocked(getCurrentBrowserCoordinates).mockRejectedValue(
      new Error("denied"),
    );
    vi.mocked(isGeoPermissionDenied).mockReturnValue(true);

    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.state.status).toBe("error");
    });

    expect(result.current.state.locationDenied).toBe(true);
    expect(result.current.state.errorMessage).toBeNull();
    expect(fetchNearbyFeed).not.toHaveBeenCalled();
  });

  it("removeItemOptimistic 이후 restoreRemovedItem으로 복구할 수 있다", async () => {
    vi.mocked(getCurrentBrowserCoordinates).mockResolvedValue({
      latitude: 37.5,
      longitude: 127.0,
    });
    vi.mocked(fetchNearbyFeed).mockResolvedValue({
      ok: true,
      data: {
        items: [makeFeedItem("p1"), makeFeedItem("p2")],
        nextCursor: null,
        stateVersion: "v1",
      },
    });

    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
      expect(result.current.state.items).toHaveLength(2);
    });

    let snapshot: { item: FeedItem; index: number } | null = null;
    act(() => {
      snapshot = result.current.removeItemOptimistic("p1");
    });

    expect(result.current.state.items.map((i) => i.postId)).toEqual(["p2"]);
    expect(snapshot).not.toBeNull();

    act(() => {
      result.current.restoreRemovedItem(snapshot as { item: FeedItem; index: number });
    });

    expect(result.current.state.items.map((i) => i.postId)).toEqual(["p1", "p2"]);
  });

  it("loadMore 실패 시 기존 목록은 유지하고 errorMessage를 세팅한다", async () => {
    vi.mocked(getCurrentBrowserCoordinates).mockResolvedValue({
      latitude: 37.5,
      longitude: 127.0,
    });
    vi.mocked(fetchNearbyFeed)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          items: [makeFeedItem("p1")],
          nextCursor: "cursor-1",
          stateVersion: "v1",
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: "더 불러오지 못했어요.",
      });

    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.state.items.map((item) => item.postId)).toEqual(["p1"]);
    expect(result.current.state.errorMessage).toBe("더 불러오지 못했어요.");
    expect(result.current.state.loadingMore).toBe(false);
  });

  it("visible polling에서 stateVersion이 같으면 nearby 재조회하지 않는다", async () => {
    vi.mocked(getCurrentBrowserCoordinates).mockResolvedValue({
      latitude: 37.5,
      longitude: 127.0,
    });
    vi.mocked(fetchNearbyFeed).mockResolvedValue({
      ok: true,
      data: {
        items: [makeFeedItem("p1")],
        nextCursor: null,
        stateVersion: "v1",
      },
    });
    vi.mocked(fetchFeedState).mockResolvedValue({
      ok: true,
      data: {
        stateVersion: "v1",
        refreshedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    expect(fetchNearbyFeed).toHaveBeenCalledTimes(1);
    expect(useVisiblePolling).toHaveBeenCalled();
    expect(latestPollingParams?.enabled).toBe(true);

    await act(async () => {
      await latestPollingParams?.onTick(() => false);
    });

    expect(fetchFeedState).toHaveBeenCalledTimes(1);
    expect(fetchNearbyFeed).toHaveBeenCalledTimes(1);
  });

  it("visible polling에서 state 조회가 실패하면 nearby 재조회를 건너뛴다", async () => {
    vi.mocked(getCurrentBrowserCoordinates).mockResolvedValue({
      latitude: 37.5,
      longitude: 127.0,
    });
    vi.mocked(fetchNearbyFeed).mockResolvedValue({
      ok: true,
      data: {
        items: [makeFeedItem("p1")],
        nextCursor: null,
        stateVersion: "v1",
      },
    });
    vi.mocked(fetchFeedState).mockResolvedValue({
      ok: false,
      error: "피드 상태 확인이 지연되고 있어요.",
      code: "TIMEOUT_STATE",
    });

    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    let tickResult: void | boolean | undefined;
    await act(async () => {
      tickResult = await latestPollingParams?.onTick(() => false);
    });

    expect(fetchFeedState).toHaveBeenCalledTimes(1);
    expect(fetchNearbyFeed).toHaveBeenCalledTimes(1);
    expect(tickResult).toBe(false);
  });

  it("visible polling에서 stateVersion이 바뀌면 nearby를 다시 불러온다", async () => {
    vi.mocked(getCurrentBrowserCoordinates).mockResolvedValue({
      latitude: 37.5,
      longitude: 127.0,
    });
    vi.mocked(fetchNearbyFeed)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          items: [makeFeedItem("p1")],
          nextCursor: null,
          stateVersion: "v1",
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          items: [makeFeedItem("p1"), makeFeedItem("p2")],
          nextCursor: null,
          stateVersion: "v2",
        },
      });
    vi.mocked(fetchFeedState).mockResolvedValue({
      ok: true,
      data: {
        stateVersion: "v2",
        refreshedAt: "2026-01-01T00:01:00.000Z",
      },
    });

    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    expect(fetchNearbyFeed).toHaveBeenCalledTimes(1);

    await act(async () => {
      await latestPollingParams?.onTick(() => false);
    });

    expect(fetchFeedState).toHaveBeenCalledTimes(1);
    expect(fetchNearbyFeed).toHaveBeenCalledTimes(2);
    expect(result.current.state.items.map((item) => item.postId)).toEqual(["p1", "p2"]);
  });

  it("silent refresh keeps success flow and updates items", async () => {
    vi.mocked(getCurrentBrowserCoordinates).mockResolvedValue({
      latitude: 37.5,
      longitude: 127.0,
    });
    vi.mocked(fetchNearbyFeed)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          items: [makeFeedItem("p1")],
          nextCursor: null,
          stateVersion: "v1",
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          items: [makeFeedItem("p1"), makeFeedItem("p2")],
          nextCursor: null,
          stateVersion: "v2",
        },
      });

    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });
    expect(result.current.state.items.map((item) => item.postId)).toEqual(["p1"]);

    await act(async () => {
      await result.current.refresh({ silent: true });
    });

    expect(result.current.state.status).toBe("success");
    expect(result.current.state.items.map((item) => item.postId)).toEqual(["p1", "p2"]);
    expect(fetchNearbyFeed).toHaveBeenCalledTimes(2);
  });
});

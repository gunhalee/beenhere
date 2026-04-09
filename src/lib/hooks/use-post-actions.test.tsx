import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Coordinates } from "@/lib/geo/browser-location";
import { usePostActions } from "./use-post-actions";
import type { LikeablePostItem, RemovedItemSnapshot } from "./use-post-actions";
import {
  deletePostClient,
  likePostClient,
  reportPostClient,
} from "@/lib/api/feed-client";
import {
  getCachedBrowserCoordinates,
  getCurrentBrowserCoordinates,
  getGeoErrorMessage,
} from "@/lib/geo/browser-location";
import {
  getGeocodingErrorMessage,
} from "@/lib/geo/reverse-geocode";
import { resolvePlaceLabelWithCache } from "@/lib/geo/place-label-cache";

vi.mock("@/lib/geo/browser-location", () => ({
  getCachedBrowserCoordinates: vi.fn(),
  getCurrentBrowserCoordinates: vi.fn(),
  getGeoErrorMessage: vi.fn(),
}));

vi.mock("@/lib/geo/reverse-geocode", () => ({
  getGeocodingErrorMessage: vi.fn(),
}));

vi.mock("@/lib/geo/place-label-cache", () => ({
  resolvePlaceLabelWithCache: vi.fn(),
}));

vi.mock("@/lib/api/feed-client", () => ({
  likePostClient: vi.fn(),
  deletePostClient: vi.fn(),
  reportPostClient: vi.fn(),
}));

type TestItem = LikeablePostItem;

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

describe("usePostActions", () => {
  const coordsRef = { current: null as Coordinates | null };
  const updateItem = vi.fn();
  const removeItemOptimistic = vi.fn();
  const restoreRemovedItem = vi.fn();
  const onLocationError = vi.fn();
  const onActionError = vi.fn();

  const item: TestItem = {
    postId: "post-1",
    likeCount: 2,
    myLike: false,
    placeLabel: "기존 위치",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    coordsRef.current = null;
    vi.mocked(getCachedBrowserCoordinates).mockReturnValue(null);
    vi.mocked(getGeoErrorMessage).mockReturnValue(
      "현재 위치를 확인하지 못했어요. 다시 시도해 주세요.",
    );
    vi.mocked(getGeocodingErrorMessage).mockReturnValue(
      "위치 정보를 가져오지 못했어요.",
    );
  });

  function renderActionsHook() {
    return renderHook(() =>
      usePostActions<TestItem>({
        updateItem,
        removeItemOptimistic,
        restoreRemovedItem,
        coordsRef,
        onLocationError,
        onActionError,
      }),
    );
  }

  it("좋아요 성공 시 낙관적 업데이트 후 서버 likeCount로 동기화한다", async () => {
    vi.mocked(getCurrentBrowserCoordinates).mockResolvedValue({
      latitude: 37.5,
      longitude: 127.0,
    });
    vi.mocked(resolvePlaceLabelWithCache).mockResolvedValue("강남구");
    vi.mocked(likePostClient).mockResolvedValue({
      ok: true,
      data: { likeCount: 3 },
    });

    const { result } = renderActionsHook();

    await act(async () => {
      await result.current.handleLike(item);
    });

    expect(updateItem).toHaveBeenNthCalledWith(1, "post-1", {
      myLike: true,
      likeCount: 3,
    });
    expect(updateItem).toHaveBeenNthCalledWith(2, "post-1", {
      likeCount: 3,
    });
    expect(likePostClient).toHaveBeenCalledWith("post-1", {
      latitude: 37.5,
      longitude: 127.0,
      placeLabel: "강남구",
    });
    expect(onActionError).not.toHaveBeenCalled();
  });

  it("dedupes rapid repeated like actions before location resolves", async () => {
    const coordsDeferred = createDeferred<Coordinates>();

    vi.mocked(getCurrentBrowserCoordinates).mockReturnValue(coordsDeferred.promise);
    vi.mocked(resolvePlaceLabelWithCache).mockResolvedValue("Gangnam-gu");
    vi.mocked(likePostClient).mockResolvedValue({
      ok: true,
      data: { likeCount: 3 },
    });

    const { result } = renderActionsHook();

    const firstPromise = result.current.handleLike(item);
    const secondPromise = result.current.handleLike(item);

    coordsDeferred.resolve({ latitude: 37.5, longitude: 127.0 });
    await act(async () => {
      await Promise.all([firstPromise, secondPromise]);
    });

    expect(getCurrentBrowserCoordinates).toHaveBeenCalledTimes(1);
    expect(resolvePlaceLabelWithCache).toHaveBeenCalledTimes(1);
    expect(likePostClient).toHaveBeenCalledTimes(1);
  });

  it("좌표 캐시가 있으면 브라우저 위치 재요청 없이 라이크를 처리한다", async () => {
    vi.mocked(getCachedBrowserCoordinates).mockReturnValue({
      latitude: 37.6,
      longitude: 127.1,
    });
    vi.mocked(resolvePlaceLabelWithCache).mockResolvedValue("서초구");
    vi.mocked(likePostClient).mockResolvedValue({
      ok: true,
      data: { likeCount: 3 },
    });

    const { result } = renderActionsHook();

    await act(async () => {
      await result.current.handleLike(item);
    });

    expect(getCurrentBrowserCoordinates).not.toHaveBeenCalled();
    expect(likePostClient).toHaveBeenCalledWith("post-1", {
      latitude: 37.6,
      longitude: 127.1,
      placeLabel: "서초구",
    });
  });

  it("위치 권한 거부 시 onLocationError를 호출하고 요청을 중단한다", async () => {
    const deniedError = new Error("GEOLOCATION_PERMISSION_DENIED");
    vi.mocked(getCurrentBrowserCoordinates).mockRejectedValue(deniedError);
    vi.mocked(getGeoErrorMessage).mockReturnValue(
      "위치 권한을 허용해야 라이크를 남길 수 있어요.",
    );

    const { result } = renderActionsHook();

    await act(async () => {
      await result.current.handleLike(item);
    });

    expect(onLocationError).toHaveBeenCalledTimes(1);
    expect(onLocationError).toHaveBeenCalledWith(
      "위치 권한을 허용해야 라이크를 남길 수 있어요.",
    );
    expect(getGeoErrorMessage).toHaveBeenCalledWith(deniedError, "like");
    expect(resolvePlaceLabelWithCache).not.toHaveBeenCalled();
    expect(likePostClient).not.toHaveBeenCalled();
    expect(updateItem).not.toHaveBeenCalled();
  });

  it("삭제 실패 시 rollback과 에러 콜백을 호출한다", async () => {
    const snapshot: RemovedItemSnapshot<{ postId: string }> = {
      item: { postId: "post-1" },
      index: 0,
    };
    removeItemOptimistic.mockReturnValue(snapshot);
    vi.mocked(deletePostClient).mockResolvedValue({
      ok: false,
      error: "삭제 실패",
    });

    const { result } = renderActionsHook();

    await act(async () => {
      await result.current.handleDelete("post-1");
    });

    expect(removeItemOptimistic).toHaveBeenCalledWith("post-1");
    expect(deletePostClient).toHaveBeenCalledWith("post-1");
    expect(restoreRemovedItem).toHaveBeenCalledWith(snapshot);
    expect(onActionError).toHaveBeenCalledWith("삭제 실패");
  });

  it("신고 성공 시 successMessage를 세팅한다", async () => {
    vi.mocked(reportPostClient).mockResolvedValue({
      ok: true,
      data: { postId: "post-1" },
    });

    const { result } = renderActionsHook();

    act(() => {
      result.current.openReport("post-1");
    });

    await act(async () => {
      await result.current.handleReport("SPAM");
    });

    expect(result.current.reportState.submitting).toBe(false);
    expect(result.current.reportState.successMessage).toBeTruthy();
    expect(result.current.reportState.errorMessage).toBeNull();
  });
});

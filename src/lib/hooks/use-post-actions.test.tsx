import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Coordinates } from "@/lib/geo/browser-location";
import { usePostActions } from "./use-post-actions";
import type { LikeablePostItem, RemovedItemSnapshot } from "./use-post-actions";
import {
  deletePostClient,
  likePostClient,
  unlikePostClient,
  reportPostClient,
} from "@/lib/api/feed-client";
import {
  getCachedBrowserCoordinates,
  getCurrentBrowserCoordinates,
  getGeoErrorMessage,
} from "@/lib/geo/browser-location";
import { getGeocodingErrorMessage } from "@/lib/geo/reverse-geocode";
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
  unlikePostClient: vi.fn(),
  deletePostClient: vi.fn(),
  reportPostClient: vi.fn(),
}));

type TestItem = LikeablePostItem;

describe("usePostActions", () => {
  const coordsRef = { current: null as Coordinates | null };
  const updateItem = vi.fn();
  const removeItemOptimistic = vi.fn();
  const restoreRemovedItem = vi.fn();
  const onLocationError = vi.fn();
  const onActionError = vi.fn();
  const onAuthRequired = vi.fn();

  const item: TestItem = {
    postId: "post-1",
    likeCount: 2,
    myLike: false,
    placeLabel: "Existing place",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    coordsRef.current = null;
    vi.mocked(getCachedBrowserCoordinates).mockReturnValue(null);
    vi.mocked(getGeoErrorMessage).mockReturnValue("Could not resolve location");
    vi.mocked(getGeocodingErrorMessage).mockReturnValue("Could not resolve place label");
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
        onAuthRequired,
      }),
    );
  }

  it("optimistically likes and syncs server likeCount", async () => {
    vi.mocked(getCurrentBrowserCoordinates).mockResolvedValue({
      latitude: 37.5,
      longitude: 127,
    });
    vi.mocked(resolvePlaceLabelWithCache).mockResolvedValue("Gangnam-gu");
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
      myLike: true,
      likeCount: 3,
    });
    expect(likePostClient).toHaveBeenCalledTimes(1);
    expect(onActionError).not.toHaveBeenCalled();
  });

  it("triggers auth callback when like returns UNAUTHORIZED", async () => {
    vi.mocked(getCurrentBrowserCoordinates).mockResolvedValue({
      latitude: 37.5,
      longitude: 127,
    });
    vi.mocked(resolvePlaceLabelWithCache).mockResolvedValue("Gangnam-gu");
    vi.mocked(likePostClient).mockResolvedValue({
      ok: false,
      code: "UNAUTHORIZED",
      error: "Login required",
    });

    const { result } = renderActionsHook();

    await act(async () => {
      await result.current.handleLike(item);
    });

    expect(onAuthRequired).toHaveBeenCalledTimes(1);
  });

  it("optimistically unlikes without requiring coordinates", async () => {
    vi.mocked(unlikePostClient).mockResolvedValue({
      ok: true,
      data: { likeCount: 1 },
    });

    const { result } = renderActionsHook();

    await act(async () => {
      await result.current.handleLike({
        ...item,
        likeCount: 2,
        myLike: true,
      });
    });

    expect(getCurrentBrowserCoordinates).not.toHaveBeenCalled();
    expect(unlikePostClient).toHaveBeenCalledWith("post-1");
    expect(updateItem).toHaveBeenNthCalledWith(1, "post-1", {
      myLike: false,
      likeCount: 1,
    });
    expect(updateItem).toHaveBeenNthCalledWith(2, "post-1", {
      myLike: false,
      likeCount: 1,
    });
  });

  it("rolls back optimistic delete when delete fails", async () => {
    const snapshot: RemovedItemSnapshot<{ postId: string }> = {
      item: { postId: "post-1" },
      index: 0,
    };
    removeItemOptimistic.mockReturnValue(snapshot);
    vi.mocked(deletePostClient).mockResolvedValue({
      ok: false,
      error: "Delete failed",
    });

    const { result } = renderActionsHook();

    await act(async () => {
      await result.current.handleDelete("post-1");
    });

    expect(restoreRemovedItem).toHaveBeenCalledWith(snapshot);
    expect(onActionError).toHaveBeenCalledWith("Delete failed");
  });

  it("sets success state on report success", async () => {
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

    expect(result.current.reportState.successMessage).toBeTruthy();
    expect(result.current.reportState.errorMessage).toBeNull();
  });

  it("opens auth callback on report UNAUTHORIZED", async () => {
    vi.mocked(reportPostClient).mockResolvedValue({
      ok: false,
      code: "UNAUTHORIZED",
      error: "Login required",
    });

    const { result } = renderActionsHook();

    act(() => {
      result.current.openReport("post-1");
    });

    await act(async () => {
      await result.current.handleReport("SPAM");
    });

    expect(onAuthRequired).toHaveBeenCalledTimes(1);
    expect(result.current.reportState.errorMessage).toBeNull();
  });
});


import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItem } from "@/types/domain";
import { fetchFeedLikersPreview } from "@/lib/api/feed-client";
import { useFeedLikerPreview } from "./use-feed-liker-preview";

vi.mock("@/lib/api/feed-client", () => ({
  fetchFeedLikersPreview: vi.fn(),
  mapFeedLikerPreviewByPostId: (items: Array<{
    postId: string;
    likers: Array<{ userId: string | null; nickname: string }>;
  }>) =>
    Object.fromEntries(items.map((item) => [item.postId, item.likers])),
}));

function makeFeedItem(postId: string, likeCount = 1): FeedItem {
  return {
    postId,
    content: postId,
    authorId: "author-1",
    authorNickname: "작성자",
    placeLabel: "강남구",
    distanceMeters: 100,
    relativeTime: "방금 전",
    likeCount,
    myLike: false,
  };
}

describe("useFeedLikerPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads preview in chunks", async () => {
    vi.mocked(fetchFeedLikersPreview).mockResolvedValue({
      ok: true,
      data: {
        items: [],
      },
    });

    const items = Array.from({ length: 13 }, (_, index) =>
      makeFeedItem(`post-${index + 1}`),
    );

    renderHook(() =>
      useFeedLikerPreview({
        items,
        coordsRef: {
          current: { latitude: 37.5, longitude: 127.0 },
        },
      }),
    );

    await waitFor(() => {
      expect(fetchFeedLikersPreview).toHaveBeenCalled();
    });
    const requestedBatchSizes = vi
      .mocked(fetchFeedLikersPreview)
      .mock.calls.map((call) => call[0].postIds.length)
      .sort((a, b) => a - b);

    expect(requestedBatchSizes).toContain(12);
    expect(requestedBatchSizes).toContain(1);
  });

  it("does not re-request already loaded post ids on rerender", async () => {
    vi.mocked(fetchFeedLikersPreview).mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            postId: "post-1",
            likers: [{ userId: "u1", nickname: "Alpha" }],
          },
        ],
      },
    });

    const { rerender } = renderHook(
      ({ items }) =>
        useFeedLikerPreview({
          items,
          coordsRef: {
            current: { latitude: 37.5, longitude: 127.0 },
          },
        }),
      {
        initialProps: {
          items: [makeFeedItem("post-1")],
        },
      },
    );

    await waitFor(() => {
      expect(fetchFeedLikersPreview).toHaveBeenCalled();
    });

    const firstRequestedIds = new Set(
      vi.mocked(fetchFeedLikersPreview).mock.calls.flatMap((call) => call[0].postIds),
    );
    expect(firstRequestedIds.has("post-1")).toBe(true);

    rerender({
      items: [makeFeedItem("post-1"), makeFeedItem("post-2")],
    });

    await waitFor(() => {
      const allRequestedIds = vi
        .mocked(fetchFeedLikersPreview)
        .mock.calls.flatMap((call) => call[0].postIds);
      const post2RequestCount = allRequestedIds.filter((postId) => postId === "post-2").length;

      expect(post2RequestCount).toBe(1);
    });
  });
});

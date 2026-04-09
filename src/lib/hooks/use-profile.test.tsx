import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ProfileLikeItem,
  ProfilePostItem,
  PostLikerItem,
} from "@/types/domain";
import { useProfile } from "./use-profile";
import {
  fetchPostLikersClient,
  fetchProfileLikesClient,
  fetchProfilePostsClient,
} from "@/lib/api/profile-client";

vi.mock("@/lib/api/profile-client", () => ({
  fetchProfilePostsClient: vi.fn(),
  fetchProfileLikesClient: vi.fn(),
  fetchPostLikersClient: vi.fn(),
}));

function makePost(postId: string): ProfilePostItem {
  return {
    postId,
    content: `post-${postId}`,
    placeLabel: "Gangnam-gu",
    distanceMeters: 420,
    relativeTime: "just now",
    likeCount: 1,
    myLike: false,
  };
}

function makeLike(postId: string): ProfileLikeItem {
  return {
    postId,
    content: `like-${postId}`,
    authorId: "author-1",
    authorNickname: "author",
    placeLabel: "Gangnam-gu",
    distanceMeters: 420,
    relativeTime: "just now",
    likeCount: 2,
    myLike: true,
  };
}

function makeLiker(userId: string): PostLikerItem {
  return {
    userId,
    nickname: `user-${userId}`,
    likedAt: "2026-01-01T00:00:00.000Z",
    likedAtRelative: "just now",
    likePlaceLabel: "Gangnam-gu",
  };
}

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

describe("useProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads posts first on mount", async () => {
    vi.mocked(fetchProfilePostsClient).mockResolvedValue({
      ok: true,
      data: {
        items: [makePost("p1")],
        nextCursor: "cursor-post-1",
      },
    });
    vi.mocked(fetchProfileLikesClient).mockResolvedValue({
      ok: true,
      data: {
        items: [makeLike("p1")],
        nextCursor: null,
      },
    });

    const { result } = renderHook(() => useProfile("user-1", true));

    await waitFor(() => {
      expect(result.current.posts.loading).toBe(false);
    });

    expect(fetchProfilePostsClient).toHaveBeenCalledWith("user-1", undefined);
    expect(fetchProfileLikesClient).not.toHaveBeenCalled();
    expect(result.current.posts.items).toHaveLength(1);
  });

  it("loads likes only when likes tab is first opened", async () => {
    vi.mocked(fetchProfilePostsClient).mockResolvedValue({
      ok: true,
      data: {
        items: [makePost("p1")],
        nextCursor: null,
      },
    });
    vi.mocked(fetchProfileLikesClient).mockResolvedValue({
      ok: true,
      data: {
        items: [makeLike("p1")],
        nextCursor: null,
      },
    });

    const { result } = renderHook(() => useProfile("user-1", true));

    await waitFor(() => {
      expect(result.current.posts.loading).toBe(false);
    });

    act(() => {
      result.current.setActiveTab("likes");
    });

    await waitFor(() => {
      expect(result.current.likes.loading).toBe(false);
    });

    expect(fetchProfileLikesClient).toHaveBeenCalledTimes(1);
    expect(fetchProfileLikesClient).toHaveBeenCalledWith("user-1", undefined);
    expect(result.current.likes.items).toHaveLength(1);
  });

  it("appends next posts page on loadMorePosts", async () => {
    vi.mocked(fetchProfilePostsClient)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          items: [makePost("p1")],
          nextCursor: "cursor-post-1",
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          items: [makePost("p2")],
          nextCursor: null,
        },
      });
    vi.mocked(fetchProfileLikesClient).mockResolvedValue({
      ok: true,
      data: {
        items: [],
        nextCursor: null,
      },
    });

    const { result } = renderHook(() => useProfile("user-1", true));

    await waitFor(() => {
      expect(result.current.posts.loading).toBe(false);
    });

    await act(async () => {
      await result.current.loadMorePosts();
    });

    expect(result.current.posts.items.map((item) => item.postId)).toEqual([
      "p1",
      "p2",
    ]);
    expect(fetchProfilePostsClient).toHaveBeenNthCalledWith(
      2,
      "user-1",
      "cursor-post-1",
    );
  });

  it("fetches likers only on my profile and caches per post", async () => {
    vi.mocked(fetchProfilePostsClient).mockResolvedValue({
      ok: true,
      data: {
        items: [makePost("p1")],
        nextCursor: null,
      },
    });
    vi.mocked(fetchProfileLikesClient).mockResolvedValue({
      ok: true,
      data: {
        items: [],
        nextCursor: null,
      },
    });
    vi.mocked(fetchPostLikersClient).mockResolvedValue({
      ok: true,
      data: {
        items: [makeLiker("u1")],
        nextCursor: null,
      },
    });

    const { result } = renderHook(() => useProfile("user-1", true));

    await waitFor(() => {
      expect(result.current.posts.loading).toBe(false);
    });

    await act(async () => {
      await result.current.toggleLikers("p1");
    });

    expect(result.current.expandedLikersId).toBe("p1");
    expect(result.current.likersMap.p1?.items).toHaveLength(1);
    expect(fetchPostLikersClient).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.toggleLikers("p1");
    });
    expect(result.current.expandedLikersId).toBeNull();

    await act(async () => {
      await result.current.toggleLikers("p1");
    });
    expect(result.current.expandedLikersId).toBe("p1");
    expect(fetchPostLikersClient).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent likers fetch for the same post", async () => {
    const likersDeferred = createDeferred<{
      ok: true;
      data: {
        items: PostLikerItem[];
        nextCursor: string | null;
      };
    }>();

    vi.mocked(fetchProfilePostsClient).mockResolvedValue({
      ok: true,
      data: {
        items: [makePost("p1")],
        nextCursor: null,
      },
    });
    vi.mocked(fetchProfileLikesClient).mockResolvedValue({
      ok: true,
      data: {
        items: [],
        nextCursor: null,
      },
    });
    vi.mocked(fetchPostLikersClient).mockReturnValue(likersDeferred.promise);

    const { result } = renderHook(() => useProfile("user-1", true));

    await waitFor(() => {
      expect(result.current.posts.loading).toBe(false);
    });

    const firstPromise = result.current.toggleLikers("p1");
    const secondPromise = result.current.toggleLikers("p1");

    likersDeferred.resolve({
      ok: true,
      data: {
        items: [makeLiker("u1")],
        nextCursor: null,
      },
    });

    await act(async () => {
      await Promise.all([firstPromise, secondPromise]);
    });

    expect(fetchPostLikersClient).toHaveBeenCalledTimes(1);
    expect(result.current.likersMap.p1?.items).toHaveLength(1);
  });

  it("removes and restores post optimistically", async () => {
    vi.mocked(fetchProfilePostsClient).mockResolvedValue({
      ok: true,
      data: {
        items: [makePost("p1"), makePost("p2")],
        nextCursor: null,
      },
    });
    vi.mocked(fetchProfileLikesClient).mockResolvedValue({
      ok: true,
      data: {
        items: [],
        nextCursor: null,
      },
    });

    const { result } = renderHook(() => useProfile("user-1", true));

    await waitFor(() => {
      expect(result.current.posts.loading).toBe(false);
      expect(result.current.posts.items).toHaveLength(2);
    });

    let snapshot: { item: ProfilePostItem; index: number } | null = null;
    act(() => {
      snapshot = result.current.removePostOptimistic("p1");
    });

    expect(result.current.posts.items.map((item) => item.postId)).toEqual([
      "p2",
    ]);
    expect(snapshot).not.toBeNull();

    act(() => {
      result.current.restoreRemovedPost(
        snapshot as { item: ProfilePostItem; index: number },
      );
    });

    expect(result.current.posts.items.map((item) => item.postId)).toEqual([
      "p1",
      "p2",
    ]);
  });

  it("resets tab and likers cache when user changes", async () => {
    vi.mocked(fetchProfilePostsClient)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          items: [makePost("p1")],
          nextCursor: null,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          items: [makePost("p2")],
          nextCursor: null,
        },
      });
    vi.mocked(fetchProfileLikesClient).mockResolvedValue({
      ok: true,
      data: {
        items: [makeLike("p1")],
        nextCursor: null,
      },
    });
    vi.mocked(fetchPostLikersClient).mockResolvedValue({
      ok: true,
      data: {
        items: [makeLiker("u1")],
        nextCursor: null,
      },
    });

    const { result, rerender } = renderHook(
      ({ userId }: { userId: string }) => useProfile(userId, true),
      { initialProps: { userId: "user-1" } },
    );

    await waitFor(() => {
      expect(result.current.posts.loading).toBe(false);
    });

    act(() => {
      result.current.setActiveTab("likes");
    });

    await waitFor(() => {
      expect(result.current.likes.loading).toBe(false);
      expect(result.current.activeTab).toBe("likes");
    });

    await act(async () => {
      await result.current.toggleLikers("p1");
    });

    expect(result.current.expandedLikersId).toBe("p1");
    expect(result.current.likersMap.p1?.items).toHaveLength(1);

    rerender({ userId: "user-2" });

    await waitFor(() => {
      expect(result.current.activeTab).toBe("posts");
    });

    expect(result.current.expandedLikersId).toBeNull();
    expect(Object.keys(result.current.likersMap)).toHaveLength(0);
  });
});

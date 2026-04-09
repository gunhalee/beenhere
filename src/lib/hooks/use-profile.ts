"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProfilePostItem, ProfileLikeItem, PostLikerItem } from "@/types/domain";
import {
  fetchProfilePostsClient,
  fetchProfileLikesClient,
  fetchPostLikersClient,
} from "@/lib/api/profile-client";
import {
  usePaginatedList,
  type PaginatedFetchResult,
  type PaginatedListState,
} from "./use-paginated-list";
import { useMountedRef } from "./use-mounted-ref";
import {
  getRemovedItemSnapshot,
  removeItemById,
  restoreRemovedItemInList,
  type RemovedItemSnapshot,
} from "./optimistic-removal";

export type ProfileTab = "posts" | "likes";

export type ProfileListState<T> = PaginatedListState<T>;

export type ProfileLikersState = {
  items: PostLikerItem[];
  nextCursor: string | null;
  loading: boolean;
};

export function useProfile(userId: string, isMyProfile: boolean) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [likesLoaded, setLikesLoaded] = useState(false);
  // 인라인 라이커 목록: postId -> 상태
  const [likersMap, setLikersMap] = useState<
    Record<string, ProfileLikersState | undefined>
  >({});
  // 어떤 postId의 라이커가 확장돼 있는지
  const [expandedLikersId, setExpandedLikersId] = useState<string | null>(null);

  const mountedRef = useMountedRef();
  const inFlightLikersRef = useRef<Set<string>>(new Set());
  const likersMapRef = useRef(likersMap);

  useEffect(() => {
    likersMapRef.current = likersMap;
  }, [likersMap]);

  const fetchPostsPage = useCallback(
    async (cursor?: string): Promise<PaginatedFetchResult<ProfilePostItem>> => {
      const result = await fetchProfilePostsClient(userId, cursor);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      return { ok: true, data: result.data };
    },
    [userId],
  );

  const fetchLikesPage = useCallback(
    async (cursor?: string): Promise<PaginatedFetchResult<ProfileLikeItem>> => {
      const result = await fetchProfileLikesClient(userId, cursor);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      return { ok: true, data: result.data };
    },
    [userId],
  );

  const {
    state: posts,
    load: loadPosts,
    loadMore: loadMorePosts,
    mutateItems: mutatePosts,
  } = usePaginatedList<ProfilePostItem>({
    fetchPage: fetchPostsPage,
    defaultErrorMessage: "글 목록을 불러오지 못했어요.",
  });

  const {
    state: likes,
    load: loadLikes,
    loadMore: loadMoreLikes,
    mutateItems: mutateLikes,
  } = usePaginatedList<ProfileLikeItem>({
    fetchPage: fetchLikesPage,
    defaultErrorMessage: "라이크 목록을 불러오지 못했어요.",
  });

  // ---------------------------
  // 초기에는 posts 탭만 로드
  // ---------------------------

  useEffect(() => {
    void loadPosts();
  }, [loadPosts, userId]);

  // likes 탭 진입 시 최초 1회 로드
  useEffect(() => {
    if (activeTab !== "likes" || likesLoaded) return;

    let cancelled = false;

    async function ensureLikesLoaded() {
      const ok = await loadLikes();
      if (cancelled || !mountedRef.current) return;
      if (ok) setLikesLoaded(true);
    }

    void ensureLikesLoaded();

    return () => {
      cancelled = true;
    };
  }, [activeTab, likesLoaded, loadLikes, mountedRef]);

  // userId 변경 시 likes 초기화
  useEffect(() => {
    setActiveTab("posts");
    setLikesLoaded(false);
    setExpandedLikersId(null);
    setLikersMap({});
  }, [userId]);

  // ---------------------------
  // 인라인 라이커 (작성자 전용)
  // ---------------------------

  const toggleLikers = useCallback(
    async (postId: string) => {
      if (!isMyProfile) return;

      if (expandedLikersId === postId) {
        setExpandedLikersId(null);
        return;
      }

      setExpandedLikersId(postId);

      if (likersMapRef.current[postId] || inFlightLikersRef.current.has(postId)) {
        return;
      }

      inFlightLikersRef.current.add(postId);

      setLikersMap((prev) => ({
        ...prev,
        [postId]: { items: [], nextCursor: null, loading: true },
      }));

      const result = await fetchPostLikersClient(postId);
      inFlightLikersRef.current.delete(postId);

      if (!mountedRef.current) return;

      if (!result.ok) {
        setLikersMap((prev) => ({
          ...prev,
          [postId]: { items: [], nextCursor: null, loading: false },
        }));
        return;
      }

      setLikersMap((prev) => ({
        ...prev,
        [postId]: {
          items: result.data.items,
          nextCursor: result.data.nextCursor,
          loading: false,
        },
      }));
    },
    [isMyProfile, expandedLikersId, mountedRef],
  );

  // 글 낙관적 업데이트 (라이크 후 likeCount 갱신)
  const updatePost = useCallback(
    (postId: string, patch: Partial<ProfilePostItem>) => {
      mutatePosts((items) =>
        items.map((item) =>
          item.postId === postId ? { ...item, ...patch } : item,
        ),
      );
    },
    [mutatePosts],
  );

  const updateLike = useCallback(
    (postId: string, patch: Partial<ProfileLikeItem>) => {
      mutateLikes((items) =>
        items.map((item) =>
          item.postId === postId ? { ...item, ...patch } : item,
        ),
      );
    },
    [mutateLikes],
  );

  const removePostOptimistic = useCallback(
    (postId: string) => {
      const snapshot = getRemovedItemSnapshot(
        posts.items,
        postId,
        (item) => item.postId,
      );
      if (!snapshot) return null;

      mutatePosts((items) => removeItemById(items, postId, (item) => item.postId));

      return snapshot;
    },
    [mutatePosts, posts.items],
  );

  const restoreRemovedPost = useCallback(
    (snapshot: RemovedItemSnapshot<ProfilePostItem>) => {
      mutatePosts((items) =>
        restoreRemovedItemInList(items, snapshot, (item) => item.postId),
      );
    },
    [mutatePosts],
  );

  return {
    activeTab,
    setActiveTab,
    posts,
    likes,
    loadMorePosts,
    loadMoreLikes,
    expandedLikersId,
    likersMap,
    toggleLikers,
    updatePost,
    updateLike,
    removePostOptimistic,
    restoreRemovedPost,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProfilePostItem, ProfileLikeItem, PostLikerItem } from "@/types/domain";
import {
  fetchProfilePostsClient,
  fetchProfileLikesClient,
  fetchPostLikersClient,
} from "@/lib/api/profile-client";

export type ProfileTab = "posts" | "likes";

export type ProfileListState<T> = {
  items: T[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  errorMessage: string | null;
};

function initialListState<T>(): ProfileListState<T> {
  return {
    items: [],
    nextCursor: null,
    loading: true,
    loadingMore: false,
    errorMessage: null,
  };
}

export type ProfileLikersState = {
  items: PostLikerItem[];
  nextCursor: string | null;
  loading: boolean;
};

export function useProfile(userId: string, isMyProfile: boolean) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [posts, setPosts] = useState<ProfileListState<ProfilePostItem>>(
    initialListState(),
  );
  const [likes, setLikes] = useState<ProfileListState<ProfileLikeItem>>(
    initialListState(),
  );
  // 인라인 라이커 목록: postId → 상태
  const [likersMap, setLikersMap] = useState<
    Record<string, ProfileLikersState | undefined>
  >({});
  // 어떤 postId의 라이커가 확장돼 있는지
  const [expandedLikersId, setExpandedLikersId] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const postsLoadingMoreRef = useRef(false);
  const likesLoadingMoreRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------------
  // 작성한 글 로드
  // ---------------------------

  const loadPosts = useCallback(async () => {
    if (!mountedRef.current) return;
    setPosts((s) => ({ ...s, loading: true, errorMessage: null }));

    const result = await fetchProfilePostsClient(userId);

    if (!mountedRef.current) return;

    if (!result.ok) {
      setPosts((s) => ({
        ...s,
        loading: false,
        errorMessage: result.error ?? "글 목록을 불러오지 못했어요.",
      }));
      return;
    }

    setPosts({
      items: result.data.items,
      nextCursor: result.data.nextCursor,
      loading: false,
      loadingMore: false,
      errorMessage: null,
    });
  }, [userId]);

  const loadMorePosts = useCallback(async () => {
    if (postsLoadingMoreRef.current) return;

    setPosts((prev) => {
      if (!prev.nextCursor) return prev;
      postsLoadingMoreRef.current = true;
      const cursor = prev.nextCursor;

      fetchProfilePostsClient(userId, cursor).then((result) => {
        if (!mountedRef.current) return;
        postsLoadingMoreRef.current = false;

        if (!result.ok) {
          setPosts((s) => ({ ...s, loadingMore: false }));
          return;
        }

        setPosts((s) => ({
          ...s,
          items: [...s.items, ...result.data.items],
          nextCursor: result.data.nextCursor,
          loadingMore: false,
        }));
      });

      return { ...prev, loadingMore: true };
    });
  }, [userId]);

  // ---------------------------
  // 라이크한 글 로드
  // ---------------------------

  const loadLikes = useCallback(async () => {
    if (!mountedRef.current) return;
    setLikes((s) => ({ ...s, loading: true, errorMessage: null }));

    const result = await fetchProfileLikesClient(userId);

    if (!mountedRef.current) return;

    if (!result.ok) {
      setLikes((s) => ({
        ...s,
        loading: false,
        errorMessage: result.error ?? "라이크 목록을 불러오지 못했어요.",
      }));
      return;
    }

    setLikes({
      items: result.data.items,
      nextCursor: result.data.nextCursor,
      loading: false,
      loadingMore: false,
      errorMessage: null,
    });
  }, [userId]);

  const loadMoreLikes = useCallback(async () => {
    if (likesLoadingMoreRef.current) return;

    setLikes((prev) => {
      if (!prev.nextCursor) return prev;
      likesLoadingMoreRef.current = true;
      const cursor = prev.nextCursor;

      fetchProfileLikesClient(userId, cursor).then((result) => {
        if (!mountedRef.current) return;
        likesLoadingMoreRef.current = false;

        if (!result.ok) {
          setLikes((s) => ({ ...s, loadingMore: false }));
          return;
        }

        setLikes((s) => ({
          ...s,
          items: [...s.items, ...result.data.items],
          nextCursor: result.data.nextCursor,
          loadingMore: false,
        }));
      });

      return { ...prev, loadingMore: true };
    });
  }, [userId]);

  // ---------------------------
  // 마운트 시 양쪽 탭 모두 로드
  // ---------------------------

  useEffect(() => {
    loadPosts();
    loadLikes();
  }, [loadPosts, loadLikes]);

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

      if (likersMap[postId]) return;

      setLikersMap((prev) => ({
        ...prev,
        [postId]: { items: [], nextCursor: null, loading: true },
      }));

      const result = await fetchPostLikersClient(postId);

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
    [isMyProfile, expandedLikersId, likersMap],
  );

  // 글 낙관적 업데이트 (라이크 후 likeCount 갱신)
  const updatePost = useCallback(
    (postId: string, patch: Partial<ProfilePostItem>) => {
      setPosts((s) => ({
        ...s,
        items: s.items.map((item) =>
          item.postId === postId ? { ...item, ...patch } : item,
        ),
      }));
    },
    [],
  );

  const updateLike = useCallback(
    (postId: string, patch: Partial<ProfileLikeItem>) => {
      setLikes((s) => ({
        ...s,
        items: s.items.map((item) =>
          item.postId === postId ? { ...item, ...patch } : item,
        ),
      }));
    },
    [],
  );

  // 글 삭제
  const removePost = useCallback((postId: string) => {
    setPosts((s) => ({
      ...s,
      items: s.items.filter((item) => item.postId !== postId),
    }));
  }, []);

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
    removePost,
  };
}

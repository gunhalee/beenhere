"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProfileLikeItem, ProfilePostItem } from "@/types/domain";
import {
  fetchProfileLikesClient,
  fetchProfilePostsClient,
} from "@/lib/api/profile-client";
import { createCursorPaginatedFetcher } from "./cursor-paginated-fetcher";
import { useMountedRef } from "./use-mounted-ref";
import { usePaginatedList } from "./use-paginated-list";
import type { ProfileTab } from "./profile-types";

export function useProfileLists(userId: string) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [likesLoaded, setLikesLoaded] = useState(false);
  const mountedRef = useMountedRef();

  const fetchPostsPage = useMemo(
    () =>
      createCursorPaginatedFetcher<ProfilePostItem>((cursor?: string) =>
        fetchProfilePostsClient(userId, cursor),
      ),
    [userId],
  );

  const fetchLikesPage = useMemo(
    () =>
      createCursorPaginatedFetcher<ProfileLikeItem>((cursor?: string) =>
        fetchProfileLikesClient(userId, cursor),
      ),
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
    defaultErrorMessage: "수집한 글 목록을 불러오지 못했어요.",
  });

  useEffect(() => {
    void loadPosts();
  }, [loadPosts, userId]);

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

  useEffect(() => {
    setActiveTab("posts");
    setLikesLoaded(false);
  }, [userId]);

  return {
    activeTab,
    setActiveTab,
    posts,
    likes,
    loadMorePosts,
    loadMoreLikes,
    mutatePosts,
    mutateLikes,
  };
}

"use client";

import { useCallback } from "react";
import type { ProfilePostItem, ProfileLikeItem } from "@/types/domain";
import {
  getRemovedItemSnapshot,
  removeItemById,
  restoreRemovedItemInList,
  type RemovedItemSnapshot,
} from "./optimistic-removal";
import { useProfileLikers } from "./use-profile-likers";
import { useProfileLists } from "./use-profile-lists";

export type { ProfileTab, ProfileListState, ProfileLikersState } from "./profile-types";

export function useProfile(userId: string, isMyProfile: boolean) {
  const {
    activeTab,
    setActiveTab,
    posts,
    likes,
    loadMorePosts,
    loadMoreLikes,
    mutatePosts,
    mutateLikes,
  } = useProfileLists(userId);
  const { expandedLikersId, likersMap, toggleLikers } = useProfileLikers(
    isMyProfile,
    userId,
  );

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

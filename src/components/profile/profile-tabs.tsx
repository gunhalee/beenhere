"use client";

import type { ProfileLikeItem as ProfileLikeItemType, ProfilePostItem } from "@/types/domain";
import type {
  ProfileLikersState,
  ProfileListState,
} from "@/lib/hooks/profile-types";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { ProfilePostItem as ProfilePostItemCard } from "./profile-post-item";
import { ProfileLikeItem as ProfileLikeItemCard } from "./profile-like-item";
import {
  ProfileLoadMoreButton,
  ProfileTabEmptyState,
} from "./profile-list-controls";

type PostsTabProps = {
  state: ProfileListState<ProfilePostItem>;
  isMyProfile: boolean;
  profileId: string;
  profileNickname: string;
  currentUserId: string | null;
  expandedLikersId: string | null;
  likersMap: Record<string, ProfileLikersState | undefined>;
  onLikeCountClick: (postId: string) => void;
  onDelete: (postId: string) => void;
  onReport: (postId: string) => void;
  onLoadMore: () => void;
};

export function ProfilePostsTabContent({
  state,
  isMyProfile,
  profileId,
  profileNickname,
  currentUserId,
  expandedLikersId,
  likersMap,
  onLikeCountClick,
  onDelete,
  onReport,
  onLoadMore,
}: PostsTabProps) {
  if (state.loading) return <LoadingState label="작성한 글 불러오는 중" />;
  if (state.errorMessage) return <ErrorState message={state.errorMessage} />;
  if (state.items.length === 0) {
    return <ProfileTabEmptyState message="작성한 글이 없어요." />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {state.items.map((item) => (
        <ProfilePostItemCard
          key={item.postId}
          item={item}
          isMyProfile={isMyProfile}
          profileId={profileId}
          profileNickname={profileNickname}
          currentUserId={currentUserId}
          expandedLikersId={expandedLikersId}
          likersMap={likersMap}
          onLikeCountClick={onLikeCountClick}
          onDelete={onDelete}
          onReport={onReport}
        />
      ))}

      {state.nextCursor && !state.loadingMore ? (
        <ProfileLoadMoreButton onClick={onLoadMore} label="더보기" />
      ) : null}

      {state.loadingMore ? <LoadingState label="더 불러오는 중" /> : null}
    </div>
  );
}

type LikesTabProps = {
  state: ProfileListState<ProfileLikeItemType>;
  likerId: string;
  likerNickname: string;
  onLike: (item: ProfileLikeItemType) => void;
  onReport: (postId: string) => void;
  onLoadMore: () => void;
};

export function ProfileLikesTabContent({
  state,
  likerId,
  likerNickname,
  onLike,
  onReport,
  onLoadMore,
}: LikesTabProps) {
  if (state.loading) return <LoadingState label="수집한 글 불러오는 중" />;
  if (state.errorMessage) return <ErrorState message={state.errorMessage} />;
  if (state.items.length === 0) {
    return <ProfileTabEmptyState message="수집한 글이 없어요." />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {state.items.map((item) => (
        <ProfileLikeItemCard
          key={item.postId}
          item={item}
          likerId={likerId}
          likerNickname={likerNickname}
          onLike={onLike}
          onReport={onReport}
        />
      ))}

      {state.nextCursor && !state.loadingMore ? (
        <ProfileLoadMoreButton onClick={onLoadMore} label="더보기" />
      ) : null}

      {state.loadingMore ? <LoadingState label="더 불러오는 중" /> : null}
    </div>
  );
}

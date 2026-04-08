"use client";

import type { ProfileLikeItem as ProfileLikeItemType, ProfilePostItem } from "@/types/domain";
import type {
  ProfileLikersState,
  ProfileListState,
} from "@/lib/hooks/use-profile";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { ProfilePostItem as ProfilePostItemCard } from "./profile-post-item";
import { ProfileLikeItem as ProfileLikeItemCard } from "./profile-like-item";

type PostsTabProps = {
  state: ProfileListState<ProfilePostItem>;
  isMyProfile: boolean;
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
    return (
      <p
        style={{
          color: "#9ca3af",
          fontSize: "14px",
          padding: "40px 0",
          textAlign: "center",
        }}
      >
        작성한 글이 없어요.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {state.items.map((item) => (
        <ProfilePostItemCard
          key={item.postId}
          item={item}
          isMyProfile={isMyProfile}
          currentUserId={currentUserId}
          expandedLikersId={expandedLikersId}
          likersMap={likersMap}
          onLikeCountClick={onLikeCountClick}
          onDelete={onDelete}
          onReport={onReport}
        />
      ))}

      {state.nextCursor && !state.loadingMore ? (
        <button
          onClick={onLoadMore}
          type="button"
          style={{
            appearance: "none",
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: "9999px",
            color: "#374151",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            padding: "12px",
            width: "100%",
          }}
        >
          더보기
        </button>
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
  if (state.loading) return <LoadingState label="라이크한 글 불러오는 중" />;
  if (state.errorMessage) return <ErrorState message={state.errorMessage} />;
  if (state.items.length === 0) {
    return (
      <p
        style={{
          color: "#9ca3af",
          fontSize: "14px",
          padding: "40px 0",
          textAlign: "center",
        }}
      >
        라이크한 글이 없어요.
      </p>
    );
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
        <button
          onClick={onLoadMore}
          type="button"
          style={{
            appearance: "none",
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: "9999px",
            color: "#374151",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            padding: "12px",
            width: "100%",
          }}
        >
          더보기
        </button>
      ) : null}

      {state.loadingMore ? <LoadingState label="더 불러오는 중" /> : null}
    </div>
  );
}

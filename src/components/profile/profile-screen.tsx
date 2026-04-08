"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ProfileLikeItem as ProfileLikeItemType,
  ProfilePostItem as ProfilePostItemType,
} from "@/types/domain";
import type { Coordinates } from "@/lib/geo/browser-location";
import { useProfile, type ProfileTab } from "@/lib/hooks/use-profile";
import { useProfileContext } from "@/lib/hooks/use-profile-context";
import { usePostActions } from "@/lib/hooks/use-post-actions";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { FeedReportDialog } from "@/components/feed/feed-report-dialog";
import { ProfileHeader } from "./profile-header";
import { ProfileBlockDialog } from "./profile-block-dialog";
import {
  ProfileLikesTabContent,
  ProfilePostsTabContent,
} from "./profile-tabs";

type Props = {
  userId: string;
};

const TAB_LABELS: Record<ProfileTab, string> = {
  posts: "작성한 글",
  likes: "라이크한 글",
};

type ProfileLikeableItem = {
  postId: string;
  likeCount: number;
  myLike: boolean;
  placeLabel?: string | null;
};

export function ProfileScreen({ userId }: Props) {
  const router = useRouter();
  const coordsRef = useRef<Coordinates | null>(null);

  const {
    profileLoadState,
    profileErrorMessage,
    nickname,
    setNickname,
    isMyProfile,
    currentUserId,
    nicknameChangedAt,
  } = useProfileContext(userId);

  const {
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
  } = useProfile(userId, isMyProfile);

  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockActionMessage, setBlockActionMessage] = useState<string | null>(
    null,
  );
  const [likeError, setLikeError] = useState<string | null>(null);

  const updateAnyItem = useCallback(
    (postId: string, patch: Partial<ProfileLikeableItem>) => {
      updatePost(postId, patch as Partial<ProfilePostItemType>);
      updateLike(postId, patch as Partial<ProfileLikeItemType>);
    },
    [updatePost, updateLike],
  );

  const {
    reportState,
    handleLike,
    handleDelete,
    openReport,
    closeReport,
    handleReport,
  } = usePostActions<ProfileLikeableItem>({
    updateItem: updateAnyItem,
    removeItem: removePost,
    coordsRef,
    onLocationError: setLikeError,
  });

  const onLike = useCallback(
    (item: ProfileLikeableItem) => {
      setLikeError(null);
      void handleLike(item);
    },
    [handleLike],
  );

  const onDelete = useCallback(
    (postId: string) => {
      void handleDelete(postId);
    },
    [handleDelete],
  );

  const onOpenReport = useCallback(
    (postId: string) => {
      setLikeError(null);
      openReport(postId);
    },
    [openReport],
  );

  const handleBlocked = useCallback(() => {
    setBlockDialogOpen(false);
    router.back();
  }, [router]);

  const handleUnblocked = useCallback(() => {
    setBlockDialogOpen(false);
    setBlockActionMessage("차단이 해제되었어요.");
  }, []);

  if (profileLoadState === "loading") {
    return (
      <div style={{ minHeight: "100dvh", padding: "24px" }}>
        <LoadingState label="프로필 불러오는 중" />
      </div>
    );
  }

  if (profileLoadState === "error") {
    return (
      <div style={{ minHeight: "100dvh", padding: "24px" }}>
        <ErrorState
          message={
            profileErrorMessage ??
            "존재하지 않거나 접근할 수 없는 프로필이에요."
          }
        />
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#f9fafb",
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
      }}
    >
      <ProfileHeader
        nickname={nickname}
        isMyProfile={isMyProfile}
        nicknameChangedAt={nicknameChangedAt}
        onBlockClick={() => {
          setBlockActionMessage(null);
          setBlockDialogOpen(true);
        }}
        onNicknameChange={setNickname}
      />

      <div
        style={{
          background: "#ffffff",
          borderBottom: "1px solid rgba(17, 24, 39, 0.06)",
          padding: "20px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            color: "#111827",
            fontSize: "22px",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            margin: 0,
          }}
        >
          {nickname}
        </p>
      </div>

      <div
        style={{
          background: "#ffffff",
          borderBottom: "1px solid rgba(17, 24, 39, 0.06)",
          display: "flex",
          position: "sticky",
          top: "57px",
          zIndex: 3,
        }}
      >
        {(["posts", "likes"] as ProfileTab[]).map((tab) => (
          <button
            key={tab}
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            type="button"
            style={{
              appearance: "none",
              background: "none",
              border: "none",
              borderBottom: `2px solid ${activeTab === tab ? "#111827" : "transparent"}`,
              color: activeTab === tab ? "#111827" : "#9ca3af",
              cursor: "pointer",
              flex: 1,
              fontSize: "13px",
              fontWeight: activeTab === tab ? 700 : 500,
              padding: "12px 0",
              transition: "color 0.15s",
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {likeError ? (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            borderBottom: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: "13px",
            lineHeight: 1.5,
            padding: "10px 20px",
          }}
        >
          {likeError}
        </div>
      ) : null}

      {blockActionMessage ? (
        <div
          role="status"
          style={{
            background: "#ecfdf3",
            borderBottom: "1px solid #bbf7d0",
            color: "#166534",
            fontSize: "13px",
            lineHeight: 1.5,
            padding: "10px 20px",
          }}
        >
          {blockActionMessage}
        </div>
      ) : null}

      <div style={{ flex: 1, padding: "16px" }}>
        {activeTab === "posts" ? (
          <ProfilePostsTabContent
            state={posts}
            isMyProfile={isMyProfile}
            currentUserId={currentUserId}
            expandedLikersId={expandedLikersId}
            likersMap={likersMap}
            onLikeCountClick={toggleLikers}
            onDelete={onDelete}
            onReport={onOpenReport}
            onLoadMore={loadMorePosts}
          />
        ) : (
          <ProfileLikesTabContent
            state={likes}
            likerId={userId}
            likerNickname={nickname}
            onLike={onLike}
            onReport={onOpenReport}
            onLoadMore={loadMoreLikes}
          />
        )}
      </div>

      {reportState.postId ? (
        <FeedReportDialog
          reportState={reportState}
          onConfirm={handleReport}
          onClose={closeReport}
        />
      ) : null}

      {blockDialogOpen ? (
        <ProfileBlockDialog
          targetNickname={nickname}
          targetUserId={userId}
          onBlocked={handleBlocked}
          onUnblocked={handleUnblocked}
          onClose={() => setBlockDialogOpen(false)}
        />
      ) : null}
    </div>
  );
}

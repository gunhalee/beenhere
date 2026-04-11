"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ProfileLikeItem as ProfileLikeItemType,
  ProfilePostItem as ProfilePostItemType,
} from "@/types/domain";
import type { Coordinates } from "@/lib/geo/browser-location";
import { useProfile } from "@/lib/hooks/use-profile";
import type { ProfileTab } from "@/lib/hooks/profile-types";
import { useProfileContext } from "@/lib/hooks/use-profile-context";
import { usePostActions } from "@/lib/hooks/use-post-actions";
import { redirectToLoginWithNext } from "@/lib/auth/login-redirect";
import { InlineBanner } from "@/components/common/inline-banner";
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
  likes: "수집한 글",
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
    setNicknameChangedAt,
    isMyProfile,
    currentUserId,
    nicknameChangedAt,
    viewerIsAnonymous,
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
    removePostOptimistic,
    restoreRemovedPost,
  } = useProfile(userId, isMyProfile);

  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockActionMessage, setBlockActionMessage] = useState<string | null>(
    null,
  );
  const [likeError, setLikeError] = useState<string | null>(null);

  const redirectToLogin = useCallback(() => {
    redirectToLoginWithNext(`/profile/${userId}`);
  }, [userId]);

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
  } = usePostActions<ProfileLikeableItem, ProfilePostItemType>({
    updateItem: updateAnyItem,
    removeItemOptimistic: removePostOptimistic,
    restoreRemovedItem: restoreRemovedPost,
    coordsRef,
    onLocationError: setLikeError,
    onActionError: setLikeError,
    onAuthRequired: redirectToLogin,
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
    setBlockActionMessage("차단을 해제했어요.");
  }, []);

  const showGuestProfileBanner = isMyProfile && viewerIsAnonymous;
  const tabsTopOffset = showGuestProfileBanner ? "105px" : "57px";

  if (profileLoadState === "loading") {
    return (
      <div style={{ minHeight: "100dvh", padding: "24px" }}>
        <LoadingState label="프로필 불러오는 중..." />
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
        onAuthRequired={redirectToLogin}
        onBlockClick={() => {
          setBlockActionMessage(null);
          setBlockDialogOpen(true);
        }}
        onNicknameChange={(newNickname, changedAt) => {
          setNickname(newNickname);
          setNicknameChangedAt(changedAt);
        }}
      />

      {showGuestProfileBanner ? (
        <InlineBanner
          message="Google 로그인 시 기기를 변경해도 데이터는 유지됩니다."
          tone="info"
          stickyTop="57px"
          centered
          padding="10px 16px"
          zIndex={3}
        />
      ) : null}

      <div
        style={{
          background: "#ffffff",
          borderBottom: "1px solid rgba(17, 24, 39, 0.06)",
          display: "flex",
          position: "sticky",
          top: tabsTopOffset,
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
        <InlineBanner message={likeError} tone="error" />
      ) : null}

      {blockActionMessage ? (
        <InlineBanner message={blockActionMessage} tone="success" />
      ) : null}

      <div style={{ flex: 1, padding: "16px" }}>
        {activeTab === "posts" ? (
          <ProfilePostsTabContent
            state={posts}
            isMyProfile={isMyProfile}
            profileId={userId}
            profileNickname={nickname}
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
          onAuthRequired={() => {
            setBlockDialogOpen(false);
            redirectToLogin();
          }}
        />
      ) : null}
    </div>
  );
}


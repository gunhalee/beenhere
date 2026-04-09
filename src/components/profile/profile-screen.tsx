"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  ProfileLikeItem as ProfileLikeItemType,
  ProfilePostItem as ProfilePostItemType,
} from "@/types/domain";
import type { Coordinates } from "@/lib/geo/browser-location";
import { startGoogleOAuth } from "@/lib/auth/google-oauth";
import { useProfile, type ProfileTab } from "@/lib/hooks/use-profile";
import { useProfileContext } from "@/lib/hooks/use-profile-context";
import { usePostActions } from "@/lib/hooks/use-post-actions";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { FeedReportDialog } from "@/components/feed/feed-report-dialog";
import { ProfileHeader } from "./profile-header";
import { ProfileBlockDialog } from "./profile-block-dialog";
import { ProfileLinkGoogleBanner } from "./profile-link-google-banner";
import {
  ProfileLikesTabContent,
  ProfilePostsTabContent,
} from "./profile-tabs";

type Props = {
  userId: string;
};

const TAB_LABELS: Record<ProfileTab, string> = {
  posts: "Posts",
  likes: "Likes",
};

const LINK_RESULT_MESSAGES: Record<string, string> = {
  identity_already_exists:
    "This Google account is already linked to another user.",
  exchange_failed: "Could not complete Google account linking. Please try again.",
  missing_code: "Could not find a valid Google linking token.",
  profile_missing: "Could not load profile information. Please try again.",
  user_missing: "Could not verify user session. Please sign in again.",
};

type ProfileLikeableItem = {
  postId: string;
  likeCount: number;
  myLike: boolean;
  placeLabel?: string | null;
};

export function ProfileScreen({ userId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
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
    viewerGoogleLinked,
    viewerCanLinkGoogle,
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
  const [linkGoogleLoading, setLinkGoogleLoading] = useState(false);
  const [linkGoogleError, setLinkGoogleError] = useState<string | null>(null);

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
    setBlockActionMessage("User unblocked.");
  }, []);

  const showLinkGoogleBanner =
    isMyProfile && viewerIsAnonymous && !viewerGoogleLinked && viewerCanLinkGoogle;
  const linkStatus = searchParams.get("google_link");
  const linkReason = searchParams.get("google_link_reason");
  const linkResultMessage = useMemo(() => {
    if (linkStatus === "success") {
      return {
        tone: "success" as const,
        message: "Google account linked successfully.",
      };
    }

    if (linkStatus === "failed") {
      const reasonKey = (linkReason ?? "").toLowerCase();
      return {
        tone: "error" as const,
        message:
          LINK_RESULT_MESSAGES[reasonKey] ??
          "Could not complete Google account linking. Please try again.",
      };
    }

    return null;
  }, [linkReason, linkStatus]);

  const handleLinkGoogle = useCallback(async () => {
    if (linkGoogleLoading) return;

    setLinkGoogleError(null);
    setLinkGoogleLoading(true);

    const result = await startGoogleOAuth({
      intent: "link-google",
      nextPath: `/profile/${userId}`,
    });

    if (!result.ok) {
      setLinkGoogleLoading(false);
      setLinkGoogleError(
        result.error ?? "Could not start Google account linking.",
      );
    }
  }, [linkGoogleLoading, userId]);

  if (profileLoadState === "loading") {
    return (
      <div style={{ minHeight: "100dvh", padding: "24px" }}>
        <LoadingState label="Loading profile..." />
      </div>
    );
  }

  if (profileLoadState === "error") {
    return (
      <div style={{ minHeight: "100dvh", padding: "24px" }}>
        <ErrorState
          message={
            profileErrorMessage ??
            "This profile does not exist or cannot be accessed."
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
        onNicknameChange={(newNickname, changedAt) => {
          setNickname(newNickname);
          setNicknameChangedAt(changedAt);
        }}
      />

      {isMyProfile && linkResultMessage ? (
        <div
          role={linkResultMessage.tone === "error" ? "alert" : "status"}
          style={{
            background:
              linkResultMessage.tone === "error" ? "#fef2f2" : "#ecfdf3",
            borderBottom:
              linkResultMessage.tone === "error"
                ? "1px solid #fecaca"
                : "1px solid #bbf7d0",
            color: linkResultMessage.tone === "error" ? "#b91c1c" : "#166534",
            fontSize: "13px",
            lineHeight: 1.5,
            padding: "10px 20px",
          }}
        >
          {linkResultMessage.message}
        </div>
      ) : null}

      {showLinkGoogleBanner ? (
        <ProfileLinkGoogleBanner
          loading={linkGoogleLoading}
          errorMessage={linkGoogleError}
          onClick={() => {
            void handleLinkGoogle();
          }}
        />
      ) : null}

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

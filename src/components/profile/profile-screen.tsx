"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  ProfileLikeItem as ProfileLikeItemType,
  ProfilePostItem as ProfilePostItemType,
} from "@/types/domain";
import type { Coordinates } from "@/lib/geo/browser-location";
import { startGoogleOAuth } from "@/lib/auth/google-oauth";
import { ensureGuestSession } from "@/lib/auth/guest-session";
import { useProfile, type ProfileTab } from "@/lib/hooks/use-profile";
import { useProfileContext } from "@/lib/hooks/use-profile-context";
import { usePostActions } from "@/lib/hooks/use-post-actions";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { AccountChoiceDialog } from "@/components/auth/account-choice-dialog";
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
  posts: "작성한 글",
  likes: "라이크한 글",
};

type LinkResultTone = "success" | "error";

type LinkResultMessage = {
  tone: LinkResultTone;
  message: string;
  showSwitchToGoogle?: boolean;
};

const LINK_RESULT_MESSAGES: Record<string, LinkResultMessage> = {
  identity_already_exists: {
    tone: "error",
    message:
      "이미 다른 사용자에 연동된 Google 계정이에요. 해당 Google 계정으로 전환할 수 있어요. 게스트 데이터는 자동 병합되지 않아요.",
    showSwitchToGoogle: true,
  },
  exchange_failed: {
    tone: "error",
    message: "Google 계정 연동을 완료하지 못했어요. 다시 시도해 주세요.",
  },
  missing_code: {
    tone: "error",
    message: "유효한 Google 연동 토큰을 찾지 못했어요.",
  },
  profile_missing: {
    tone: "error",
    message: "프로필 정보를 불러오지 못했어요. 다시 시도해 주세요.",
  },
  user_missing: {
    tone: "error",
    message: "사용자 세션을 확인하지 못했어요. 다시 로그인해 주세요.",
  },
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
  const [switchGoogleLoading, setSwitchGoogleLoading] = useState(false);

  const [accountChoiceOpen, setAccountChoiceOpen] = useState(false);
  const [accountChoiceError, setAccountChoiceError] = useState<string | null>(null);
  const [guestAuthLoading, setGuestAuthLoading] = useState(false);
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false);

  const openAccountChoice = useCallback(() => {
    setAccountChoiceError(null);
    setAccountChoiceOpen(true);
  }, []);

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
    onAuthRequired: openAccountChoice,
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

  const showLinkGoogleBanner =
    isMyProfile && viewerIsAnonymous && !viewerGoogleLinked && viewerCanLinkGoogle;
  const linkStatus = searchParams.get("google_link");
  const linkReason = searchParams.get("google_link_reason");
  const linkResultMessage = useMemo(() => {
    if (linkStatus === "success") {
      return {
        tone: "success" as const,
        message: "Google 계정 연동이 완료됐어요.",
      };
    }

    if (linkStatus === "failed") {
      const reasonKey = (linkReason ?? "").toLowerCase();
      return (
        LINK_RESULT_MESSAGES[reasonKey] ?? {
          tone: "error" as const,
          message: "Google 계정 연동을 완료하지 못했어요. 다시 시도해 주세요.",
        }
      );
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
        result.error ?? "Google 계정 연동을 시작하지 못했어요.",
      );
    }
  }, [linkGoogleLoading, userId]);

  const handleSwitchToLinkedGoogle = useCallback(async () => {
    if (switchGoogleLoading) return;

    setSwitchGoogleLoading(true);
    const result = await startGoogleOAuth({
      intent: "login",
      nextPath: `/profile/${userId}`,
    });

    if (!result.ok) {
      setSwitchGoogleLoading(false);
      setLikeError(result.error ?? "Google 로그인을 시작하지 못했어요.");
    }
  }, [switchGoogleLoading, userId]);

  const handleGuestContinue = useCallback(async () => {
    if (guestAuthLoading || googleAuthLoading) return;

    setGuestAuthLoading(true);
    setAccountChoiceError(null);

    const result = await ensureGuestSession();
    if (!result.ok) {
      setGuestAuthLoading(false);
      setAccountChoiceError(result.error);
      return;
    }

    // Session context is shared through Supabase cookies/storage, so a hard refresh is the safest sync path.
    window.location.href = `${window.location.pathname}${window.location.search}`;
  }, [googleAuthLoading, guestAuthLoading]);

  const handleGoogleContinue = useCallback(async () => {
    if (guestAuthLoading || googleAuthLoading) return;

    setGoogleAuthLoading(true);
    setAccountChoiceError(null);

    const result = await startGoogleOAuth({
      intent: "login",
      nextPath: `/profile/${userId}`,
    });

    if (!result.ok) {
      setGoogleAuthLoading(false);
      setAccountChoiceError(result.error ?? "Google 가입을 시작하지 못했어요.");
    }
  }, [googleAuthLoading, guestAuthLoading, userId]);

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
          <div>{linkResultMessage.message}</div>
          {linkResultMessage.showSwitchToGoogle ? (
            <button
              onClick={() => {
                void handleSwitchToLinkedGoogle();
              }}
              type="button"
              style={{
                appearance: "none",
                background: "none",
                border: "none",
                color: "#1d4ed8",
                cursor: switchGoogleLoading ? "default" : "pointer",
                fontSize: "13px",
                fontWeight: 600,
                marginTop: "6px",
                padding: 0,
                textDecoration: "underline",
              }}
            >
              {switchGoogleLoading
                ? "계정 전환 중..."
                : "해당 Google 계정으로 로그인"}
            </button>
          ) : null}
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
            openAccountChoice();
          }}
        />
      ) : null}

      <AccountChoiceDialog
        open={accountChoiceOpen}
        guestLoading={guestAuthLoading}
        googleLoading={googleAuthLoading}
        errorMessage={accountChoiceError}
        onGuestContinue={() => {
          void handleGuestContinue();
        }}
        onGoogleContinue={() => {
          void handleGoogleContinue();
        }}
        onClose={() => {
          if (guestAuthLoading || googleAuthLoading) return;
          setAccountChoiceOpen(false);
        }}
      />
    </div>
  );
}


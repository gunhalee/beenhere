"use client";

import { useCallback, useEffect, useState } from "react";
import { useFeed } from "@/lib/hooks/use-feed";
import { usePostActions } from "@/lib/hooks/use-post-actions";
import { useCurrentProfile } from "@/lib/hooks/use-current-profile";
import { useFeedCompose } from "@/lib/hooks/use-feed-compose";
import { useFeedLikerPreview } from "@/lib/hooks/use-feed-liker-preview";
import { usePullToRefresh } from "@/lib/hooks/use-pull-to-refresh";
import { redirectToLoginWithNext } from "@/lib/auth/login-redirect";
import type { FeedItem } from "@/types/domain";
import { InlineBanner } from "@/components/common/inline-banner";
import { FeedHeader } from "./feed-header";
import { FeedList } from "./feed-list";
import { FeedLocationBanner } from "./feed-location-banner";
import { FeedComposeFab } from "./feed-compose-fab";
import { FeedReportDialog } from "./feed-report-dialog";
import { ComposeSheet } from "./compose-sheet";

type Props = {
  currentUserId?: string | null;
  currentNickname?: string | null;
};

export function FeedScreen({ currentUserId, currentNickname }: Props) {
  const [postActionError, setPostActionError] = useState<string | null>(null);

  const {
    state,
    coordsRef,
    refresh,
    loadMore,
    updateItem,
    removeItemOptimistic,
    restoreRemovedItem,
    prependItem,
    requestLocation,
  } = useFeed();
  const { resolvedCurrentUserId, resolvedCurrentNickname } = useCurrentProfile({
    currentUserId,
    currentNickname,
    onAuthRequired: redirectToLoginWithNext,
  });
  const {
    composeState,
    composeLocating,
    composeError,
    setComposeError,
    openComposeSheet,
    closeComposeSheet,
    handleComposeSuccess: closeComposeAfterSuccess,
  } = useFeedCompose({ coordsRef });

  const {
    reportState,
    handleLike,
    handleDelete,
    openReport,
    closeReport,
    handleReport,
  } = usePostActions<FeedItem>({
    updateItem,
    removeItemOptimistic,
    restoreRemovedItem,
    coordsRef,
    onLocationError: setPostActionError,
    onActionError: setPostActionError,
    onAuthRequired: () => {
      redirectToLoginWithNext();
    },
  });

  const locationAvailable = !state.locationDenied;
  const { previewMap } = useFeedLikerPreview({
    items: state.items,
    coordsRef,
  });
  const {
    scrollContainerRef,
    pullOffset,
    pullReady,
    pullRefreshing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = usePullToRefresh({
    disabled: state.status === "loading" || state.status === "locating",
    onRefresh: async () => {
      await refresh({ silent: true });
    },
  });

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverscroll = html.style.overscrollBehaviorY;
    const prevBodyOverscroll = body.style.overscrollBehaviorY;
    const prevBodyOverflow = body.style.overflow;

    html.style.overscrollBehaviorY = "none";
    body.style.overscrollBehaviorY = "none";
    body.style.overflow = "hidden";

    return () => {
      html.style.overscrollBehaviorY = prevHtmlOverscroll;
      body.style.overscrollBehaviorY = prevBodyOverscroll;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  async function handleComposeClick() {
    if (!resolvedCurrentUserId) {
      redirectToLoginWithNext();
      return;
    }

    setPostActionError(null);
    await openComposeSheet();
  }

  function handleDismissCompose() {
    closeComposeSheet();
  }

  function handleComposeSuccess(newItem: FeedItem) {
    closeComposeAfterSuccess();
    prependItem(newItem);
  }

  const handleLikeClick = useCallback(
    (item: FeedItem) => {
      setPostActionError(null);
      void handleLike(item);
    },
    [handleLike],
  );

  const handleDeleteClick = useCallback(
    (postId: string) => {
      void handleDelete(postId);
    },
    [handleDelete],
  );

  const handleOpenReport = useCallback(
    (postId: string) => {
      setPostActionError(null);
      openReport(postId);
    },
    [openReport],
  );

  return (
    <div
      style={{
        background: "#f9fafb",
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        inset: 0,
        overflow: "hidden",
        position: "fixed",
        width: "100%",
      }}
    >
      <FeedHeader
        currentUserId={resolvedCurrentUserId}
        currentNickname={resolvedCurrentNickname}
        isAuthenticated
      />

      {state.locationDenied ? (
        <FeedLocationBanner onRequestPermission={requestLocation} />
      ) : null}

      {composeError ? (
        <InlineBanner message={composeError} tone="error" zIndex={3} />
      ) : null}

      {postActionError ? (
        <InlineBanner message={postActionError} tone="error" zIndex={3} />
      ) : null}

      <div
        ref={scrollContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => {
          void handleTouchEnd();
        }}
        onTouchCancel={() => {
          void handleTouchEnd();
        }}
        style={{
          flex: 1,
          overflowY: "auto",
          overscrollBehaviorY: "none",
          padding: "16px 16px 100px",
          touchAction: "pan-y",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          aria-hidden={!pullOffset}
          style={{
            alignItems: "center",
            color: "#6b7280",
            display: "flex",
            fontSize: "12px",
            fontWeight: 600,
            height: pullOffset ? `${pullOffset}px` : 0,
            justifyContent: "center",
            opacity: pullOffset ? 1 : 0,
            transition: pullRefreshing ? "height 0.2s ease, opacity 0.2s ease" : "none",
          }}
        >
          {pullRefreshing
            ? "새로고침 중..."
            : pullReady
              ? "놓으면 새로고침"
              : "당겨서 새로고침"}
        </div>

        <FeedList
          state={state}
          currentUserId={resolvedCurrentUserId}
          locationAvailable={locationAvailable}
          likerPreviewMap={previewMap}
          onLike={handleLikeClick}
          onDelete={handleDeleteClick}
          onReport={handleOpenReport}
          onLoadMore={loadMore}
          onRetry={refresh}
          onCompose={handleComposeClick}
        />
      </div>

      <FeedComposeFab loading={composeLocating} onClick={handleComposeClick} />

      {reportState.postId ? (
        <FeedReportDialog
          reportState={reportState}
          onConfirm={handleReport}
          onClose={closeReport}
        />
      ) : null}

      {composeState.open ? (
        <ComposeSheet
          coords={composeState.coords}
          currentUserId={resolvedCurrentUserId}
          currentNickname={resolvedCurrentNickname}
          onSuccess={handleComposeSuccess}
          onDismiss={handleDismissCompose}
        />
      ) : null}
    </div>
  );
}


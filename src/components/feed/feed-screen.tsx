"use client";

import { useCallback, useEffect, useState } from "react";
import type { Coordinates } from "@/lib/geo/browser-location";
import { fetchMyProfileClient } from "@/lib/api/profile-client";
import {
  getCurrentBrowserCoordinates,
  isGeoPermissionDenied,
} from "@/lib/geo/browser-location";
import { useFeed } from "@/lib/hooks/use-feed";
import { usePostActions } from "@/lib/hooks/use-post-actions";
import type { FeedItem } from "@/types/domain";
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

type ComposeState =
  | { open: false }
  | { open: true; coords: Coordinates };

export function FeedScreen({ currentUserId, currentNickname }: Props) {
  const [resolvedCurrentUserId, setResolvedCurrentUserId] = useState<string | null>(
    currentUserId ?? null,
  );
  const [resolvedCurrentNickname, setResolvedCurrentNickname] = useState<string | null>(
    currentNickname ?? null,
  );
  const [composeState, setComposeState] = useState<ComposeState>({ open: false });
  const [composeLocating, setComposeLocating] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [postActionError, setPostActionError] = useState<string | null>(null);

  const {
    state,
    coordsRef,
    refresh,
    loadMore,
    updateItem,
    removeItem,
    prependItem,
    requestLocation,
  } = useFeed();

  const {
    reportState,
    handleLike,
    handleDelete,
    openReport,
    closeReport,
    handleReport,
  } = usePostActions<FeedItem>({
    updateItem,
    removeItem,
    coordsRef,
    onLocationError: setPostActionError,
  });

  const locationAvailable = !state.locationDenied;
  const firstPlaceLabel = state.items[0]?.placeLabel ?? null;

  useEffect(() => {
    let cancelled = false;

    async function resolveCurrentProfile() {
      const result = await fetchMyProfileClient();
      if (cancelled) return;

      if (!result.ok) {
        if (result.code === "UNAUTHORIZED") {
          setResolvedCurrentUserId(null);
          setResolvedCurrentNickname(null);
        }
        return;
      }

      setResolvedCurrentUserId(result.data.id);
      setResolvedCurrentNickname(result.data.nickname);
    }

    void resolveCurrentProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleComposeClick() {
    if (composeLocating) return;

    setComposeError(null);
    setPostActionError(null);

    if (!resolvedCurrentUserId) {
      window.location.href = "/auth/login";
      return;
    }

    setComposeLocating(true);

    try {
      const coords = await getCurrentBrowserCoordinates();
      coordsRef.current = coords;
      setComposeState({ open: true, coords });
    } catch (err) {
      if (isGeoPermissionDenied(err)) {
        setComposeError(
          "위치 권한을 허용하면 글을 남길 수 있어요. 브라우저 설정을 확인해 주세요.",
        );
      } else {
        setComposeError("현재 위치를 확인하지 못했어요. 다시 시도해 주세요.");
      }
    } finally {
      setComposeLocating(false);
    }
  }

  function handleDismissCompose() {
    setComposeState({ open: false });
  }

  function handleComposeSuccess(newItem: FeedItem) {
    setComposeState({ open: false });
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
        placeLabel={firstPlaceLabel}
        currentUserId={resolvedCurrentUserId}
        currentNickname={resolvedCurrentNickname}
      />

      {state.locationDenied ? (
        <FeedLocationBanner onRequestPermission={requestLocation} />
      ) : null}

      {composeError ? (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            borderBottom: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: "13px",
            lineHeight: 1.5,
            padding: "10px 20px",
            position: "relative",
            zIndex: 3,
          }}
        >
          {composeError}
        </div>
      ) : null}

      {postActionError ? (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            borderBottom: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: "13px",
            lineHeight: 1.5,
            padding: "10px 20px",
            position: "relative",
            zIndex: 3,
          }}
        >
          {postActionError}
        </div>
      ) : null}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overscrollBehaviorY: "contain",
          padding: "16px 16px 100px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <FeedList
          state={state}
          currentUserId={resolvedCurrentUserId}
          locationAvailable={locationAvailable}
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

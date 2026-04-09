"use client";

import { useCallback, useEffect, useState } from "react";
import type { Coordinates } from "@/lib/geo/browser-location";
import { fetchMyProfileClient } from "@/lib/api/profile-client";
import { API_ERROR_CODE } from "@/lib/api/common-errors";
import {
  getCachedBrowserCoordinates,
  getCurrentBrowserCoordinates,
  getGeoErrorMessage,
} from "@/lib/geo/browser-location";
import { useFeed } from "@/lib/hooks/use-feed";
import { useMountedRef } from "@/lib/hooks/use-mounted-ref";
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
  const mountedRef = useMountedRef();

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
  });

  const locationAvailable = !state.locationDenied;
  const firstPlaceLabel = state.items[0]?.placeLabel ?? null;

  useEffect(() => {
    if (resolvedCurrentUserId && resolvedCurrentNickname) {
      return;
    }

    async function resolveCurrentProfile() {
      const result = await fetchMyProfileClient();
      if (!mountedRef.current) return;

      if (!result.ok) {
        if (result.code === API_ERROR_CODE.UNAUTHORIZED) {
          setResolvedCurrentUserId(null);
          setResolvedCurrentNickname(null);
        }
        return;
      }

      setResolvedCurrentUserId(result.data.id);
      setResolvedCurrentNickname(result.data.nickname);
    }

    void resolveCurrentProfile();
  }, [mountedRef, resolvedCurrentNickname, resolvedCurrentUserId]);

  async function handleComposeClick() {
    if (composeLocating) return;

    setComposeError(null);
    setPostActionError(null);

    if (!resolvedCurrentUserId) {
      window.location.href = "/auth/login";
      return;
    }

    if (coordsRef.current) {
      setComposeState({ open: true, coords: coordsRef.current });
      return;
    }

    const cachedCoords = getCachedBrowserCoordinates();
    if (cachedCoords) {
      coordsRef.current = cachedCoords;
      setComposeState({ open: true, coords: cachedCoords });
      return;
    }

    setComposeLocating(true);

    try {
      const coords = await getCurrentBrowserCoordinates({ context: "compose" });
      coordsRef.current = coords;
      setComposeState({ open: true, coords });
    } catch (err) {
      setComposeError(getGeoErrorMessage(err, "compose"));
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

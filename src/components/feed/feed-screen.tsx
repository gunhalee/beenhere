"use client";

import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
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
import { ensureGuestSession } from "@/lib/auth/guest-session";
import { startGoogleOAuth } from "@/lib/auth/google-oauth";
import type { FeedItem } from "@/types/domain";
import { AccountChoiceDialog } from "@/components/auth/account-choice-dialog";
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

const PULL_TO_REFRESH_TRIGGER_PX = 64;
const PULL_TO_REFRESH_MAX_PX = 92;
const PULL_TO_REFRESH_DRAG_RATIO = 0.45;

export function FeedScreen({ currentUserId, currentNickname }: Props) {
  const [resolvedCurrentUserId, setResolvedCurrentUserId] = useState<string | null>(
    currentUserId ?? null,
  );
  const [resolvedCurrentNickname, setResolvedCurrentNickname] = useState<string | null>(
    currentNickname ?? null,
  );
  const [resolvedHasProfile, setResolvedHasProfile] = useState(
    Boolean(currentUserId && currentNickname),
  );
  const [composeState, setComposeState] = useState<ComposeState>({ open: false });
  const [composeLocating, setComposeLocating] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [postActionError, setPostActionError] = useState<string | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const [accountChoiceOpen, setAccountChoiceOpen] = useState(false);
  const [accountChoiceError, setAccountChoiceError] = useState<string | null>(null);
  const [guestAuthLoading, setGuestAuthLoading] = useState(false);
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false);
  const [resumeComposeAfterAuth, setResumeComposeAfterAuth] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pullStartYRef = useRef<number | null>(null);
  const pullGestureActiveRef = useRef(false);
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

  const openAccountChoice = useCallback((options?: { resumeCompose?: boolean }) => {
    setAccountChoiceError(null);
    setAccountChoiceOpen(true);
    setResumeComposeAfterAuth(options?.resumeCompose ?? false);
  }, []);

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
      openAccountChoice();
    },
    onWriteSettled: () => {
      setResolvedHasProfile(true);
    },
  });

  const locationAvailable = !state.locationDenied;
  const firstPlaceLabel = state.items[0]?.placeLabel ?? null;
  const pullOffset = pullRefreshing
    ? Math.max(pullDistance, PULL_TO_REFRESH_TRIGGER_PX)
    : pullDistance;
  const pullReady = pullDistance >= PULL_TO_REFRESH_TRIGGER_PX;

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
          setResolvedHasProfile(false);
        }
        return;
      }

      setResolvedCurrentUserId(result.data.id);
      setResolvedCurrentNickname(result.data.nickname);
      setResolvedHasProfile(result.data.profileCreated ?? true);
    }

    void resolveCurrentProfile();
  }, [mountedRef, resolvedCurrentNickname, resolvedCurrentUserId]);

  const openComposeSheet = useCallback(async () => {
    if (composeLocating) return;

    setComposeError(null);
    setPostActionError(null);

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
  }, [composeLocating, coordsRef]);

  async function handleComposeClick() {
    if (!resolvedCurrentUserId) {
      openAccountChoice({ resumeCompose: true });
      return;
    }

    await openComposeSheet();
  }

  const handleGuestContinue = useCallback(async () => {
    if (guestAuthLoading || googleAuthLoading) return;

    setGuestAuthLoading(true);
    setAccountChoiceError(null);

    const sessionResult = await ensureGuestSession();
    if (!sessionResult.ok) {
      if (mountedRef.current) {
        setGuestAuthLoading(false);
        setAccountChoiceError(sessionResult.error);
      }
      return;
    }

    const profileResult = await fetchMyProfileClient({ force: true });
    if (!mountedRef.current) return;

    if (profileResult.ok) {
      setResolvedCurrentUserId(profileResult.data.id);
      setResolvedCurrentNickname(profileResult.data.nickname);
      setResolvedHasProfile(profileResult.data.profileCreated ?? true);
    } else {
      // Fallback for transient profile-read failures right after session bootstrap.
      setResolvedCurrentUserId(sessionResult.userId);
      setResolvedCurrentNickname("게스트");
      setResolvedHasProfile(false);
    }

    setGuestAuthLoading(false);
    setAccountChoiceOpen(false);
  }, [googleAuthLoading, guestAuthLoading, mountedRef]);

  const handleGoogleContinue = useCallback(async () => {
    if (guestAuthLoading || googleAuthLoading) return;

    setGoogleAuthLoading(true);
    setAccountChoiceError(null);

    const nextPath = `${window.location.pathname}${window.location.search}`;
    const result = await startGoogleOAuth({
      intent: "login",
      nextPath,
    });

    if (!result.ok && mountedRef.current) {
      setGoogleAuthLoading(false);
      setAccountChoiceError(result.error ?? "Google 가입을 시작하지 못했어요.");
    }
  }, [googleAuthLoading, guestAuthLoading, mountedRef]);

  useEffect(() => {
    if (!resumeComposeAfterAuth) return;
    if (accountChoiceOpen) return;
    if (!resolvedCurrentUserId) return;

    setResumeComposeAfterAuth(false);
    void openComposeSheet();
  }, [accountChoiceOpen, openComposeSheet, resolvedCurrentUserId, resumeComposeAfterAuth]);

  function handleDismissCompose() {
    setComposeState({ open: false });
  }

  function handleComposeSuccess(newItem: FeedItem) {
    setComposeState({ open: false });
    prependItem(newItem);
    setResolvedHasProfile(true);
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

  const resetPullGesture = useCallback(() => {
    pullStartYRef.current = null;
    pullGestureActiveRef.current = false;
    if (mountedRef.current) {
      setPullDistance(0);
    }
  }, [mountedRef]);

  const canStartPullToRefresh = useCallback(() => {
    if (pullRefreshing) return false;
    if (state.status === "loading" || state.status === "locating") return false;
    const container = scrollContainerRef.current;
    if (!container) return false;
    return container.scrollTop <= 0;
  }, [pullRefreshing, state.status]);

  const handleTouchStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (!canStartPullToRefresh()) {
        resetPullGesture();
        return;
      }
      pullStartYRef.current = event.touches[0]?.clientY ?? null;
      pullGestureActiveRef.current = pullStartYRef.current !== null;
    },
    [canStartPullToRefresh, resetPullGesture],
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (!pullGestureActiveRef.current) return;
      if (pullStartYRef.current === null) return;

      const currentY = event.touches[0]?.clientY;
      if (typeof currentY !== "number") return;

      const rawDistance = currentY - pullStartYRef.current;
      if (rawDistance <= 0) {
        setPullDistance(0);
        return;
      }

      // Prevent browser-level page pull-down while custom feed pull-to-refresh is active.
      event.preventDefault();

      const easedDistance = Math.min(
        PULL_TO_REFRESH_MAX_PX,
        rawDistance * PULL_TO_REFRESH_DRAG_RATIO,
      );
      setPullDistance(easedDistance);
    },
    [],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pullGestureActiveRef.current) {
      resetPullGesture();
      return;
    }

    const shouldRefresh = pullDistance >= PULL_TO_REFRESH_TRIGGER_PX;
    resetPullGesture();

    if (!shouldRefresh || pullRefreshing) {
      return;
    }

    setPullRefreshing(true);
    await refresh({ silent: true });
    if (mountedRef.current) {
      setPullRefreshing(false);
    }
  }, [mountedRef, pullDistance, pullRefreshing, refresh, resetPullGesture]);

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
        isAuthenticated={Boolean(resolvedCurrentUserId)}
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
          setResumeComposeAfterAuth(false);
        }}
      />
    </div>
  );
}


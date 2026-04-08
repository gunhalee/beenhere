"use client";

import { useState } from "react";
import type { Coordinates } from "@/lib/geo/browser-location";
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
  currentUserId: string | null;
  currentNickname: string | null;
};

type ComposeState =
  | { open: false }
  | { open: true; coords: Coordinates };

export function FeedScreen({ currentUserId, currentNickname }: Props) {
  const { state, coordsRef, refresh, loadMore, updateItem, removeItem, prependItem, requestLocation } =
    useFeed();
  const { reportState, handleLike, handleDelete, openReport, closeReport, handleReport } =
    usePostActions({ updateItem, removeItem, coordsRef });

  const [composeState, setComposeState] = useState<ComposeState>({ open: false });
  const [composeLocating, setComposeLocating] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  const locationAvailable = !state.locationDenied && coordsRef.current !== null;

  // 피드에 표시할 첫 번째 장소 라벨 (헤더 위치 표시용)
  const firstPlaceLabel = state.items[0]?.placeLabel ?? null;

  // ---------------------------
  // 글 작성 FAB
  // ---------------------------
  async function handleComposeClick() {
    if (composeLocating) return;

    setComposeError(null);

    // 로그인 체크
    if (!currentUserId) {
      window.location.href = "/auth/login";
      return;
    }

    setComposeLocating(true);

    try {
      // 작성 시에는 항상 최신 위치를 새로 요청한다
      const coords = await getCurrentBrowserCoordinates();
      // 좌표도 피드용으로 갱신
      coordsRef.current = coords;
      setComposeState({ open: true, coords });
    } catch (err) {
      if (isGeoPermissionDenied(err)) {
        setComposeError("위치 권한을 허용하면 글을 남길 수 있어요. 브라우저 설정을 확인해 주세요.");
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

  // ---------------------------
  // 라이크: 좌표 없으면 막기
  // ---------------------------
  function handleLikeWithCheck(item: FeedItem) {
    if (!coordsRef.current) return;
    handleLike(item);
  }

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
      {/* 헤더 */}
      <FeedHeader
        placeLabel={firstPlaceLabel}
        currentUserId={currentUserId}
        currentNickname={currentNickname}
      />

      {/* 위치 권한 배너 */}
      {state.locationDenied ? (
        <FeedLocationBanner onRequestPermission={requestLocation} />
      ) : null}

      {/* 글 작성 에러 메시지 (위치 거부 시) */}
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

      {/* 피드 스크롤 영역 */}
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
          currentUserId={currentUserId}
          locationAvailable={locationAvailable}
          onLike={handleLikeWithCheck}
          onDelete={handleDelete}
          onReport={openReport}
          onLoadMore={loadMore}
          onRetry={refresh}
          onCompose={handleComposeClick}
        />
      </div>

      {/* 글 작성 FAB */}
      <FeedComposeFab loading={composeLocating} onClick={handleComposeClick} />

      {/* 신고 다이얼로그 */}
      {reportState.postId ? (
        <FeedReportDialog
          reportState={reportState}
          onConfirm={handleReport}
          onClose={closeReport}
        />
      ) : null}

      {/* 글 작성 시트 */}
      {composeState.open ? (
        <ComposeSheet
          coords={composeState.coords}
          currentUserId={currentUserId}
          currentNickname={currentNickname}
          onSuccess={handleComposeSuccess}
          onDismiss={handleDismissCompose}
        />
      ) : null}
    </div>
  );
}

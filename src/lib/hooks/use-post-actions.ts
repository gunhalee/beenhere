"use client";

import { useCallback, useRef, useState } from "react";
import type { FeedItem } from "@/types/domain";
import type { Coordinates } from "@/lib/geo/browser-location";
import {
  likePostClient,
  deletePostClient,
  reportPostClient,
} from "@/lib/api/feed-client";

type Actions = {
  updateItem: (postId: string, patch: Partial<FeedItem>) => void;
  removeItem: (postId: string) => void;
  coordsRef: React.RefObject<Coordinates | null>;
};

export type ReportState = {
  postId: string | null;
  submitting: boolean;
  errorMessage: string | null;
  successMessage: string | null;
};

// ---------------------------
// 훅
// ---------------------------

export function usePostActions({ updateItem, removeItem, coordsRef }: Actions) {
  const likePendingRef = useRef<Set<string>>(new Set());
  const [reportState, setReportState] = useState<ReportState>({
    postId: null,
    submitting: false,
    errorMessage: null,
    successMessage: null,
  });

  // ---------------------------
  // 라이크 (캐시된 좌표 사용)
  // ---------------------------
  const handleLike = useCallback(
    async (item: FeedItem) => {
      if (item.myLike) return;
      if (likePendingRef.current.has(item.postId)) return;

      const coords = coordsRef.current;
      if (!coords) return;

      likePendingRef.current.add(item.postId);

      // 낙관적 업데이트
      updateItem(item.postId, {
        myLike: true,
        likeCount: item.likeCount + 1,
      });

      const result = await likePostClient(item.postId, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        placeLabel: item.placeLabel,
      });

      likePendingRef.current.delete(item.postId);

      if (!result.ok) {
        // 낙관적 업데이트 롤백
        updateItem(item.postId, {
          myLike: false,
          likeCount: item.likeCount,
        });
      } else {
        updateItem(item.postId, { likeCount: result.data.likeCount });
      }
    },
    [coordsRef, updateItem],
  );

  // ---------------------------
  // 삭제
  // ---------------------------
  const handleDelete = useCallback(
    async (postId: string) => {
      removeItem(postId);
      const result = await deletePostClient(postId);
      if (!result.ok) {
        // 삭제 실패 — 실제 서비스에서는 아이템 복원이 필요하지만 MVP에서는 새로고침 유도
        console.error("[usePostActions] 삭제 실패:", result.error);
      }
    },
    [removeItem],
  );

  // ---------------------------
  // 신고 다이얼로그 제어
  // ---------------------------
  const openReport = useCallback((postId: string) => {
    setReportState({
      postId,
      submitting: false,
      errorMessage: null,
      successMessage: null,
    });
  }, []);

  const closeReport = useCallback(() => {
    setReportState((s) => ({ ...s, postId: null }));
  }, []);

  const handleReport = useCallback(async (reasonCode: string) => {
    setReportState((s) => {
      if (!s.postId) return s;
      return { ...s, submitting: true, errorMessage: null };
    });

    setReportState((prev) => {
      if (!prev.postId) return prev;
      const postId = prev.postId;

      reportPostClient(postId, reasonCode).then((result) => {
        if (!result.ok) {
          setReportState((s) => ({
            ...s,
            submitting: false,
            errorMessage: "신고를 처리하지 못했어요. 다시 시도해 주세요.",
          }));
        } else {
          setReportState((s) => ({
            ...s,
            submitting: false,
            successMessage: "신고가 접수됐어요. 검토 후 조치할게요.",
          }));
        }
      });

      return prev;
    });
  }, []);

  return {
    reportState,
    handleLike,
    handleDelete,
    openReport,
    closeReport,
    handleReport,
  };
}

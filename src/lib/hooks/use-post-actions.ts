"use client";

import {
  useCallback,
  useRef,
  useState,
} from "react";
import type { Coordinates } from "@/lib/geo/browser-location";
import { resolveCoordinatesWithRef } from "@/lib/geo/resolve-coordinates";
import {
  getGeocodingErrorMessage,
} from "@/lib/geo/reverse-geocode";
import { resolvePlaceLabelWithCache } from "@/lib/geo/place-label-cache";
import {
  likePostClient,
  deletePostClient,
  reportPostClient,
} from "@/lib/api/feed-client";
import type { RemovedItemSnapshot } from "./optimistic-removal";

export type { RemovedItemSnapshot } from "./optimistic-removal";

export type LikeablePostItem = {
  postId: string;
  likeCount: number;
  myLike: boolean;
  placeLabel?: string | null;
};

type Actions<TItem extends LikeablePostItem, TRemovedItem> = {
  updateItem: (postId: string, patch: Partial<TItem>) => void;
  removeItemOptimistic: (postId: string) => RemovedItemSnapshot<TRemovedItem> | null;
  restoreRemovedItem: (snapshot: RemovedItemSnapshot<TRemovedItem>) => void;
  coordsRef: { current: Coordinates | null };
  onLocationError?: (message: string) => void;
  onActionError?: (message: string) => void;
};

export type ReportState = {
  postId: string | null;
  submitting: boolean;
  errorMessage: string | null;
  successMessage: string | null;
};

export function usePostActions<
  TItem extends LikeablePostItem,
  TRemovedItem = TItem,
>({
  updateItem,
  removeItemOptimistic,
  restoreRemovedItem,
  coordsRef,
  onLocationError,
  onActionError,
}: Actions<TItem, TRemovedItem>) {
  const likePendingRef = useRef<Set<string>>(new Set());
  const deletePendingRef = useRef<Set<string>>(new Set());

  const [reportState, setReportState] = useState<ReportState>({
    postId: null,
    submitting: false,
    errorMessage: null,
    successMessage: null,
  });

  const resolveCoordinates = useCallback(async (): Promise<Coordinates | null> => {
    const coordinateResult = await resolveCoordinatesWithRef({
      coordsRef,
      context: "like",
      errorContext: "like",
    });

    if (!coordinateResult.ok) {
      onLocationError?.(coordinateResult.message);
      return null;
    }

    return coordinateResult.coords;
  }, [coordsRef, onLocationError]);

  const resolveLikePlaceLabel = useCallback(
    async (coords: Coordinates, fallbackLabel?: string | null) => {
      try {
        return await resolvePlaceLabelWithCache(coords);
      } catch (error) {
        onLocationError?.(getGeocodingErrorMessage(error));
        return fallbackLabel?.trim() || "현재 위치";
      }
    },
    [onLocationError],
  );

  const handleLike = useCallback(
    async (item: TItem) => {
      if (item.myLike) return;
      if (likePendingRef.current.has(item.postId)) return;

      likePendingRef.current.add(item.postId);

      const coords = await resolveCoordinates();
      if (!coords) {
        likePendingRef.current.delete(item.postId);
        return;
      }

      const placeLabel = await resolveLikePlaceLabel(coords, item.placeLabel);

      updateItem(item.postId, {
        myLike: true,
        likeCount: item.likeCount + 1,
      } as Partial<TItem>);

      const result = await likePostClient(item.postId, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        placeLabel,
      });

      likePendingRef.current.delete(item.postId);

      if (!result.ok) {
        updateItem(item.postId, {
          myLike: false,
          likeCount: item.likeCount,
        } as Partial<TItem>);
        onActionError?.(result.error ?? "라이크를 처리하지 못했어요. 다시 시도해 주세요.");
        return;
      }

      updateItem(item.postId, {
        likeCount: result.data.likeCount,
      } as Partial<TItem>);
    },
    [onActionError, resolveCoordinates, resolveLikePlaceLabel, updateItem],
  );

  const handleDelete = useCallback(
    async (postId: string) => {
      if (deletePendingRef.current.has(postId)) return;
      const snapshot = removeItemOptimistic(postId);
      if (!snapshot) return;

      deletePendingRef.current.add(postId);
      const result = await deletePostClient(postId);

      deletePendingRef.current.delete(postId);
      if (!result.ok) {
        restoreRemovedItem(snapshot);
        onActionError?.(result.error ?? "삭제를 완료하지 못했어요. 다시 시도해 주세요.");
        console.error("[usePostActions] post delete failed:", result.error);
      }
    },
    [onActionError, removeItemOptimistic, restoreRemovedItem],
  );

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

  const handleReport = useCallback(
    async (reasonCode: string) => {
      if (!reportState.postId || reportState.submitting) return;

      const postId = reportState.postId;
      setReportState((s) => ({
        ...s,
        submitting: true,
        errorMessage: null,
        successMessage: null,
      }));

      const result = await reportPostClient(postId, reasonCode);

      if (!result.ok) {
        setReportState((s) => ({
          ...s,
          submitting: false,
          errorMessage: "신고를 처리하지 못했어요. 다시 시도해 주세요.",
        }));
        return;
      }

      setReportState((s) => ({
        ...s,
        submitting: false,
        successMessage: "신고가 접수되었어요. 검토 후 조치할게요.",
      }));
    },
    [reportState.postId, reportState.submitting],
  );

  return {
    reportState,
    handleLike,
    handleDelete,
    openReport,
    closeReport,
    handleReport,
  };
}

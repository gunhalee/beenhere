"use client";

import {
  useCallback,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { Coordinates } from "@/lib/geo/browser-location";
import {
  getCurrentBrowserCoordinates,
  isGeoPermissionDenied,
} from "@/lib/geo/browser-location";
import {
  getGeocodingErrorMessage,
  resolvePlaceLabel,
} from "@/lib/geo/reverse-geocode";
import {
  likePostClient,
  deletePostClient,
  reportPostClient,
} from "@/lib/api/feed-client";

export type LikeablePostItem = {
  postId: string;
  likeCount: number;
  myLike: boolean;
  placeLabel?: string | null;
};

type Actions<TItem extends LikeablePostItem> = {
  updateItem: (postId: string, patch: Partial<TItem>) => void;
  removeItem: (postId: string) => void;
  coordsRef: RefObject<Coordinates | null>;
  onLocationError?: (message: string) => void;
};

export type ReportState = {
  postId: string | null;
  submitting: boolean;
  errorMessage: string | null;
  successMessage: string | null;
};

export function usePostActions<TItem extends LikeablePostItem>({
  updateItem,
  removeItem,
  coordsRef,
  onLocationError,
}: Actions<TItem>) {
  const likePendingRef = useRef<Set<string>>(new Set());
  const placeLabelCacheRef = useRef<{
    latitude: number;
    longitude: number;
    placeLabel: string;
  } | null>(null);

  const [reportState, setReportState] = useState<ReportState>({
    postId: null,
    submitting: false,
    errorMessage: null,
    successMessage: null,
  });

  const resolveCoordinates = useCallback(async (): Promise<Coordinates | null> => {
    if (coordsRef.current) return coordsRef.current;

    try {
      const coords = await getCurrentBrowserCoordinates();
      coordsRef.current = coords;
      return coords;
    } catch (error) {
      const message = isGeoPermissionDenied(error)
        ? "위치 권한을 허용해야 라이크를 남길 수 있어요."
        : "현재 위치를 확인하지 못했어요. 다시 시도해 주세요.";
      onLocationError?.(message);
      return null;
    }
  }, [coordsRef, onLocationError]);

  const resolveLikePlaceLabel = useCallback(
    async (coords: Coordinates, fallbackLabel?: string | null) => {
      const cache = placeLabelCacheRef.current;
      if (
        cache &&
        cache.latitude === coords.latitude &&
        cache.longitude === coords.longitude
      ) {
        return cache.placeLabel;
      }

      try {
        const placeLabel = await resolvePlaceLabel(coords);
        placeLabelCacheRef.current = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          placeLabel,
        };
        return placeLabel;
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

      const coords = await resolveCoordinates();
      if (!coords) return;

      const placeLabel = await resolveLikePlaceLabel(coords, item.placeLabel);
      likePendingRef.current.add(item.postId);

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
        return;
      }

      updateItem(item.postId, {
        likeCount: result.data.likeCount,
      } as Partial<TItem>);
    },
    [resolveCoordinates, resolveLikePlaceLabel, updateItem],
  );

  const handleDelete = useCallback(
    async (postId: string) => {
      removeItem(postId);
      const result = await deletePostClient(postId);
      if (!result.ok) {
        console.error("[usePostActions] post delete failed:", result.error);
      }
    },
    [removeItem],
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

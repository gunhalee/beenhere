"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedItem } from "@/types/domain";
import {
  getCurrentBrowserCoordinates,
  isGeoPermissionDenied,
  type Coordinates,
} from "@/lib/geo/browser-location";
import { fetchNearbyFeed } from "@/lib/api/feed-client";

// ---------------------------
// 타입
// ---------------------------

export type FeedStatus =
  | "idle"
  | "locating"
  | "loading"
  | "success"
  | "error";

export type FeedHookState = {
  status: FeedStatus;
  items: FeedItem[];
  nextCursor: string | null;
  loadingMore: boolean;
  errorMessage: string | null;
  locationDenied: boolean;
};

const INITIAL_STATE: FeedHookState = {
  status: "idle",
  items: [],
  nextCursor: null,
  loadingMore: false,
  errorMessage: null,
  locationDenied: false,
};

// ---------------------------
// 훅
// ---------------------------

export function useFeed() {
  const [state, setState] = useState<FeedHookState>(INITIAL_STATE);
  const coordsRef = useRef<Coordinates | null>(null);
  const mountedRef = useRef(true);
  const loadingMoreRef = useRef(false);

  // 피드 로드 (초기 또는 새로고침)
  const loadFeed = useCallback(async (coords: Coordinates) => {
    if (!mountedRef.current) return;
    setState((s) => ({
      ...s,
      status: "loading",
      errorMessage: null,
      locationDenied: false,
    }));

    const result = await fetchNearbyFeed({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });

    if (!mountedRef.current) return;

    if (!result.ok) {
      setState((s) => ({
        ...s,
        status: "error",
        errorMessage: result.error ?? "피드를 불러오지 못했어요.",
      }));
      return;
    }

    setState((s) => ({
      ...s,
      status: "success",
      items: result.data.items,
      nextCursor: result.data.nextCursor,
    }));
  }, []);

  // 초기화: 위치 요청 → 피드 로드
  const initFeed = useCallback(async () => {
    if (!mountedRef.current) return;
    setState((s) => ({ ...s, status: "locating", locationDenied: false }));

    try {
      const coords = await getCurrentBrowserCoordinates();
      if (!mountedRef.current) return;
      coordsRef.current = coords;
      await loadFeed(coords);
    } catch (err) {
      if (!mountedRef.current) return;
      if (isGeoPermissionDenied(err)) {
        setState((s) => ({
          ...s,
          status: "error",
          locationDenied: true,
          errorMessage: null,
        }));
      } else {
        setState((s) => ({
          ...s,
          status: "error",
          locationDenied: false,
          errorMessage:
            err instanceof Error
              ? "현재 위치를 확인하지 못했어요. 다시 시도해 주세요."
              : "알 수 없는 오류가 발생했어요.",
        }));
      }
    }
  }, [loadFeed]);

  // 마운트 시 초기화
  useEffect(() => {
    mountedRef.current = true;
    initFeed();
    return () => {
      mountedRef.current = false;
    };
  }, [initFeed]);

  // 더 보기 (커서 페이지네이션)
  const loadMore = useCallback(async () => {
    const coords = coordsRef.current;
    if (!coords || loadingMoreRef.current) return;

    setState((prev) => {
      if (!prev.nextCursor) return prev;
      loadingMoreRef.current = true;
      return { ...prev, loadingMore: true };
    });

    // 현재 커서를 ref에서 읽기 위해 setState 콜백 사용
    setState((prev) => {
      if (!prev.nextCursor) {
        loadingMoreRef.current = false;
        return { ...prev, loadingMore: false };
      }

      const cursor = prev.nextCursor;

      fetchNearbyFeed({
        latitude: coords.latitude,
        longitude: coords.longitude,
        cursor,
      }).then((result) => {
        if (!mountedRef.current) return;
        loadingMoreRef.current = false;

        if (!result.ok) {
          setState((s) => ({ ...s, loadingMore: false }));
          return;
        }

        setState((s) => ({
          ...s,
          items: [...s.items, ...result.data.items],
          nextCursor: result.data.nextCursor,
          loadingMore: false,
        }));
      });

      return prev;
    });
  }, []);

  // 아이템 낙관적 업데이트
  const updateItem = useCallback(
    (postId: string, patch: Partial<FeedItem>) => {
      setState((s) => ({
        ...s,
        items: s.items.map((item) =>
          item.postId === postId ? { ...item, ...patch } : item,
        ),
      }));
    },
    [],
  );

  // 아이템 제거 (삭제 후)
  const removeItem = useCallback((postId: string) => {
    setState((s) => ({
      ...s,
      items: s.items.filter((item) => item.postId !== postId),
    }));
  }, []);

  // 피드 최상단에 아이템 추가 (글 작성 후)
  const prependItem = useCallback((item: FeedItem) => {
    setState((s) => ({ ...s, items: [item, ...s.items] }));
  }, []);

  const refresh = useCallback(async () => {
    if (coordsRef.current) {
      await loadFeed(coordsRef.current);
    } else {
      await initFeed();
    }
  }, [loadFeed, initFeed]);

  return {
    state,
    coordsRef,
    refresh,
    loadMore,
    updateItem,
    removeItem,
    prependItem,
    requestLocation: initFeed,
  };
}

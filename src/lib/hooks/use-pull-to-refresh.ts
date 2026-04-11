"use client";

import { useCallback, useRef, useState, type TouchEvent } from "react";
import { useMountedRef } from "./use-mounted-ref";

const PULL_TO_REFRESH_TRIGGER_PX = 64;
const PULL_TO_REFRESH_MAX_PX = 92;
const PULL_TO_REFRESH_DRAG_RATIO = 0.45;

type Params = {
  disabled: boolean;
  onRefresh: () => Promise<void>;
};

export function usePullToRefresh({ disabled, onRefresh }: Params) {
  const [pullDistance, setPullDistance] = useState(0);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pullStartYRef = useRef<number | null>(null);
  const pullGestureActiveRef = useRef(false);
  const mountedRef = useMountedRef();

  const resetPullGesture = useCallback(() => {
    pullStartYRef.current = null;
    pullGestureActiveRef.current = false;
    if (mountedRef.current) {
      setPullDistance(0);
    }
  }, [mountedRef]);

  const canStartPullToRefresh = useCallback(() => {
    if (disabled || pullRefreshing) return false;
    const container = scrollContainerRef.current;
    if (!container) return false;
    return container.scrollTop <= 0;
  }, [disabled, pullRefreshing]);

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

  const handleTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (!pullGestureActiveRef.current || pullStartYRef.current === null) return;

    const currentY = event.touches[0]?.clientY;
    if (typeof currentY !== "number") return;

    const rawDistance = currentY - pullStartYRef.current;
    if (rawDistance <= 0) {
      setPullDistance(0);
      return;
    }

    event.preventDefault();

    const easedDistance = Math.min(
      PULL_TO_REFRESH_MAX_PX,
      rawDistance * PULL_TO_REFRESH_DRAG_RATIO,
    );
    setPullDistance(easedDistance);
  }, []);

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
    await onRefresh();
    if (mountedRef.current) {
      setPullRefreshing(false);
    }
  }, [mountedRef, onRefresh, pullDistance, pullRefreshing, resetPullGesture]);

  return {
    scrollContainerRef,
    pullDistance,
    pullRefreshing,
    pullReady: pullDistance >= PULL_TO_REFRESH_TRIGGER_PX,
    pullOffset: pullRefreshing
      ? Math.max(pullDistance, PULL_TO_REFRESH_TRIGGER_PX)
      : pullDistance,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}

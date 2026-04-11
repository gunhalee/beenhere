"use client";

import { useCallback } from "react";
import { fetchFeedState } from "@/lib/api/feed-client";
import { useVisiblePolling } from "./use-visible-polling";
import type { FeedHookState } from "./use-feed";

const FEED_VISIBLE_POLL_INTERVAL_MS = 60_000;
const FEED_VISIBLE_POLL_MAX_INTERVAL_MS = 5 * 60_000;

type Coordinates = {
  latitude: number;
  longitude: number;
};

type Params = {
  coordsRef: { current: Coordinates | null };
  locationDenied: boolean;
  status: FeedHookState["status"];
  loadingMore: boolean;
  feedStateVersionRef: { current: string | null };
  refreshFeed: (coords: Coordinates) => Promise<boolean>;
};

export function useFeedPolling({
  coordsRef,
  locationDenied,
  status,
  loadingMore,
  feedStateVersionRef,
  refreshFeed,
}: Params) {
  const handleTick = useCallback(
    async (isCancelled: () => boolean) => {
      if (isCancelled()) return;
      if (status === "loading" || status === "locating" || loadingMore) {
        return;
      }

      const coords = coordsRef.current;
      if (!coords) return;

      const stateResult = await fetchFeedState();
      if (!stateResult.ok) return false;

      const latestStateVersion = stateResult.data.stateVersion;
      const previousStateVersion = feedStateVersionRef.current;

      if (!previousStateVersion) {
        feedStateVersionRef.current = latestStateVersion;
        return;
      }

      if (previousStateVersion === latestStateVersion) {
        return;
      }

      const refreshed = await refreshFeed(coords);
      if (!refreshed) return false;

      feedStateVersionRef.current = latestStateVersion;
    },
    [coordsRef, feedStateVersionRef, loadingMore, refreshFeed, status],
  );

  useVisiblePolling({
    enabled: Boolean(coordsRef.current) && !locationDenied,
    intervalMs: FEED_VISIBLE_POLL_INTERVAL_MS,
    maxIntervalMs: FEED_VISIBLE_POLL_MAX_INTERVAL_MS,
    label: "feed_refresh",
    runImmediately: false,
    onTick: handleTick,
  });
}

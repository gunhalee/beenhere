"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedItem } from "@/types/domain";
import {
  getGeoErrorMessage,
  isGeoPermissionDenied,
  type Coordinates,
} from "@/lib/geo/browser-location";
import { resolveCoordinatesWithRef } from "@/lib/geo/resolve-coordinates";
import { fetchFeedState, fetchNearbyFeed } from "@/lib/api/feed-client";
import {
  usePaginatedList,
  type PaginatedFetchResult,
} from "./use-paginated-list";
import { useMountedRef } from "./use-mounted-ref";
import { useVisiblePolling } from "./use-visible-polling";
import {
  getRemovedItemSnapshot,
  removeItemById,
  restoreRemovedItemInList,
  type RemovedItemSnapshot,
} from "./optimistic-removal";

type FeedStatus = "idle" | "locating" | "loading" | "success" | "error";

export type FeedHookState = {
  status: FeedStatus;
  items: FeedItem[];
  nextCursor: string | null;
  loadingMore: boolean;
  errorMessage: string | null;
  locationDenied: boolean;
};

const FEED_VISIBLE_POLL_INTERVAL_MS = 60_000;
const FEED_VISIBLE_POLL_MAX_INTERVAL_MS = 5 * 60_000;
const FEED_INITIAL_LOCATION_TIMEOUT_MS = 8_000;

export function useFeed() {
  const [status, setStatus] = useState<FeedStatus>("idle");
  const [locationDenied, setLocationDenied] = useState(false);
  const [locationErrorMessage, setLocationErrorMessage] = useState<string | null>(
    null,
  );

  const coordsRef = useRef<Coordinates | null>(null);
  const feedStateVersionRef = useRef<string | null>(null);
  const mountedRef = useMountedRef();

  const fetchFeedPage = useCallback(
    async (cursor?: string): Promise<PaginatedFetchResult<FeedItem>> => {
      const coords = coordsRef.current;
      if (!coords) {
        return {
          ok: false,
          error: getGeoErrorMessage(new Error("GEOLOCATION_UNAVAILABLE")),
        };
      }

      const result = await fetchNearbyFeed({
        latitude: coords.latitude,
        longitude: coords.longitude,
        cursor,
      });

      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      if (result.data.stateVersion) {
        feedStateVersionRef.current = result.data.stateVersion;
      }

      return { ok: true, data: result.data };
    },
    [],
  );

  const {
    state: feedListState,
    load: loadFirstPage,
    loadMore: loadMorePage,
    mutateItems,
    prependItem,
  } = usePaginatedList<FeedItem>({
    fetchPage: fetchFeedPage,
    defaultErrorMessage: "피드를 불러오지 못했어요.",
    initialLoading: false,
  });

  const loadFeed = useCallback(
    async (coords: Coordinates, options?: { silent?: boolean }) => {
      if (!mountedRef.current) return false;
      const silent = options?.silent ?? false;

      coordsRef.current = coords;
      if (!silent) {
        setStatus("loading");
        setLocationDenied(false);
        setLocationErrorMessage(null);
      }

      const ok = await loadFirstPage();
      if (!mountedRef.current) return false;

      if (silent) {
        if (ok) {
          setStatus("success");
          setLocationDenied(false);
          setLocationErrorMessage(null);
          return true;
        }

        setStatus((prev) => (prev === "success" ? "success" : "error"));
        return false;
      }

      setStatus(ok ? "success" : "error");
      return ok;
    },
    [loadFirstPage, mountedRef],
  );

  const refreshFeedFromBrowserCoordinates = useCallback(async () => {
    const coordinateResult = await resolveCoordinatesWithRef({
      coordsRef,
      context: "feed",
      allowRef: false,
      allowCached: false,
    });

    if (!coordinateResult.ok || !mountedRef.current) return;
    await loadFeed(coordinateResult.coords, { silent: true });
  }, [loadFeed, mountedRef]);

  const initFeed = useCallback(async () => {
    if (!mountedRef.current) return;

    setStatus("locating");
    setLocationDenied(false);
    setLocationErrorMessage(null);

    const coordinateResult = await resolveCoordinatesWithRef({
      coordsRef,
      context: "feed",
      timeoutMs: FEED_INITIAL_LOCATION_TIMEOUT_MS,
    });

    if (!mountedRef.current) return;

    if (coordinateResult.ok) {
      await loadFeed(coordinateResult.coords);
      if (!mountedRef.current) return;

      if (coordinateResult.source === "cache") {
        void refreshFeedFromBrowserCoordinates();
      }
      return;
    }

    if (isGeoPermissionDenied(coordinateResult.error)) {
      setStatus("error");
      setLocationDenied(true);
      setLocationErrorMessage(null);
      return;
    }

    setStatus("error");
    setLocationDenied(false);
    setLocationErrorMessage(coordinateResult.message);
  }, [loadFeed, mountedRef, refreshFeedFromBrowserCoordinates]);

  useEffect(() => {
    void initFeed();
  }, [initFeed]);

  useVisiblePolling({
    enabled: Boolean(coordsRef.current) && !locationDenied,
    intervalMs: FEED_VISIBLE_POLL_INTERVAL_MS,
    maxIntervalMs: FEED_VISIBLE_POLL_MAX_INTERVAL_MS,
    label: "feed_refresh",
    runImmediately: false,
    onTick: async (isCancelled) => {
      if (isCancelled()) return;
      if (status === "loading" || status === "locating" || feedListState.loadingMore) {
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

      const refreshed = await loadFeed(coords, { silent: true });
      if (!refreshed) return false;

      feedStateVersionRef.current = latestStateVersion;
    },
  });

  const loadMore = useCallback(async () => {
    if (!coordsRef.current) return;
    await loadMorePage();
  }, [loadMorePage]);

  const updateItem = useCallback(
    (postId: string, patch: Partial<FeedItem>) => {
      mutateItems((items) =>
        items.map((item) =>
          item.postId === postId ? { ...item, ...patch } : item,
        ),
      );
    },
    [mutateItems],
  );

  const removeItemOptimistic = useCallback(
    (postId: string) => {
      const snapshot = getRemovedItemSnapshot(
        feedListState.items,
        postId,
        (item) => item.postId,
      );
      if (!snapshot) return null;

      mutateItems((items) => removeItemById(items, postId, (item) => item.postId));
      return snapshot;
    },
    [feedListState.items, mutateItems],
  );

  const restoreRemovedItem = useCallback(
    (snapshot: RemovedItemSnapshot<FeedItem>) => {
      mutateItems((items) =>
        restoreRemovedItemInList(items, snapshot, (item) => item.postId),
      );
    },
    [mutateItems],
  );

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      if (coordsRef.current) {
        await loadFeed(coordsRef.current, options);
      } else {
        await initFeed();
      }
    },
    [loadFeed, initFeed],
  );

  const state: FeedHookState = {
    status,
    items: feedListState.items,
    nextCursor: feedListState.nextCursor,
    loadingMore: feedListState.loadingMore,
    errorMessage: locationErrorMessage ?? feedListState.errorMessage,
    locationDenied,
  };

  return {
    state,
    coordsRef,
    refresh,
    loadMore,
    updateItem,
    removeItemOptimistic,
    restoreRemovedItem,
    prependItem,
    requestLocation: initFeed,
  };
}

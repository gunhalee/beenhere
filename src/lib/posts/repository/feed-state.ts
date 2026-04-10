import {
  hasSupabaseBrowserConfig,
  hasSupabaseServerConfig,
} from "@/lib/supabase/config";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

type FeedStateRow = {
  version: number | string;
  source_last_activity_at: string | null;
  refreshed_at: string;
};

export type FeedStateSnapshot = {
  stateVersion: string;
  refreshedAt: string;
  sourceLastActivityAt: string | null;
};

const MOCK_FEED_STATE: FeedStateSnapshot = {
  stateVersion: "mock-static",
  refreshedAt: new Date(0).toISOString(),
  sourceLastActivityAt: null,
};

const FEED_STATE_READ_CACHE_TTL_MS = 1500;

type FeedStateReadCacheEntry = {
  snapshot: FeedStateSnapshot;
  expiresAt: number;
};

let feedStateReadCache: FeedStateReadCacheEntry | null = null;
let inFlightFeedStateReadPromise: Promise<FeedStateSnapshot> | null = null;

function normalizeFeedState(row: FeedStateRow | null | undefined): FeedStateSnapshot {
  if (!row) {
    return MOCK_FEED_STATE;
  }

  return {
    stateVersion: String(row.version),
    refreshedAt: row.refreshed_at,
    sourceLastActivityAt: row.source_last_activity_at ?? null,
  };
}

function setFeedStateReadCache(snapshot: FeedStateSnapshot) {
  feedStateReadCache = {
    snapshot,
    expiresAt: Date.now() + FEED_STATE_READ_CACHE_TTL_MS,
  };
}

function getFeedStateReadCache(): FeedStateSnapshot | null {
  if (!feedStateReadCache) return null;

  if (feedStateReadCache.expiresAt <= Date.now()) {
    feedStateReadCache = null;
    return null;
  }

  return feedStateReadCache.snapshot;
}

export function clearFeedStateReadCache() {
  feedStateReadCache = null;
  inFlightFeedStateReadPromise = null;
  inFlightBestEffortRefreshPromise = null;
  lastBestEffortRefreshAtMs = 0;
}

export async function readFeedStateCachedRepository(
  options?: { force?: boolean },
): Promise<FeedStateSnapshot> {
  const force = options?.force ?? false;

  if (!force) {
    const cached = getFeedStateReadCache();
    if (cached) {
      return cached;
    }

    if (inFlightFeedStateReadPromise) {
      return inFlightFeedStateReadPromise;
    }
  }

  const request = readFeedStateRepository()
    .then((snapshot) => {
      setFeedStateReadCache(snapshot);
      return snapshot;
    })
    .finally(() => {
      if (inFlightFeedStateReadPromise === request) {
        inFlightFeedStateReadPromise = null;
      }
    });

  inFlightFeedStateReadPromise = request;
  return request;
}

export async function readFeedStateRepository(): Promise<FeedStateSnapshot> {
  if (!hasSupabaseBrowserConfig()) {
    return MOCK_FEED_STATE;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_feed_state");

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  const snapshot = normalizeFeedState((row as FeedStateRow | null | undefined) ?? null);
  setFeedStateReadCache(snapshot);
  return snapshot;
}

export async function refreshFeedStateRepository(): Promise<FeedStateSnapshot> {
  if (!hasSupabaseServerConfig()) {
    throw new Error("Supabase server config is missing.");
  }

  const supabase = await createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("refresh_feed_state");

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  const snapshot = normalizeFeedState((row as FeedStateRow | null | undefined) ?? null);
  setFeedStateReadCache(snapshot);
  return snapshot;
}

const FEED_STATE_REFRESH_BEST_EFFORT_TIMEOUT_MS = 800;
const FEED_STATE_REFRESH_BEST_EFFORT_DEDUP_WINDOW_MS = 1500;
let inFlightBestEffortRefreshPromise: Promise<void> | null = null;
let lastBestEffortRefreshAtMs = 0;

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("FEED_STATE_REFRESH_TIMEOUT"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function refreshFeedStateBestEffort(reason: string): Promise<void> {
  if (!hasSupabaseServerConfig()) {
    return;
  }

  if (
    lastBestEffortRefreshAtMs > 0 &&
    Date.now() - lastBestEffortRefreshAtMs < FEED_STATE_REFRESH_BEST_EFFORT_DEDUP_WINDOW_MS
  ) {
    return;
  }

  if (inFlightBestEffortRefreshPromise) {
    return inFlightBestEffortRefreshPromise;
  }

  const refreshPromise = (async () => {
    try {
      await runWithTimeout(
        refreshFeedStateRepository(),
        FEED_STATE_REFRESH_BEST_EFFORT_TIMEOUT_MS,
      );
    } catch (error) {
      console.warn(`[feed-state] refresh skipped (${reason}):`, error);
    } finally {
      lastBestEffortRefreshAtMs = Date.now();
    }
  })().finally(() => {
    if (inFlightBestEffortRefreshPromise === refreshPromise) {
      inFlightBestEffortRefreshPromise = null;
    }
  });

  inFlightBestEffortRefreshPromise = refreshPromise;
  return refreshPromise;
}

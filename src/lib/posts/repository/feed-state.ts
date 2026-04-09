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

export async function readFeedStateRepository(): Promise<FeedStateSnapshot> {
  if (!hasSupabaseBrowserConfig()) {
    return MOCK_FEED_STATE;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_feed_state");

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return normalizeFeedState((row as FeedStateRow | null | undefined) ?? null);
}

export async function refreshFeedStateRepository(): Promise<FeedStateSnapshot> {
  if (!hasSupabaseServerConfig()) {
    throw new Error("Supabase server config is missing.");
  }

  const supabase = await createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("refresh_feed_state");

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return normalizeFeedState((row as FeedStateRow | null | undefined) ?? null);
}

const FEED_STATE_REFRESH_BEST_EFFORT_TIMEOUT_MS = 800;

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

  try {
    await runWithTimeout(
      refreshFeedStateRepository(),
      FEED_STATE_REFRESH_BEST_EFFORT_TIMEOUT_MS,
    );
  } catch (error) {
    console.warn(`[feed-state] refresh skipped (${reason}):`, error);
  }
}

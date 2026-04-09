import {
  hasSupabaseBrowserConfig,
  hasSupabaseServerConfig,
} from "@/lib/supabase/config";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

type ErrorLike = {
  code?: unknown;
  message?: unknown;
};

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

const FEED_STATE_LEGACY_VERSION_PREFIX = "legacy:";
const FEED_STATE_COMPATIBILITY_WARNING_KEYS = {
  READ: "read",
  READ_FALLBACK_FAILED: "read_fallback_failed",
  REFRESH: "refresh",
  REFRESH_FALLBACK_FAILED: "refresh_fallback_failed",
} as const;

const warnedFeedStateCompatibility = new Set<string>();

function warnFeedStateCompatibilityOnce(
  key: string,
  message: string,
  detail: unknown,
) {
  if (warnedFeedStateCompatibility.has(key)) return;
  warnedFeedStateCompatibility.add(key);
  console.warn(message, detail);
}

function getErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const code = (error as ErrorLike).code;
  return typeof code === "string" ? code : "";
}

function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const message = (error as ErrorLike).message;
  return typeof message === "string" ? message : "";
}

function isFeedStateCompatibilityError(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code === "PGRST202" || code === "42883" || code === "42P01") {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();
  if (!message) return false;

  return (
    message.includes("get_feed_state") ||
    message.includes("refresh_feed_state") ||
    message.includes("could not find the function") ||
    message.includes("function") && message.includes("does not exist")
  );
}

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

function buildLegacyFeedStateSnapshot(sourceLastActivityAt: string | null): FeedStateSnapshot {
  return {
    stateVersion: sourceLastActivityAt
      ? `${FEED_STATE_LEGACY_VERSION_PREFIX}${sourceLastActivityAt}`
      : `${FEED_STATE_LEGACY_VERSION_PREFIX}empty`,
    refreshedAt: new Date().toISOString(),
    sourceLastActivityAt,
  };
}

type LatestPostActivityRow = {
  last_activity_at: string;
};

async function readLatestPostActivityFromServerClient(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("posts")
    .select("last_activity_at")
    .eq("status", "active")
    .gt("active_until", new Date().toISOString())
    .order("last_activity_at", { ascending: false })
    .limit(1);

  if (error) throw error;

  const row = (data as LatestPostActivityRow[] | null)?.[0];
  return row?.last_activity_at ?? null;
}

async function readLatestPostActivityFromAdminClient(): Promise<string | null> {
  const supabase = await createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("posts")
    .select("last_activity_at")
    .eq("status", "active")
    .gt("active_until", new Date().toISOString())
    .order("last_activity_at", { ascending: false })
    .limit(1);

  if (error) throw error;

  const row = (data as LatestPostActivityRow[] | null)?.[0];
  return row?.last_activity_at ?? null;
}

async function readLegacyFeedStateFromServerClient(): Promise<FeedStateSnapshot> {
  const latest = await readLatestPostActivityFromServerClient();
  return buildLegacyFeedStateSnapshot(latest);
}

async function readLegacyFeedStateFromAdminClient(): Promise<FeedStateSnapshot> {
  const latest = await readLatestPostActivityFromAdminClient();
  return buildLegacyFeedStateSnapshot(latest);
}

export async function readFeedStateRepository(): Promise<FeedStateSnapshot> {
  if (!hasSupabaseBrowserConfig()) {
    return MOCK_FEED_STATE;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_feed_state");

  if (error) {
    if (!isFeedStateCompatibilityError(error)) {
      throw error;
    }

    warnFeedStateCompatibilityOnce(
      FEED_STATE_COMPATIBILITY_WARNING_KEYS.READ,
      "[feed-state] get_feed_state RPC unavailable. Falling back to legacy state read.",
      error,
    );

    try {
      return await readLegacyFeedStateFromServerClient();
    } catch (legacyError) {
      warnFeedStateCompatibilityOnce(
        FEED_STATE_COMPATIBILITY_WARNING_KEYS.READ_FALLBACK_FAILED,
        "[feed-state] legacy state fallback failed. Returning mock feed-state.",
        legacyError,
      );
      return MOCK_FEED_STATE;
    }
  }

  const row = Array.isArray(data) ? data[0] : data;
  return normalizeFeedState((row as FeedStateRow | null | undefined) ?? null);
}

export async function refreshFeedStateRepository(): Promise<FeedStateSnapshot> {
  if (!hasSupabaseServerConfig()) {
    throw new Error("Supabase server config is missing.");
  }

  const supabase = await createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("refresh_feed_state");

  if (error) {
    if (!isFeedStateCompatibilityError(error)) {
      throw error;
    }

    warnFeedStateCompatibilityOnce(
      FEED_STATE_COMPATIBILITY_WARNING_KEYS.REFRESH,
      "[feed-state] refresh_feed_state RPC unavailable. Falling back to legacy state read.",
      error,
    );

    try {
      return await readLegacyFeedStateFromAdminClient();
    } catch (legacyError) {
      warnFeedStateCompatibilityOnce(
        FEED_STATE_COMPATIBILITY_WARNING_KEYS.REFRESH_FALLBACK_FAILED,
        "[feed-state] legacy refresh fallback failed. Returning mock feed-state.",
        legacyError,
      );
      return MOCK_FEED_STATE;
    }
  }

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

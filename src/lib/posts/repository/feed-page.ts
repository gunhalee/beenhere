import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FeedCursor } from "@/types/domain";
import type { NearbyFeedPageRow } from "@/types/db";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export const FEED_RADIUS_STEPS_METERS = [
  10_000,
  25_000,
  50_000,
  100_000,
  250_000,
  500_000,
];

export const FEED_TARGET_ITEM_COUNT = 10;

export function clampFeedLimit(raw: number | undefined): number {
  if (!raw || !Number.isFinite(raw) || raw < 1) return DEFAULT_LIMIT;
  return Math.min(raw, MAX_LIMIT);
}

export async function listNearbyFeedPageRowsRepository(input: {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  cursor?: FeedCursor | null;
  limit: number;
}): Promise<NearbyFeedPageRow[]> {
  if (!hasSupabaseBrowserConfig()) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_nearby_feed_page", {
    viewer_lat: input.latitude,
    viewer_lng: input.longitude,
    radius_meters: input.radiusMeters,
    cursor_distance_meters: input.cursor?.distanceMeters ?? null,
    cursor_last_activity_at: input.cursor?.lastActivityAt ?? null,
    cursor_post_id: input.cursor?.postId ?? null,
    result_limit: input.limit + 1,
  });

  if (error) throw error;
  return (data as NearbyFeedPageRow[] | null) ?? [];
}

export async function resolveFeedRadiusMetersRepository(input: {
  latitude: number;
  longitude: number;
  targetCount?: number;
}): Promise<number> {
  const targetCount = input.targetCount ?? FEED_TARGET_ITEM_COUNT;
  let fallbackRadius =
    FEED_RADIUS_STEPS_METERS[FEED_RADIUS_STEPS_METERS.length - 1];

  for (const radiusMeters of FEED_RADIUS_STEPS_METERS) {
    fallbackRadius = radiusMeters;
    const rows = await listNearbyFeedPageRowsRepository({
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMeters,
      cursor: null,
      limit: targetCount,
    });

    if (rows.length >= targetCount) {
      return radiusMeters;
    }
  }

  return fallbackRadius;
}

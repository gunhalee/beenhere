import type { FeedItem } from "@/types/domain";
import type { NearbyFeedRow } from "@/types/db";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatRelativeTime } from "@/lib/utils/datetime";
import { getMockFeedItems } from "../mock-data";
import { decodeFeedCursor, encodeFeedCursor } from "./cursor";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function clampLimit(raw: number | undefined): number {
  if (!raw || !Number.isFinite(raw) || raw < 1) return DEFAULT_LIMIT;
  return Math.min(raw, MAX_LIMIT);
}

function rowToFeedItem(row: NearbyFeedRow): FeedItem {
  return {
    postId: String(row.post_id),
    content: row.content,
    authorId: String(row.author_id),
    authorNickname: row.author_nickname,
    lastSharerId: String(row.last_sharer_id),
    lastSharerNickname: row.last_sharer_nickname,
    placeLabel: row.place_label,
    distanceMeters: Number(row.distance_meters),
    relativeTime: formatRelativeTime(row.last_activity_at),
    likeCount: Number(row.like_count),
    myLike: Boolean(row.my_like),
  };
}

export async function loadNearbyFeedRepository(input: {
  latitude: number;
  longitude: number;
  cursor?: string;
  limit?: number;
}): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
  if (!hasSupabaseBrowserConfig()) {
    return { items: getMockFeedItems(), nextCursor: null };
  }

  const limit = clampLimit(input.limit);
  const cursor = decodeFeedCursor(input.cursor);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("list_nearby_feed", {
    viewer_lat: input.latitude,
    viewer_lng: input.longitude,
    radius_meters: 10000,
    cursor_distance_meters: cursor?.distanceMeters ?? null,
    cursor_last_activity_at: cursor?.lastActivityAt ?? null,
    cursor_post_id: cursor?.postId ?? null,
    result_limit: limit + 1,
  });

  if (error) throw error;

  const rows = (data as NearbyFeedRow[] | null) ?? [];
  const hasMore = rows.length > limit;
  const selectedRows = hasMore ? rows.slice(0, limit) : rows;
  const items = selectedRows.map(rowToFeedItem);

  const lastRow = selectedRows.at(-1);
  const nextCursor =
    hasMore && lastRow
      ? encodeFeedCursor({
          distanceMeters: lastRow.distance_meters,
          lastActivityAt: lastRow.last_activity_at,
          postId: String(lastRow.post_id),
        })
      : null;

  return { items, nextCursor };
}

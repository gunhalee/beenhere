import type { FeedItem } from "@/types/domain";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { formatNicknameForDisplay } from "@/lib/nickname/format";
import { getMockFeedItems } from "@/lib/posts/mock-data";
import { decodeFeedCursor, encodeFeedCursor } from "@/lib/posts/repository/cursor";
import { formatRelativeTime } from "@/lib/utils/datetime";
import {
  clampFeedLimit,
  resolveFeedRadiusMetersRepository,
  listNearbyFeedPageRowsRepository,
} from "@/lib/posts/repository/feed-page";
import { getFeedPostMetadataBatchRepository } from "@/lib/posts/repository/feed-metadata";

function mapMetadataRowToFeedItem(
  row: Awaited<ReturnType<typeof getFeedPostMetadataBatchRepository>>[number],
): FeedItem {
  return {
    postId: String(row.post_id),
    content: row.content,
    authorId: String(row.author_id),
    authorNickname: formatNicknameForDisplay(row.author_nickname),
    placeLabel: row.place_label,
    distanceMeters: Number(row.distance_meters),
    relativeTime: formatRelativeTime(row.created_at),
    likeCount: Number(row.like_count),
    myLike: Boolean(row.my_like),
  };
}

export async function loadNearbyFeedService(input: {
  latitude: number;
  longitude: number;
  cursor?: string;
  limit?: number;
}): Promise<{ items: FeedItem[]; nextCursor: string | null; radiusMeters: number }> {
  if (!hasSupabaseBrowserConfig()) {
    return { items: getMockFeedItems(), nextCursor: null, radiusMeters: 10_000 };
  }

  const limit = clampFeedLimit(input.limit);
  const cursor = decodeFeedCursor(input.cursor);
  const radiusMeters =
    cursor?.radiusMeters ??
    (await resolveFeedRadiusMetersRepository({
      latitude: input.latitude,
      longitude: input.longitude,
    }));

  const pageRows = await listNearbyFeedPageRowsRepository({
    latitude: input.latitude,
    longitude: input.longitude,
    radiusMeters,
    cursor,
    limit,
  });

  const hasMore = pageRows.length > limit;
  const selectedRows = hasMore ? pageRows.slice(0, limit) : pageRows;
  const postIds = selectedRows.map((row) => String(row.post_id));
  const metadataRows = await getFeedPostMetadataBatchRepository({
    latitude: input.latitude,
    longitude: input.longitude,
    postIds,
  });
  const metadataByPostId = new Map(
    metadataRows.map((row) => [String(row.post_id), row]),
  );

  const items = selectedRows
    .map((row) => metadataByPostId.get(String(row.post_id)))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .map(mapMetadataRowToFeedItem);

  const lastRow = selectedRows.at(-1);
  const nextCursor =
    hasMore && lastRow
      ? encodeFeedCursor({
          distanceMeters: lastRow.distance_meters,
          lastActivityAt: lastRow.last_activity_at,
          postId: String(lastRow.post_id),
          radiusMeters,
        })
      : null;

  return { items, nextCursor, radiusMeters };
}

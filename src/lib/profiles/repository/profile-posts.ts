import type { ProfilePostRow } from "@/types/db";
import type { ProfilePostItem } from "@/types/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatRelativeTime } from "@/lib/utils/datetime";
import { encodeCursor, decodeCursor } from "@/lib/utils/cursor";
import { clampLimit, toNullableDistance } from "./list-common";

type ProfilePostsCursor = { postId: string; createdAt: string };

export async function getProfilePostsRepository(input: {
  userId: string;
  cursor?: string;
  limit?: number;
  latitude?: number;
  longitude?: number;
}): Promise<{ items: ProfilePostItem[]; nextCursor: string | null }> {
  const limit = clampLimit(input.limit);
  const cursor = decodeCursor<ProfilePostsCursor>(input.cursor);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("get_profile_posts", {
    target_user_id: input.userId,
    cursor_post_id: cursor?.postId ?? null,
    cursor_created_at: cursor?.createdAt ?? null,
    result_limit: limit + 1,
    viewer_lat: input.latitude ?? null,
    viewer_lng: input.longitude ?? null,
  });

  if (error) throw error;

  const rows = (data as ProfilePostRow[] | null) ?? [];
  const hasMore = rows.length > limit;
  const selectedRows = hasMore ? rows.slice(0, limit) : rows;

  const items: ProfilePostItem[] = selectedRows.map((row) => ({
    postId: String(row.post_id),
    content: row.content,
    placeLabel: row.place_label ?? null,
    distanceMeters: toNullableDistance(row.distance_meters),
    relativeTime: formatRelativeTime(row.last_activity_at),
    likeCount: Number(row.like_count),
    myLike: Boolean(row.my_like),
  }));

  const lastRow = selectedRows.at(-1);
  const nextCursor =
    hasMore && lastRow
      ? encodeCursor<ProfilePostsCursor>({
          postId: String(lastRow.post_id),
          createdAt: lastRow.post_created_at,
        })
      : null;

  return { items, nextCursor };
}

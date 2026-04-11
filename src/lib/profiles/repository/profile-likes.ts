import type { ProfileLikeRow } from "@/types/db";
import type { ProfileLikeItem } from "@/types/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatNicknameForDisplay } from "@/lib/nickname/format";
import { formatRelativeTime } from "@/lib/utils/datetime";
import { encodeCursor, decodeCursor } from "@/lib/utils/cursor";
import { clampLimit, toNullableDistance } from "./list-common";

type ProfileLikesCursor = { likeId: string; createdAt: string };

export async function getProfileLikesRepository(input: {
  userId: string;
  cursor?: string;
  limit?: number;
  latitude?: number;
  longitude?: number;
}): Promise<{ items: ProfileLikeItem[]; nextCursor: string | null }> {
  const limit = clampLimit(input.limit);
  const cursor = decodeCursor<ProfileLikesCursor>(input.cursor);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("get_profile_likes", {
    target_user_id: input.userId,
    cursor_like_id: cursor?.likeId ?? null,
    cursor_created_at: cursor?.createdAt ?? null,
    result_limit: limit + 1,
    viewer_lat: input.latitude ?? null,
    viewer_lng: input.longitude ?? null,
  });

  if (error) throw error;

  const rows = (data as ProfileLikeRow[] | null) ?? [];
  const hasMore = rows.length > limit;
  const selectedRows = hasMore ? rows.slice(0, limit) : rows;

  const items: ProfileLikeItem[] = selectedRows.map((row) => ({
    postId: String(row.post_id),
    content: row.content,
    authorId: String(row.author_id),
    authorNickname: formatNicknameForDisplay(row.author_nickname),
    placeLabel: row.place_label ?? null,
    distanceMeters: toNullableDistance(row.distance_meters),
    relativeTime: formatRelativeTime(row.last_activity_at),
    likePlaceLabel: row.like_place_label ?? null,
    likeDistanceMeters: toNullableDistance(row.like_distance_meters),
    likeRelativeTime: formatRelativeTime(row.like_created_at),
    likeCount: Number(row.like_count),
    myLike: Boolean(row.my_like),
  }));

  const lastRow = selectedRows.at(-1);
  const nextCursor =
    hasMore && lastRow
      ? encodeCursor<ProfileLikesCursor>({
          likeId: String(lastRow.like_id),
          createdAt: lastRow.like_created_at,
        })
      : null;

  return { items, nextCursor };
}

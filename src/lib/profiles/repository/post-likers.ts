import type { PostLikerRow } from "@/types/db";
import type { PostLikerItem } from "@/types/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatNicknameForDisplay } from "@/lib/nickname/format";
import { formatRelativeTime } from "@/lib/utils/datetime";
import { encodeCursor, decodeCursor } from "@/lib/utils/cursor";
import { clampLimit } from "./list-common";

type PostLikersCursor = { likeId: string; createdAt: string };

export async function getPostLikersRepository(input: {
  postId: string;
  cursor?: string;
  limit?: number;
}): Promise<{ items: PostLikerItem[]; nextCursor: string | null }> {
  const limit = clampLimit(input.limit);
  const cursor = decodeCursor<PostLikersCursor>(input.cursor);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("get_post_likers", {
    p_post_id: input.postId,
    cursor_like_id: cursor?.likeId ?? null,
    cursor_created_at: cursor?.createdAt ?? null,
    result_limit: limit + 1,
  });

  if (error) throw error;

  const rows = (data as PostLikerRow[] | null) ?? [];
  const hasMore = rows.length > limit;
  const selectedRows = hasMore ? rows.slice(0, limit) : rows;

  const items: PostLikerItem[] = selectedRows.map((row) => ({
    userId: String(row.user_id),
    nickname: formatNicknameForDisplay(row.nickname),
    likedAt: row.liked_at,
    likedAtRelative: formatRelativeTime(row.liked_at),
    likePlaceLabel: row.like_place_label,
  }));

  const lastRow = selectedRows.at(-1);
  const nextCursor =
    hasMore && lastRow
      ? encodeCursor<PostLikersCursor>({
          likeId: String(lastRow.like_id),
          createdAt: lastRow.liked_at,
        })
      : null;

  return { items, nextCursor };
}

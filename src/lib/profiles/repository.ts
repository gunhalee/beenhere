import type { ProfilePostRow, ProfileLikeRow, PostLikerRow } from "@/types/db";
import type { MyProfile, Profile, ProfileLikeItem, ProfilePostItem, PostLikerItem } from "@/types/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatRelativeTime } from "@/lib/utils/datetime";
import { encodeCursor, decodeCursor } from "@/lib/utils/cursor";
import {
  generateNickname,
  canRegenerateNickname,
  NICKNAME_COOLDOWN_DAYS,
} from "@/lib/nickname/generate";

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 50;

function clampLimit(raw: number | undefined): number {
  if (!raw || !Number.isFinite(raw) || raw < 1) return DEFAULT_PAGE_LIMIT;
  return Math.min(raw, MAX_PAGE_LIMIT);
}

// ---------------------------
// 프로필 조회
// ---------------------------

export async function getProfileRepository(
  userId: string,
): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, nickname, created_at")
    .eq("id", userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id as string,
    nickname: data.nickname as string,
    createdAt: data.created_at as string,
  };
}

export async function getMyProfileRepository(): Promise<MyProfile | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, nickname, nickname_changed_at, created_at")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id as string,
    nickname: data.nickname as string,
    nicknameChangedAt: (data.nickname_changed_at as string | null) ?? null,
    createdAt: data.created_at as string,
  };
}

// ---------------------------
// 닉네임 재생성
// ---------------------------

type RegenerateNicknameResult =
  | { ok: true; nickname: string }
  | { ok: false; code: string; message: string; daysRemaining?: number };

export async function regenerateNicknameRepository(
  userId: string,
  nicknameChangedAt: string | null,
): Promise<RegenerateNicknameResult> {
  if (!canRegenerateNickname(nicknameChangedAt)) {
    const lastChanged = new Date(nicknameChangedAt!).getTime();
    const cooldownMs = NICKNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    const remainingMs = cooldownMs - (Date.now() - lastChanged);
    const daysRemaining = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

    return {
      ok: false,
      code: "COOLDOWN_ACTIVE",
      message: `닉네임은 ${NICKNAME_COOLDOWN_DAYS}일에 1회 변경할 수 있어요.`,
      daysRemaining,
    };
  }

  const newNickname = generateNickname();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("profiles")
    .update({ nickname: newNickname, nickname_changed_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    if (error.code === "23505") {
      // 중복 닉네임 극히 드문 경우 — 재시도
      const retry = generateNickname();
      const { error: retryError } = await supabase
        .from("profiles")
        .update({ nickname: retry, nickname_changed_at: new Date().toISOString() })
        .eq("id", userId);
      if (retryError) throw retryError;
      return { ok: true, nickname: retry };
    }
    throw error;
  }

  return { ok: true, nickname: newNickname };
}

// ---------------------------
// 프로필 글 목록
// ---------------------------

type ProfilePostsCursor = { postId: string; createdAt: string };

export async function getProfilePostsRepository(input: {
  userId: string;
  cursor?: string;
  limit?: number;
}): Promise<{ items: ProfilePostItem[]; nextCursor: string | null }> {
  const limit = clampLimit(input.limit);
  const cursor = decodeCursor<ProfilePostsCursor>(input.cursor);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("get_profile_posts", {
    target_user_id: input.userId,
    cursor_post_id: cursor?.postId ?? null,
    cursor_created_at: cursor?.createdAt ?? null,
    result_limit: limit + 1,
  });

  if (error) throw error;

  const rows = (data as ProfilePostRow[] | null) ?? [];
  const hasMore = rows.length > limit;
  const selectedRows = hasMore ? rows.slice(0, limit) : rows;

  const items: ProfilePostItem[] = selectedRows.map((row) => ({
    postId: String(row.post_id),
    content: row.content,
    placeLabel: row.place_label ?? null,
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

// ---------------------------
// 프로필 라이크 목록
// ---------------------------

type ProfileLikesCursor = { likeId: string; createdAt: string };

export async function getProfileLikesRepository(input: {
  userId: string;
  cursor?: string;
  limit?: number;
}): Promise<{ items: ProfileLikeItem[]; nextCursor: string | null }> {
  const limit = clampLimit(input.limit);
  const cursor = decodeCursor<ProfileLikesCursor>(input.cursor);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("get_profile_likes", {
    target_user_id: input.userId,
    cursor_like_id: cursor?.likeId ?? null,
    cursor_created_at: cursor?.createdAt ?? null,
    result_limit: limit + 1,
  });

  if (error) throw error;

  const rows = (data as ProfileLikeRow[] | null) ?? [];
  const hasMore = rows.length > limit;
  const selectedRows = hasMore ? rows.slice(0, limit) : rows;

  const items: ProfileLikeItem[] = selectedRows.map((row) => ({
    postId: String(row.post_id),
    content: row.content,
    authorId: String(row.author_id),
    authorNickname: row.author_nickname,
    placeLabel: row.place_label,
    relativeTime: formatRelativeTime(row.last_activity_at),
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

// ---------------------------
// 내 글 라이커 목록 (작성자 전용)
// ---------------------------

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
    nickname: row.nickname,
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

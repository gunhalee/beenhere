import { createSupabaseServerClient } from "@/lib/supabase/server";
import { API_ERROR_CODE } from "@/lib/api/common-errors";

export async function createBlockRepository(
  blockedUserId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error(API_ERROR_CODE.UNAUTHORIZED);

  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_id: user.id, blocked_id: blockedUserId });

  // 이미 차단된 경우(23505) — 멱등성 허용, 에러 무시
  if (error && error.code !== "23505") throw error;
}

export async function deleteBlockRepository(
  blockedUserId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error(API_ERROR_CODE.UNAUTHORIZED);

  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", blockedUserId);

  if (error) throw error;
}

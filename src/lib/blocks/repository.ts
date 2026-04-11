import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function createBlockRepository(
  blockerUserId: string,
  blockedUserId: string,
): Promise<{ blocked: true; alreadyBlocked: boolean }> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_id: blockerUserId, blocked_id: blockedUserId });

  if (error) {
    if (error.code === "23505") {
      return { blocked: true, alreadyBlocked: true };
    }
    throw error;
  }

  return { blocked: true, alreadyBlocked: false };
}

export async function deleteBlockRepository(
  blockerUserId: string,
  blockedUserId: string,
): Promise<{ unblocked: true; alreadyUnblocked: boolean }> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("blocks")
    .delete()
    .select("blocked_id")
    .eq("blocker_id", blockerUserId)
    .eq("blocked_id", blockedUserId);

  if (error) throw error;
  return {
    unblocked: true,
    alreadyUnblocked: !Array.isArray(data) || data.length === 0,
  };
}

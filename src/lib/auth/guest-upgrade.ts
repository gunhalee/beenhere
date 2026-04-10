import { createSupabaseAdminClient } from "@/lib/supabase/server";

type MergeGuestIntoMemberInput = {
  guestUserId: string;
  memberUserId: string;
};

type MergeGuestIntoMemberResult =
  | {
      ok: true;
      mergedPosts: number;
      mergedPostLocations: number;
      mergedLikes: number;
      mergedBlocks: number;
      mergedReports: number;
    }
  | {
      ok: false;
      error: string;
      code?: string;
    };

export async function mergeGuestIntoMember(
  input: MergeGuestIntoMemberInput,
): Promise<MergeGuestIntoMemberResult> {
  const adminClient = await createSupabaseAdminClient();
  const { data, error } = await adminClient.rpc("merge_guest_account", {
    p_guest_user_id: input.guestUserId,
    p_member_user_id: input.memberUserId,
  });

  if (error) {
    return {
      ok: false,
      error: error.message ?? "게스트 계정 전환 중 오류가 발생했어요.",
      code: error.code,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return {
      ok: true,
      mergedPosts: 0,
      mergedPostLocations: 0,
      mergedLikes: 0,
      mergedBlocks: 0,
      mergedReports: 0,
    };
  }

  const payload = row as Record<string, unknown>;
  return {
    ok: true,
    mergedPosts: Number(payload.merged_posts ?? 0),
    mergedPostLocations: Number(payload.merged_post_locations ?? 0),
    mergedLikes: Number(payload.merged_likes ?? 0),
    mergedBlocks: Number(payload.merged_blocks ?? 0),
    mergedReports: Number(payload.merged_reports ?? 0),
  };
}
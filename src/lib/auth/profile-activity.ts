import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type TouchProfileActivityInput = {
  supabase: SupabaseServerClient;
  userId: string;
  isAnonymous: boolean;
};

function isCompatibilityMissingError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === "PGRST202" || error.code === "42883" || error.code === "42P01") {
    return true;
  }
  return /touch_profile_activity/i.test(error.message ?? "");
}

export async function touchProfileActivity({
  supabase,
  userId,
  isAnonymous,
}: TouchProfileActivityInput) {
  if (typeof (supabase as { rpc?: unknown }).rpc !== "function") {
    return;
  }

  const { error } = await supabase.rpc("touch_profile_activity", {
    p_user_id: userId,
    p_is_anonymous: isAnonymous,
  });

  if (error && !isCompatibilityMissingError(error)) {
    throw error;
  }
}

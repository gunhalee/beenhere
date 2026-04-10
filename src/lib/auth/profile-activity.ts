import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type TouchProfileActivityInput = {
  supabase: SupabaseServerClient;
  userId: string;
  isAnonymous: boolean;
};

export async function touchProfileActivity({
  supabase,
  userId,
  isAnonymous,
}: TouchProfileActivityInput) {
  const { error } = await supabase.rpc("touch_profile_activity", {
    p_user_id: userId,
    p_is_anonymous: isAnonymous,
  });

  if (error) {
    throw error;
  }
}
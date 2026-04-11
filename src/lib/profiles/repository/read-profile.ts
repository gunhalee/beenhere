import type { MyProfile, Profile } from "@/types/domain";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { touchProfileActivity } from "@/lib/auth/profile-activity";
import { ensureProfileExistsForUser } from "@/lib/profiles/ensure-profile";
import { formatNicknameForDisplay } from "@/lib/nickname/format";

function touchProfileActivityInBackground(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  isAnonymous: boolean;
}) {
  void touchProfileActivity(input).catch((error) => {
    console.warn("[profiles/repository] profile activity touch skipped:", error);
  });
}

function isProfileMissingError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  if (!("code" in error)) return false;
  return (error as { code?: string }).code === "PGRST116";
}

export async function getProfileRepository(userId: string): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, nickname, created_at")
    .eq("id", userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id as string,
    nickname: formatNicknameForDisplay(data.nickname as string),
    createdAt: data.created_at as string,
  };
}

export async function getMyProfileRepository(): Promise<MyProfile | null> {
  const supabase = await createSupabaseServerClient();
  const user = await getServerUser(supabase);

  if (!user) return null;

  const isAnonymous = Boolean(user.is_anonymous);
  const readMyProfile = () =>
    supabase
      .from("profiles")
      .select("id, nickname, nickname_changed_at, created_at")
      .eq("id", user.id)
      .single();

  let { data, error } = await readMyProfile();

  if (!data) {
    if (error && !isProfileMissingError(error)) {
      throw error;
    }

    try {
      await ensureProfileExistsForUser(supabase, user.id, isAnonymous);
    } catch (ensureError) {
      console.warn(
        "[profiles/repository] failed to ensure missing profile row:",
        ensureError,
      );
      return null;
    }

    const retry = await readMyProfile();
    data = retry.data;
    error = retry.error;
    if (error || !data) {
      throw error ?? new Error("Failed to read ensured profile row.");
    }
  }

  touchProfileActivityInBackground({
    supabase,
    userId: user.id,
    isAnonymous,
  });

  return {
    id: data.id as string,
    nickname: formatNicknameForDisplay(data.nickname as string),
    nicknameChangedAt: (data.nickname_changed_at as string | null) ?? null,
    createdAt: data.created_at as string,
    profileCreated: true,
    isAnonymous,
  };
}

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatNicknameForDisplay } from "@/lib/nickname/format";
import { generateNickname } from "@/lib/nickname/generate";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type EnsureProfileResult = {
  created: boolean;
  nickname: string;
};

const MAX_NICKNAME_ATTEMPTS = 8;

async function readExistingNickname(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", userId)
    .single();

  if (!data || typeof data.nickname !== "string") return null;
  return data.nickname;
}

export async function ensureProfileExistsForUser(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<EnsureProfileResult> {
  const existingNickname = await readExistingNickname(supabase, userId);
  if (existingNickname) {
    return {
      created: false,
      nickname: formatNicknameForDisplay(existingNickname),
    };
  }

  for (let attempt = 0; attempt < MAX_NICKNAME_ATTEMPTS; attempt += 1) {
    const nickname = generateNickname();
    const { error } = await supabase
      .from("profiles")
      .insert({ id: userId, nickname });

    if (!error) {
      return {
        created: true,
        nickname: formatNicknameForDisplay(nickname),
      };
    }

    if (error.code !== "23505") {
      throw error;
    }

    // Another request might have created this user's profile first.
    const concurrentNickname = await readExistingNickname(supabase, userId);
    if (concurrentNickname) {
      return {
        created: false,
        nickname: formatNicknameForDisplay(concurrentNickname),
      };
    }
  }

  throw new Error("Failed to create profile after repeated nickname attempts.");
}

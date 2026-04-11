import { API_ERROR_CODE } from "@/lib/api/common-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatNicknameForDisplay } from "@/lib/nickname/format";
import {
  generateNickname,
  canRegenerateNickname,
  daysUntilNicknameRegen,
  NICKNAME_COOLDOWN_DAYS,
} from "@/lib/nickname/generate";

type RegenerateNicknameResult =
  | { ok: true; nickname: string; nicknameChangedAt: string }
  | { ok: false; code: string; message: string; daysRemaining?: number };

export async function regenerateNicknameRepository(
  userId: string,
  nicknameChangedAt: string | null,
): Promise<RegenerateNicknameResult> {
  if (!canRegenerateNickname(nicknameChangedAt)) {
    const daysRemaining = daysUntilNicknameRegen(nicknameChangedAt);

    return {
      ok: false,
      code: API_ERROR_CODE.COOLDOWN_ACTIVE,
      message: `닉네임은 ${NICKNAME_COOLDOWN_DAYS}일에 1회 변경할 수 있어요.`,
      daysRemaining,
    };
  }

  const newNickname = generateNickname();
  const changedAt = new Date().toISOString();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("profiles")
    .update({ nickname: newNickname, nickname_changed_at: changedAt })
    .eq("id", userId);

  if (error) {
    if (error.code === "23505") {
      const retry = generateNickname();
      const retryChangedAt = new Date().toISOString();
      const { error: retryError } = await supabase
        .from("profiles")
        .update({ nickname: retry, nickname_changed_at: retryChangedAt })
        .eq("id", userId);
      if (retryError) throw retryError;
      return {
        ok: true,
        nickname: formatNicknameForDisplay(retry),
        nicknameChangedAt: retryChangedAt,
      };
    }
    throw error;
  }

  return {
    ok: true,
    nickname: formatNicknameForDisplay(newNickname),
    nicknameChangedAt: changedAt,
  };
}

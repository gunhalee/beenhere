import { API_ERROR_CODE, API_ERROR_MESSAGE } from "@/lib/api/common-errors";
import { formatNicknameForDisplay } from "@/lib/nickname/format";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";

type ProfileInsertErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  constraint?: string;
};

function getErrorText(error: ProfileInsertErrorLike) {
  return `${error.constraint ?? ""} ${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
}

function isUniqueConstraintError(error: ProfileInsertErrorLike) {
  return error.code === "23505";
}

function isProfileIdConflict(error: ProfileInsertErrorLike) {
  return getErrorText(error).includes("profiles_pkey");
}

function isNicknameConflict(error: ProfileInsertErrorLike) {
  return getErrorText(error).includes("profiles_nickname_key");
}

export async function createViewerProfile(input: { nickname: string }) {
  const supabase = await createSupabaseServerClient();
  const user = await getServerUser(supabase);

  if (!user) {
    return {
      ok: false as const,
      status: 401,
      code: API_ERROR_CODE.UNAUTHORIZED,
      message: API_ERROR_MESSAGE.AUTH_REQUIRED,
    };
  }

  const { error: insertError } = await supabase
    .from("profiles")
    .insert({ id: user.id, nickname: input.nickname });

  if (insertError) {
    if (isUniqueConstraintError(insertError)) {
      if (isProfileIdConflict(insertError)) {
        return {
          ok: false as const,
          status: 409,
          code: API_ERROR_CODE.PROFILE_ALREADY_EXISTS,
          message: API_ERROR_MESSAGE.PROFILE_ALREADY_EXISTS,
        };
      }

      if (isNicknameConflict(insertError)) {
        return {
          ok: false as const,
          status: 409,
          code: API_ERROR_CODE.NICKNAME_TAKEN,
          message: API_ERROR_MESSAGE.NICKNAME_TAKEN,
        };
      }

      const { data: existingProfile, error: existingProfileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!existingProfileError && existingProfile) {
        return {
          ok: false as const,
          status: 409,
          code: API_ERROR_CODE.PROFILE_ALREADY_EXISTS,
          message: API_ERROR_MESSAGE.PROFILE_ALREADY_EXISTS,
        };
      }

      return {
        ok: false as const,
        status: 409,
        code: API_ERROR_CODE.NICKNAME_TAKEN,
        message: API_ERROR_MESSAGE.NICKNAME_TAKEN,
      };
    }

    return {
      ok: false as const,
      status: 500,
      code: API_ERROR_CODE.INTERNAL_ERROR,
      message: API_ERROR_MESSAGE.PROFILE_CREATE_FAILED,
    };
  }

  return {
    ok: true as const,
    nickname: formatNicknameForDisplay(input.nickname),
  };
}

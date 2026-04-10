import { fail, ok } from "@/lib/api/response";
import { API_ERROR_CODE, API_ERROR_MESSAGE } from "@/lib/api/common-errors";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatNicknameForDisplay } from "@/lib/nickname/format";
import { generateNickname } from "@/lib/nickname/generate";
import {
  getMyProfileRepository,
  regenerateNicknameRepository,
} from "@/lib/profiles/repository";

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
  const text = getErrorText(error);
  return text.includes("profiles_pkey");
}

function isNicknameConflict(error: ProfileInsertErrorLike) {
  const text = getErrorText(error);
  return text.includes("profiles_nickname_key");
}

export async function GET() {
  if (!hasSupabaseBrowserConfig()) {
    return ok({
      id: "mock-user-id",
      nickname: formatNicknameForDisplay(generateNickname()),
      nicknameChangedAt: null,
      profileCreated: true,
      isAnonymous: false,
      googleLinked: false,
      canLinkGoogle: false,
    });
  }

  const profile = await getMyProfileRepository();
  if (!profile) {
    return fail(API_ERROR_MESSAGE.AUTH_REQUIRED, 401, API_ERROR_CODE.UNAUTHORIZED);
  }

  return ok({
    id: profile.id,
    nickname: profile.nickname,
    nicknameChangedAt: profile.nicknameChangedAt,
    profileCreated: profile.profileCreated,
    isAnonymous: profile.isAnonymous,
    googleLinked: profile.googleLinked,
    canLinkGoogle: profile.canLinkGoogle,
  });
}

export async function PATCH() {
  if (!hasSupabaseBrowserConfig()) {
    return ok({
      nickname: formatNicknameForDisplay(generateNickname()),
      nicknameChangedAt: new Date().toISOString(),
    });
  }

  const profile = await getMyProfileRepository();
  if (!profile) {
    return fail(API_ERROR_MESSAGE.AUTH_REQUIRED, 401, API_ERROR_CODE.UNAUTHORIZED);
  }

  const result = await regenerateNicknameRepository(
    profile.id,
    profile.nicknameChangedAt,
  );

  if (!result.ok) {
    const details =
      "daysRemaining" in result && typeof result.daysRemaining === "number"
        ? { daysRemaining: result.daysRemaining }
        : undefined;
    return fail(result.message, 429, result.code, details);
  }

  return ok({
    nickname: result.nickname,
    nicknameChangedAt: result.nicknameChangedAt,
  });
}

export async function POST(request: Request) {
  if (!hasSupabaseBrowserConfig()) {
    return ok({ nickname: formatNicknameForDisplay(generateNickname()) });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(API_ERROR_MESSAGE.INVALID_REQUEST, 400, API_ERROR_CODE.INVALID_REQUEST);
  }

  const nickname =
    body !== null &&
    typeof body === "object" &&
    "nickname" in body &&
    typeof (body as Record<string, unknown>).nickname === "string"
      ? (body as { nickname: string }).nickname.trim()
      : null;

  if (!nickname || nickname.length < 2 || nickname.length > 30) {
    return fail(
      API_ERROR_MESSAGE.INVALID_NICKNAME_LENGTH,
      400,
      API_ERROR_CODE.VALIDATION_ERROR,
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return fail(API_ERROR_MESSAGE.AUTH_REQUIRED, 401, API_ERROR_CODE.UNAUTHORIZED);
  }

  const { error: insertError } = await supabase
    .from("profiles")
    .insert({ id: user.id, nickname });

  if (insertError) {
    if (isUniqueConstraintError(insertError)) {
      if (isProfileIdConflict(insertError)) {
        return fail(
          API_ERROR_MESSAGE.PROFILE_ALREADY_EXISTS,
          409,
          API_ERROR_CODE.PROFILE_ALREADY_EXISTS,
        );
      }

      if (isNicknameConflict(insertError)) {
        return fail(API_ERROR_MESSAGE.NICKNAME_TAKEN, 409, API_ERROR_CODE.NICKNAME_TAKEN);
      }

      const { data: existingProfile, error: existingProfileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!existingProfileError && existingProfile) {
        return fail(
          API_ERROR_MESSAGE.PROFILE_ALREADY_EXISTS,
          409,
          API_ERROR_CODE.PROFILE_ALREADY_EXISTS,
        );
      }

      return fail(API_ERROR_MESSAGE.NICKNAME_TAKEN, 409, API_ERROR_CODE.NICKNAME_TAKEN);
    }
    return fail(
      API_ERROR_MESSAGE.PROFILE_CREATE_FAILED,
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }

  return ok({ nickname: formatNicknameForDisplay(nickname) });
}


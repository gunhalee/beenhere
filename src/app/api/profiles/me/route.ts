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
    profileCreated: profile.profileCreated ?? true,
    isAnonymous: profile.isAnonymous ?? false,
    googleLinked: profile.googleLinked ?? false,
    canLinkGoogle: profile.canLinkGoogle ?? false,
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

  if (profile.profileCreated === false) {
    return fail(
      "프로필은 첫 쓰기 동작 시 자동으로 생성돼요.",
      400,
      API_ERROR_CODE.VALIDATION_ERROR,
    );
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

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (existing) {
    return fail(
      API_ERROR_MESSAGE.PROFILE_ALREADY_EXISTS,
      409,
      API_ERROR_CODE.PROFILE_ALREADY_EXISTS,
    );
  }

  const { error: insertError } = await supabase
    .from("profiles")
    .insert({ id: user.id, nickname });

  if (insertError) {
    if (insertError.code === "23505") {
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


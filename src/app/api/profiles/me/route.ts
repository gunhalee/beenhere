import { fail, ok } from "@/lib/api/response";
import { API_ERROR_CODE, API_ERROR_MESSAGE } from "@/lib/api/common-errors";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { formatNicknameForDisplay } from "@/lib/nickname/format";
import { generateNickname } from "@/lib/nickname/generate";
import {
  createViewerProfile,
  getViewerProfile,
  regenerateViewerNickname,
} from "@/lib/profiles/service";

export async function GET() {
  if (!hasSupabaseBrowserConfig()) {
    return ok({
      id: "mock-user-id",
      nickname: formatNicknameForDisplay(generateNickname()),
      nicknameChangedAt: null,
      profileCreated: true,
      isAnonymous: false,
    });
  }

  try {
    const profile = await getViewerProfile();
    if (!profile) {
      return fail(API_ERROR_MESSAGE.AUTH_REQUIRED, 401, API_ERROR_CODE.UNAUTHORIZED);
    }

    return ok({
      id: profile.id,
      nickname: profile.nickname,
      nicknameChangedAt: profile.nicknameChangedAt,
      profileCreated: profile.profileCreated,
      isAnonymous: profile.isAnonymous,
    });
  } catch (error) {
    console.error("[api/profiles/me][GET] failed:", error);
    return fail(
      "프로필 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
}

export async function PATCH() {
  if (!hasSupabaseBrowserConfig()) {
    return ok({
      nickname: formatNicknameForDisplay(generateNickname()),
      nicknameChangedAt: new Date().toISOString(),
    });
  }

  try {
    const profile = await getViewerProfile();
    if (!profile) {
      return fail(API_ERROR_MESSAGE.AUTH_REQUIRED, 401, API_ERROR_CODE.UNAUTHORIZED);
    }

    const result = await regenerateViewerNickname({
      userId: profile.id,
      nicknameChangedAt: profile.nicknameChangedAt,
    });

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
  } catch (error) {
    console.error("[api/profiles/me][PATCH] failed:", error);
    return fail(
      "프로필 이름 변경 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
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

  const result = await createViewerProfile({ nickname });
  if (!result.ok) {
    return fail(result.message, result.status, result.code);
  }

  return ok({ nickname: result.nickname });
}


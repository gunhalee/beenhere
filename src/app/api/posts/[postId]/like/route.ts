import { readJsonBody } from "@/lib/api/request";
import { fail, ok } from "@/lib/api/response";
import { API_ERROR_CODE, API_ERROR_MESSAGE } from "@/lib/api/common-errors";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { likePost } from "@/lib/posts/mutations";
import { ensureProfileExistsForUser } from "@/lib/profiles/ensure-profile";
import { consumeAnonymousWriteQuota } from "@/lib/auth/anonymous-write-quota";
import { touchProfileActivity } from "@/lib/auth/profile-activity";
import type { LikePostBody } from "@/types/api";

type Context = { params: Promise<{ postId: string }> };

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export async function POST(request: Request, context: Context) {
  const { postId } = await context.params;

  const bodyResult = await readJsonBody<LikePostBody>(request);
  if (!bodyResult.ok) return bodyResult.response;

  const { latitude, longitude, placeLabel } = bodyResult.body;

  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
    return fail("유효한 위치 좌표가 필요해요.", 400, API_ERROR_CODE.INVALID_LOCATION);
  }

  if (!placeLabel?.trim()) {
    return fail("장소 정보가 필요해요.", 400, API_ERROR_CODE.VALIDATION_ERROR);
  }

  if (hasSupabaseBrowserConfig()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return fail(
        API_ERROR_MESSAGE.AUTH_REQUIRED,
        401,
        API_ERROR_CODE.UNAUTHORIZED,
      );
    }

    const isAnonymous = Boolean(user.is_anonymous);

    await ensureProfileExistsForUser(supabase, user.id, isAnonymous);
    await touchProfileActivity({
      supabase,
      userId: user.id,
      isAnonymous,
    });

    const quota = await consumeAnonymousWriteQuota({
      supabase,
      userId: user.id,
      isAnonymous,
    });

    if (!quota.allowed) {
      return fail(
        "게스트 계정의 쓰기 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
        429,
        API_ERROR_CODE.RATE_LIMITED,
        {
          resetAt: quota.resetAt,
          remaining: quota.remaining,
        },
      );
    }
  }

  try {
    const result = await likePost({ postId, latitude, longitude, placeLabel });

    if (!result.ok) {
      const status = (result as { status?: number }).status ?? 400;
      return fail(result.message, status, result.code);
    }

    return ok({ likeCount: result.likeCount });
  } catch (error) {
    console.error("[api/posts/:postId/like] 라이크 실패:", error);
    return fail(
      "라이크 처리 중 오류가 발생했어요.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
}


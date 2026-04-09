import { readJsonBody } from "@/lib/api/request";
import { fail, ok } from "@/lib/api/response";
import { API_ERROR_CODE, API_ERROR_MESSAGE } from "@/lib/api/common-errors";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createBlockRepository } from "@/lib/blocks/repository";
import type { CreateBlockBody } from "@/types/api";

export async function POST(request: Request) {
  const bodyResult = await readJsonBody<CreateBlockBody>(request);
  if (!bodyResult.ok) return bodyResult.response;

  const { blockedUserId } = bodyResult.body;

  if (!blockedUserId?.trim()) {
    return fail(
      "차단할 사용자 ID가 필요해요.",
      400,
      API_ERROR_CODE.VALIDATION_ERROR,
    );
  }

  if (!hasSupabaseBrowserConfig()) {
    return ok({ blocked: true as const });
  }

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

  if (user.id === blockedUserId) {
    return fail(
      "자기 자신은 차단할 수 없어요.",
      400,
      API_ERROR_CODE.VALIDATION_ERROR,
    );
  }

  try {
    await createBlockRepository(blockedUserId);
    return ok({ blocked: true as const });
  } catch (error) {
    console.error("[api/blocks] 차단 실패:", error);
    return fail(
      "차단 처리 중 오류가 발생했어요.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
}

import { readJsonBody } from "@/lib/api/request";
import { fail, ok } from "@/lib/api/response";
import { API_ERROR_CODE, API_ERROR_MESSAGE } from "@/lib/api/common-errors";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPost } from "@/lib/posts/mutations";
import type { CreatePostBody } from "@/types/api";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const CLIENT_REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;

export async function POST(request: Request) {
  const bodyResult = await readJsonBody<CreatePostBody>(request);

  if (!bodyResult.ok) return bodyResult.response;

  const { content, latitude, longitude, placeLabel } = bodyResult.body;
  const clientRequestId = bodyResult.body.clientRequestId?.trim() || undefined;

  if (!content?.trim()) {
    return fail("내용을 입력해 주세요.", 400, API_ERROR_CODE.VALIDATION_ERROR);
  }

  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
    return fail("유효한 위치 좌표가 필요해요.", 400, API_ERROR_CODE.INVALID_LOCATION);
  }

  if (!placeLabel?.trim()) {
    return fail("장소 정보가 필요해요.", 400, API_ERROR_CODE.VALIDATION_ERROR);
  }

  if (clientRequestId && !CLIENT_REQUEST_ID_PATTERN.test(clientRequestId)) {
    return fail(
      "clientRequestId is invalid.",
      400,
      API_ERROR_CODE.VALIDATION_ERROR,
    );
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
  }

  try {
    const result = await createPost({
      content,
      latitude,
      longitude,
      placeLabel,
      clientRequestId,
    });

    if (!result.ok) {
      return fail(result.message, 400, result.code);
    }

    return ok({ postId: result.postId }, 201);
  } catch (error) {
    console.error("[api/posts] 글 작성 실패:", error);
    return fail(
      "글을 작성하는 중 오류가 발생했어요.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
}

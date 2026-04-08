import { readJsonBody } from "@/lib/api/request";
import { fail, ok } from "@/lib/api/response";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPost } from "@/lib/posts/mutations";
import type { CreatePostBody } from "@/types/api";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export async function POST(request: Request) {
  const bodyResult = await readJsonBody<CreatePostBody>(request);

  if (!bodyResult.ok) return bodyResult.response;

  const { content, latitude, longitude, placeLabel } = bodyResult.body;

  if (!content?.trim()) {
    return fail("내용을 입력해 주세요.", 400, "VALIDATION_ERROR");
  }

  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
    return fail("유효한 위치 좌표가 필요해요.", 400, "INVALID_LOCATION");
  }

  if (!placeLabel?.trim()) {
    return fail("장소 정보가 필요해요.", 400, "VALIDATION_ERROR");
  }

  if (hasSupabaseBrowserConfig()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return fail("로그인이 필요해요.", 401, "UNAUTHORIZED");
    }
  }

  try {
    const result = await createPost({ content, latitude, longitude, placeLabel });

    if (!result.ok) {
      return fail(result.message, 400, result.code);
    }

    return ok({ postId: result.postId }, 201);
  } catch (error) {
    console.error("[api/posts] 글 작성 실패:", error);
    return fail("글을 작성하는 중 오류가 발생했어요.", 500, "INTERNAL_ERROR");
  }
}

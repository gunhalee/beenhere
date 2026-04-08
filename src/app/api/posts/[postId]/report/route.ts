import { readJsonBody } from "@/lib/api/request";
import { fail, ok } from "@/lib/api/response";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reportPost } from "@/lib/posts/mutations";
import type { ReportPostBody } from "@/types/api";

type Context = { params: Promise<{ postId: string }> };

export async function POST(request: Request, context: Context) {
  const { postId } = await context.params;

  const bodyResult = await readJsonBody<ReportPostBody>(request);
  if (!bodyResult.ok) return bodyResult.response;

  const { reasonCode } = bodyResult.body;

  if (!reasonCode?.trim()) {
    return fail("신고 사유를 선택해 주세요.", 400, "VALIDATION_ERROR");
  }

  if (hasSupabaseBrowserConfig()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return fail("로그인이 필요해요.", 401, "UNAUTHORIZED");
  }

  try {
    const result = await reportPost({ postId, reasonCode });

    if (!result.ok) {
      return fail(result.message, 400, result.code);
    }

    return ok({ postId });
  } catch (error) {
    console.error("[api/posts/:postId/report] 신고 실패:", error);
    return fail("신고 처리 중 오류가 발생했어요.", 500, "INTERNAL_ERROR");
  }
}

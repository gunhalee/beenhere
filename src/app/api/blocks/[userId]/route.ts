import { fail, ok } from "@/lib/api/response";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteBlockRepository } from "@/lib/blocks/repository";

type Context = { params: Promise<{ userId: string }> };

export async function DELETE(_request: Request, context: Context) {
  const { userId: blockedUserId } = await context.params;

  if (!hasSupabaseBrowserConfig()) {
    return ok({ unblocked: true as const });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("로그인이 필요해요.", 401, "UNAUTHORIZED");

  try {
    await deleteBlockRepository(blockedUserId);
    return ok({ unblocked: true as const });
  } catch (error) {
    console.error("[api/blocks/:userId] 차단 해제 실패:", error);
    return fail("차단 해제 중 오류가 발생했어요.", 500, "INTERNAL_ERROR");
  }
}

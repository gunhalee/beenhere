import { fail, ok } from "@/lib/api/response";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deletePost } from "@/lib/posts/mutations";

type Context = { params: Promise<{ postId: string }> };

export async function DELETE(_request: Request, context: Context) {
  const { postId } = await context.params;

  if (hasSupabaseBrowserConfig()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return fail("로그인이 필요해요.", 401, "UNAUTHORIZED");
  }

  try {
    const result = await deletePost(postId);

    if (!result.ok) {
      const status = (result as { status?: number }).status ?? 400;
      return fail(result.message, status, result.code);
    }

    return ok({ postId });
  } catch (error) {
    console.error("[api/posts/:postId] 삭제 실패:", error);
    return fail("글 삭제 중 오류가 발생했어요.", 500, "INTERNAL_ERROR");
  }
}

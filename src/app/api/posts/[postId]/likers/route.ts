import { fail, ok } from "@/lib/api/response";
import { API_ERROR_CODE, API_ERROR_MESSAGE } from "@/lib/api/common-errors";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { getPostLikersList } from "@/lib/profiles/service";

type Context = { params: Promise<{ postId: string }> };

export async function GET(request: Request, context: Context) {
  const { postId } = await context.params;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  if (hasSupabaseBrowserConfig()) {
    const supabase = await createSupabaseServerClient();
    const user = await getServerUser(supabase);

    if (!user) {
      return fail(
        API_ERROR_MESSAGE.AUTH_REQUIRED,
        401,
        API_ERROR_CODE.UNAUTHORIZED,
      );
    }
  }

  try {
    const result = await getPostLikersList({ postId, cursor, limit });
    return ok({ items: result.items, nextCursor: result.nextCursor });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "P0001") {
      return fail(
        "내 글을 수집한 사람만 조회할 수 있어요.",
        403,
        API_ERROR_CODE.FORBIDDEN,
      );
    }
    console.error("[api/posts/:postId/likers] 조회 실패:", error);
    return fail(
      "수집한 사람 목록을 불러오는 중 오류가 발생했어요.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
}

import { fail, ok } from "@/lib/api/response";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { getProfilePostsRepository } from "@/lib/profiles/repository";

type Context = { params: Promise<{ userId: string }> };

export async function GET(request: Request, context: Context) {
  const { userId } = await context.params;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  if (!hasSupabaseBrowserConfig()) {
    return ok({ items: [], nextCursor: null });
  }

  try {
    const result = await getProfilePostsRepository({ userId, cursor, limit });
    return ok({ items: result.items, nextCursor: result.nextCursor });
  } catch (error) {
    console.error("[api/profiles/:userId/posts] 조회 실패:", error);
    return fail("작성 글 목록을 불러오는 중 오류가 발생했어요.", 500, "INTERNAL_ERROR");
  }
}

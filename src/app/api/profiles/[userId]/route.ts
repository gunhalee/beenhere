import { fail, ok } from "@/lib/api/response";
import { API_ERROR_CODE } from "@/lib/api/common-errors";
import { formatNicknameForDisplay } from "@/lib/nickname/format";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProfileRepository } from "@/lib/profiles/repository";

type Context = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, context: Context) {
  const { userId } = await context.params;

  if (!hasSupabaseBrowserConfig()) {
    return ok({ id: userId, nickname: formatNicknameForDisplay("mock_otter") });
  }

  try {
    const profile = await getProfileRepository(userId);

    if (profile) {
      return ok({ id: profile.id, nickname: profile.nickname });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id === userId) {
      return ok({
        id: userId,
        nickname: formatNicknameForDisplay("guest"),
      });
    }

    return fail("존재하지 않는 사용자예요.", 404, API_ERROR_CODE.NOT_FOUND);
  } catch (error) {
    console.error("[api/profiles/:userId] 조회 실패:", error);
    return fail(
      "프로필을 불러오는 중 오류가 발생했어요.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
}


import { API_ERROR_CODE } from "@/lib/api/common-errors";
import { createReadRouteHandler, failWithStatus } from "@/lib/api/route-helpers";
import { formatNicknameForDisplay } from "@/lib/nickname/format";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { getPublicProfile } from "@/lib/profiles/service";

type Context = { params: Promise<{ userId: string }> };

export const GET = createReadRouteHandler<
  { userId: string },
  { id: string; nickname: string },
  Context
>({
  parse: async (_request, context) => {
    const { userId } = await context.params;
    return { ok: true, parsed: { userId } };
  },
  action: async ({ parsed }) => {
    if (!hasSupabaseBrowserConfig()) {
      return {
        ok: true,
        data: { id: parsed.userId, nickname: formatNicknameForDisplay("샘플_수달") },
      };
    }
    const profile = await getPublicProfile({ userId: parsed.userId });
    if (!profile) {
      return {
        ok: false,
        status: 404,
        code: API_ERROR_CODE.NOT_FOUND,
        message: "존재하지 않는 사용자예요.",
      };
    }
    return { ok: true, data: { id: profile.id, nickname: profile.nickname } };
  },
  onError: {
    logLabel: "[api/profiles/:userId] 조회 실패:",
    message: "프로필을 불러오는 중 오류가 발생했어요.",
  },
});

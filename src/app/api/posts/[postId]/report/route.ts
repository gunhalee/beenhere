import {
  createBodyRouteHandler,
  failValidation,
} from "@/lib/api/route-helpers";
import { reportPost } from "@/lib/posts/mutations";
import type { ReportPostBody } from "@/types/api";

type Context = { params: Promise<{ postId: string }> };

export const POST = createBodyRouteHandler<ReportPostBody, { postId: string; alreadyReported: boolean }, Context>({
  validate: ({ body }) =>
    !body.reasonCode?.trim()
      ? failValidation("신고 사유를 선택해 주세요.")
      : null,
  getPreflightOptions: () => ({
      ensureProfile: true,
      touchActivity: true,
      requireQuota: true,
    }),
  action: async ({ context, body }) => {
    const { postId } = await context.params;
    const result = await reportPost({ postId, reasonCode: body.reasonCode });
    if (!result.ok) {
      return { ok: false, message: result.message, code: result.code };
    }
    return {
      ok: true,
      data: { postId, alreadyReported: result.alreadyReported },
    };
  },
  onError: {
    logLabel: "[api/posts/:postId/report] 신고 실패:",
    message: "신고 처리 중 오류가 발생했어요.",
  },
});

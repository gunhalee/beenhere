import {
  createBodyRouteHandler,
  failValidation,
} from "@/lib/api/route-helpers";
import { createBlockRepository } from "@/lib/blocks/repository";
import type { CreateBlockBody } from "@/types/api";

export const POST = createBodyRouteHandler<
  CreateBlockBody,
  { blocked: true; alreadyBlocked: boolean },
  { params: Promise<Record<string, string>> }
>({
  validate: ({ body }) =>
    !body.blockedUserId?.trim()
      ? failValidation("차단할 사용자 ID가 필요해요.")
      : null,
  getPreflightOptions: () => ({
      ensureProfile: true,
      touchActivity: true,
      requireQuota: true,
    }),
  action: async ({ body, preflight }) => {
    const user = preflight?.user;
    if (!user) {
      return {
        ok: false,
        status: 401,
        code: "UNAUTHORIZED",
        message: "인증이 필요해요.",
      };
    }
    if (user.id === body.blockedUserId) {
      return {
        ok: false,
        status: 400,
        code: "VALIDATION_ERROR",
        message: "자기 자신은 차단할 수 없어요.",
      };
    }
    return {
      ok: true,
      data: await createBlockRepository(user.id, body.blockedUserId),
    };
  },
  onError: {
    logLabel: "[api/blocks] 차단 실패:",
    message: "차단 처리 중 오류가 발생했어요.",
  },
});

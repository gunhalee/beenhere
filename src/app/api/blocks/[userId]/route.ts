import { createActionRouteHandler } from "@/lib/api/route-helpers";
import { deleteBlockRepository } from "@/lib/blocks/repository";

type Context = { params: Promise<{ userId: string }> };

export const DELETE = createActionRouteHandler<
  { unblocked: true; alreadyUnblocked: boolean },
  Context
>({
  getPreflightOptions: () => ({
      ensureProfile: true,
      touchActivity: true,
      requireQuota: true,
    }),
  action: async ({ context, preflight }) => {
    const { userId: blockedUserId } = await context.params;
    return {
      ok: true,
      data: await deleteBlockRepository(preflight!.user.id, blockedUserId),
    };
  },
  onError: {
    logLabel: "[api/blocks/:userId] 차단 해제 실패:",
    message: "차단 해제 중 오류가 발생했어요.",
  },
});

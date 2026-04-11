import { API_ERROR_CODE } from "@/lib/api/common-errors";
import {
  createActionRouteHandler,
  createBodyRouteHandler,
  failValidation,
} from "@/lib/api/route-helpers";
import { likePost, unlikePost } from "@/lib/posts/mutations";
import type { LikePostBody } from "@/types/api";

type Context = { params: Promise<{ postId: string }> };

export const POST = createBodyRouteHandler<
  LikePostBody,
  { likeCount: number },
  Context
>({
  validate: ({ body }) => {
    if (!Number.isFinite(body.latitude) || !Number.isFinite(body.longitude)) {
      return failValidation("유효한 위치 좌표가 필요해요.", API_ERROR_CODE.INVALID_LOCATION);
    }
    if (!body.placeLabel?.trim()) {
      return failValidation("장소 정보가 필요해요.");
    }
    return null;
  },
  getPreflightOptions: () => ({
      ensureProfile: true,
      touchActivity: true,
      requireQuota: true,
    }),
  action: async ({ context, body }) => {
    const { postId } = await context.params;
    const result = await likePost({
      postId,
      latitude: body.latitude,
      longitude: body.longitude,
      placeLabel: body.placeLabel,
    });
    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        status: (result as { status?: number }).status,
        code: result.code,
      };
    }
    return { ok: true, data: { likeCount: result.likeCount } };
  },
  onError: {
    logLabel: "[api/posts/:postId/like] collect failed:",
    message: "수집 처리 중 오류가 발생했어요.",
  },
});

export const DELETE = createActionRouteHandler<{ likeCount: number }, Context>({
  getPreflightOptions: () => ({}),
  action: async ({ context }) => {
    const { postId } = await context.params;
    const result = await unlikePost(postId);
    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        status: (result as { status?: number }).status,
        code: result.code,
      };
    }
    return { ok: true, data: { likeCount: result.likeCount } };
  },
  onError: {
    logLabel: "[api/posts/:postId/like:DELETE] unlike failed:",
    message: "수집 취소 처리 중 오류가 발생했어요.",
  },
});

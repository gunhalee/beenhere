import { API_ERROR_CODE } from "@/lib/api/common-errors";
import {
  createBodyRouteHandler,
  failFromPreflight,
  failValidation,
  failWithStatus,
} from "@/lib/api/route-helpers";
import { createPost } from "@/lib/posts/mutations";
import type { CreatePostBody } from "@/types/api";

const CLIENT_REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;

export const POST = createBodyRouteHandler<
  CreatePostBody,
  { postId: string },
  { params: Promise<Record<string, string>> }
>({
  validate: ({ body }) => {
    const clientRequestId = body.clientRequestId?.trim() || undefined;
    if (!body.content?.trim()) {
      return failValidation("내용을 입력해 주세요.");
    }
    if (!Number.isFinite(body.latitude) || !Number.isFinite(body.longitude)) {
      return failValidation("유효한 위치 좌표가 필요해요.", API_ERROR_CODE.INVALID_LOCATION);
    }
    if (!body.placeLabel?.trim()) {
      return failValidation("장소 정보가 필요해요.");
    }
    if (clientRequestId && !CLIENT_REQUEST_ID_PATTERN.test(clientRequestId)) {
      return failValidation("clientRequestId 값이 올바르지 않아요.");
    }
    return null;
  },
  getPreflightOptions: () => ({
      ensureProfile: true,
      touchActivity: true,
      requireQuota: true,
      includeConsentDetails: true,
    }),
  action: async ({ body }) => {
    const clientRequestId = body.clientRequestId?.trim() || undefined;
    const result = await createPost({
      content: body.content,
      latitude: body.latitude,
      longitude: body.longitude,
      placeLabel: body.placeLabel,
      clientRequestId,
    });
    if (!result.ok) {
      return { ok: false, message: result.message, code: result.code };
    }
    return { ok: true, data: { postId: result.postId }, status: 201 };
  },
  onError: {
    logLabel: "[api/posts] 글 작성 실패:",
    message: "글을 작성하는 중 오류가 발생했어요.",
  },
});

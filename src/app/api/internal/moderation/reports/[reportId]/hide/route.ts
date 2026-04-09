import { runWithTimeout, isApiRouteTimeoutError } from "@/lib/api/request";
import { fail, ok } from "@/lib/api/response";
import {
  API_ERROR_CODE,
  API_ERROR_MESSAGE,
  API_TIMEOUT_CODE,
} from "@/lib/api/common-errors";
import { hidePostByReportRepository } from "@/lib/moderation/repository";

const MODERATION_HIDE_TIMEOUT_MS = 3000;

type Context = { params: Promise<{ reportId: string }> };

function isAuthorizedModerationRequest(request: Request) {
  const configuredSecret = process.env.MODERATION_SECRET;
  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization");
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return false;
  }

  return authorization.slice("Bearer ".length).trim() === configuredSecret;
}

export async function POST(request: Request, context: Context) {
  if (!isAuthorizedModerationRequest(request)) {
    return fail(API_ERROR_MESSAGE.AUTH_INVALID, 401, API_ERROR_CODE.UNAUTHORIZED);
  }

  const { reportId } = await context.params;
  if (!reportId.trim()) {
    return fail("신고 ID가 필요해요.", 400, API_ERROR_CODE.VALIDATION_ERROR);
  }

  try {
    const result = await runWithTimeout(
      () => hidePostByReportRepository(reportId),
      MODERATION_HIDE_TIMEOUT_MS,
      API_TIMEOUT_CODE.TIMEOUT_MODERATION_HIDE,
      "게시물 비노출 처리 시간이 초과됐어요.",
    );

    return ok({
      reportId: result.reportId,
      postId: result.postId,
      hidden: result.hidden,
      alreadyHidden: result.alreadyHidden,
    });
  } catch (error) {
    if (isApiRouteTimeoutError(error)) {
      return fail("게시물 비노출 처리가 지연되고 있어요.", 504, error.code);
    }

    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code ?? "")
        : "";

    if (code === API_ERROR_CODE.REPORT_NOT_FOUND) {
      return fail(
        "신고를 찾을 수 없어요.",
        404,
        API_ERROR_CODE.REPORT_NOT_FOUND,
      );
    }

    if (code === API_ERROR_CODE.POST_NOT_FOUND) {
      return fail(
        "신고 대상 게시물을 찾을 수 없어요.",
        404,
        API_ERROR_CODE.POST_NOT_FOUND,
      );
    }

    const detail =
      error && typeof error === "object" && "message" in error
        ? (error as { message: string }).message
        : String(error);
    console.error("[api/internal/moderation/reports/:reportId/hide] hide failed:", detail, error);
    return fail(
      "게시물 비노출 처리 중 오류가 발생했어요.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
}

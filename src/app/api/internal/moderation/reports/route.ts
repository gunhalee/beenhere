import { runWithTimeout, isApiRouteTimeoutError } from "@/lib/api/request";
import { fail, ok } from "@/lib/api/response";
import {
  API_ERROR_CODE,
  API_ERROR_MESSAGE,
  API_TIMEOUT_CODE,
} from "@/lib/api/common-errors";
import { listModerationReportsRepository } from "@/lib/moderation/repository";

const MODERATION_REPORTS_TIMEOUT_MS = 3000;

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

function parseLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 50;
  return Math.min(parsed, 100);
}

export async function GET(request: Request) {
  if (!isAuthorizedModerationRequest(request)) {
    return fail(API_ERROR_MESSAGE.AUTH_INVALID, 401, API_ERROR_CODE.UNAUTHORIZED);
  }

  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams.get("limit"));

  try {
    const items = await runWithTimeout(
      () => listModerationReportsRepository(limit),
      MODERATION_REPORTS_TIMEOUT_MS,
      API_TIMEOUT_CODE.TIMEOUT_MODERATION_REPORTS,
      "신고 목록 조회 시간이 초과됐어요.",
    );

    return ok({ items });
  } catch (error) {
    if (isApiRouteTimeoutError(error)) {
      return fail("신고 목록 조회가 지연되고 있어요.", 504, error.code);
    }

    const detail =
      error && typeof error === "object" && "message" in error
        ? (error as { message: string }).message
        : String(error);
    console.error("[api/internal/moderation/reports] list failed:", detail, error);
    return fail(
      "신고 목록을 불러오는 중 오류가 발생했어요.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
}

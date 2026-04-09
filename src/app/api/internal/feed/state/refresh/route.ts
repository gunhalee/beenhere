import { fail, ok } from "@/lib/api/response";
import {
  API_ERROR_CODE,
  API_ERROR_MESSAGE,
  API_TIMEOUT_CODE,
} from "@/lib/api/common-errors";
import { isApiRouteTimeoutError, runWithTimeout } from "@/lib/api/request";
import { refreshFeedStateRepository } from "@/lib/posts/repository/feed-state";

const FEED_STATE_REFRESH_TIMEOUT_MS = 3000;

function isAuthorizedCronRequest(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization");
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return false;
  }

  return authorization.slice("Bearer ".length).trim() === configuredSecret;
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return fail(API_ERROR_MESSAGE.AUTH_INVALID, 401, API_ERROR_CODE.UNAUTHORIZED);
  }

  try {
    const state = await runWithTimeout(
      () => refreshFeedStateRepository(),
      FEED_STATE_REFRESH_TIMEOUT_MS,
      API_TIMEOUT_CODE.TIMEOUT_FEED_STATE_REFRESH,
      "피드 상태 갱신 시간이 초과됐어요.",
    );

    return ok({
      stateVersion: state.stateVersion,
      refreshedAt: state.refreshedAt,
    });
  } catch (error) {
    if (isApiRouteTimeoutError(error)) {
      return fail("피드 상태 갱신이 지연되고 있어요.", 504, error.code);
    }

    const detail =
      error && typeof error === "object" && "message" in error
        ? (error as { message: string }).message
        : String(error);

    console.error("[api/internal/feed/state/refresh] refresh failed:", detail, error);
    return fail(
      "피드 상태 갱신 중 오류가 발생했어요.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
}

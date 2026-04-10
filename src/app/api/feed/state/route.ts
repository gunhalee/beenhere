import { fail, ok } from "@/lib/api/response";
import { API_ERROR_CODE, API_TIMEOUT_CODE } from "@/lib/api/common-errors";
import { isApiRouteTimeoutError, runWithTimeout } from "@/lib/api/request";
import { readFeedStateCachedRepository } from "@/lib/posts/repository/feed-state";

const FEED_STATE_ROUTE_TIMEOUT_MS = 1200;

export async function GET() {
  try {
    const state = await runWithTimeout(
      () => readFeedStateCachedRepository(),
      FEED_STATE_ROUTE_TIMEOUT_MS,
      API_TIMEOUT_CODE.TIMEOUT_STATE,
      "피드 상태 조회 시간이 초과됐어요.",
    );

    return ok({
      stateVersion: state.stateVersion,
      refreshedAt: state.refreshedAt,
    });
  } catch (error) {
    if (isApiRouteTimeoutError(error)) {
      return fail("피드 상태 조회가 지연되고 있어요.", 504, error.code);
    }

    const detail =
      error && typeof error === "object" && "message" in error
        ? (error as { message: string }).message
        : String(error);

    console.error("[api/feed/state] feed state read failed:", detail, error);
    return fail(
      "피드 상태를 불러오는 중 오류가 발생했어요.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
}

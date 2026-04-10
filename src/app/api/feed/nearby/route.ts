import { fail, ok } from "@/lib/api/response";
import { parseCoordinatesFromSearchParams } from "@/lib/api/coordinates";
import { isApiRouteTimeoutError, runWithTimeout } from "@/lib/api/request";
import { API_ERROR_CODE, API_TIMEOUT_CODE } from "@/lib/api/common-errors";
import { readFeedStateCachedRepository } from "@/lib/posts/repository/feed-state";
import { decodeFeedCursor } from "@/lib/posts/repository/cursor";
import { loadNearbyFeedRepository } from "@/lib/posts/repository/feed";

const FEED_NEARBY_ROUTE_TIMEOUT_MS = 3000;
const FEED_STATE_INLINE_TIMEOUT_MS = 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const coordinateResult = parseCoordinatesFromSearchParams(searchParams, {
    latitudeKeys: ["latitude"],
    longitudeKeys: ["longitude"],
    invalidMessage: "유효한 위치 좌표가 필요해요.",
    outOfRangeMessage: "위치 좌표 범위를 확인해 주세요.",
  });

  if (!coordinateResult.ok) {
    return fail(coordinateResult.message, 400, coordinateResult.code);
  }

  const { latitude, longitude } = coordinateResult.data;
  const cursorParam = searchParams.get("cursor");
  if (cursorParam && !decodeFeedCursor(cursorParam)) {
    return fail("유효한 커서 값이 필요해요.", 400, API_ERROR_CODE.INVALID_CURSOR);
  }

  const cursor = cursorParam ?? undefined;
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  try {
    const result = await runWithTimeout(
      () => loadNearbyFeedRepository({ latitude, longitude, cursor, limit }),
      FEED_NEARBY_ROUTE_TIMEOUT_MS,
      API_TIMEOUT_CODE.TIMEOUT_NEARBY,
      "피드 조회 시간이 초과됐어요.",
    );

    let stateVersion: string | null = null;
    if (!cursor) {
      try {
        const state = await runWithTimeout(
          () => readFeedStateCachedRepository(),
          FEED_STATE_INLINE_TIMEOUT_MS,
          API_TIMEOUT_CODE.TIMEOUT_STATE,
          "피드 상태 조회 시간이 초과됐어요.",
        );
        stateVersion = state.stateVersion;
      } catch (stateError) {
        console.warn("[api/feed/nearby] feed state read skipped:", stateError);
      }
    }

    return ok({ items: result.items, nextCursor: result.nextCursor, stateVersion });
  } catch (error) {
    if (isApiRouteTimeoutError(error)) {
      return fail("피드 조회가 지연되고 있어요.", 504, error.code);
    }

    const detail =
      error && typeof error === "object" && "message" in error
        ? (error as { message: string; code?: string }).message
        : String(error);
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    console.error("[api/feed/nearby] 피드 조회 실패:", detail, code || "", error);
    return fail(
      "피드를 불러오는 중 오류가 발생했어요.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
}

import { fail, ok } from "@/lib/api/response";
import { loadNearbyFeedRepository } from "@/lib/posts/repository/feed";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const latitude = parseFloat(searchParams.get("latitude") ?? "");
  const longitude = parseFloat(searchParams.get("longitude") ?? "");

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return fail("유효한 위치 좌표가 필요해요.", 400, "INVALID_LOCATION");
  }

  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return fail("위치 좌표 범위를 확인해 주세요.", 400, "INVALID_LOCATION");
  }

  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  try {
    const result = await loadNearbyFeedRepository({ latitude, longitude, cursor, limit });
    return ok({ items: result.items, nextCursor: result.nextCursor });
  } catch (error) {
    const detail =
      error && typeof error === "object" && "message" in error
        ? (error as { message: string; code?: string }).message
        : String(error);
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    console.error("[api/feed/nearby] 피드 조회 실패:", detail, code || "", error);
    return fail("피드를 불러오는 중 오류가 발생했어요.", 500, "INTERNAL_ERROR");
  }
}

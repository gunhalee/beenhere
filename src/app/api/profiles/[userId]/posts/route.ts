import { fail, ok } from "@/lib/api/response";
import { API_ERROR_CODE } from "@/lib/api/common-errors";
import { parseCoordinatesFromSearchParams } from "@/lib/api/coordinates";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { getProfilePostsRepository } from "@/lib/profiles/repository";

type Context = { params: Promise<{ userId: string }> };

export async function GET(request: Request, context: Context) {
  const { userId } = await context.params;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const coordinateResult = parseCoordinatesFromSearchParams(searchParams, {
    latitudeKeys: ["latitude"],
    longitudeKeys: ["longitude"],
    invalidMessage: "유효한 위치 좌표가 필요해요.",
    outOfRangeMessage: "위치 좌표 범위를 확인해 주세요.",
    required: false,
  });

  if (!coordinateResult.ok) {
    return fail(coordinateResult.message, 400, coordinateResult.code);
  }

  if (!hasSupabaseBrowserConfig()) {
    return ok({ items: [], nextCursor: null });
  }

  try {
    const result = await getProfilePostsRepository({
      userId,
      cursor,
      limit,
      latitude: coordinateResult.data?.latitude,
      longitude: coordinateResult.data?.longitude,
    });
    return ok({ items: result.items, nextCursor: result.nextCursor });
  } catch (error) {
    console.error("[api/profiles/:userId/posts] 조회 실패:", error);
    return fail(
      "작성 글 목록을 불러오는 중 오류가 발생했어요.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
}

import { fail, ok } from "@/lib/api/response";
import { API_ERROR_CODE, API_ERROR_MESSAGE } from "@/lib/api/common-errors";
import { parseCoordinatesFromSearchParams } from "@/lib/api/coordinates";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProfileLikesRepository } from "@/lib/profiles/repository";

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
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isOwnArchive = Boolean(user?.id && user.id === userId);
    if (isOwnArchive && user?.is_anonymous) {
      return fail(
        API_ERROR_MESSAGE.LOGIN_REQUIRED_FOR_ARCHIVE,
        403,
        API_ERROR_CODE.LOGIN_REQUIRED_FOR_ARCHIVE,
      );
    }

    const result = await getProfileLikesRepository({
      userId,
      cursor,
      limit,
      latitude: coordinateResult.data?.latitude,
      longitude: coordinateResult.data?.longitude,
    });
    return ok({ items: result.items, nextCursor: result.nextCursor });
  } catch (error) {
    console.error("[api/profiles/:userId/likes] 조회 실패:", error);
    return fail(
      "라이크 목록을 불러오는 중 오류가 발생했어요.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
}

import { API_ERROR_CODE } from "@/lib/api/common-errors";
import { parseCoordinatesFromSearchParams } from "@/lib/api/coordinates";
import { createReadRouteHandler, failValidation } from "@/lib/api/route-helpers";
import { formatNicknameForDisplay } from "@/lib/nickname/format";
import { getFeedPostLikersPreviewBatchRepository } from "@/lib/posts/repository/feed";
import type { FeedLikersPreviewItem } from "@/types/api";

export const GET = createReadRouteHandler<
  { latitude: number; longitude: number; postIds: string[] },
  { items: FeedLikersPreviewItem[] }
>({
  parse: (request) => {
    const { searchParams } = new URL(request.url);
    const coordinateResult = parseCoordinatesFromSearchParams(searchParams, {
      latitudeKeys: ["latitude"],
      longitudeKeys: ["longitude"],
      invalidMessage: "유효한 위치 좌표가 필요해요.",
      outOfRangeMessage: "위치 좌표 범위를 확인해 주세요.",
    });
    if (!coordinateResult.ok) {
      return { ok: false, response: failValidation(coordinateResult.message, coordinateResult.code) };
    }
    const rawPostIds = searchParams.get("postIds") ?? "";
    const postIds = rawPostIds
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (postIds.length === 0) {
      return {
        ok: false,
        response: failValidation("postIds 값이 필요해요.", API_ERROR_CODE.VALIDATION_ERROR),
      };
    }
    return {
      ok: true,
      parsed: {
        latitude: coordinateResult.data.latitude,
        longitude: coordinateResult.data.longitude,
        postIds,
      },
    };
  },
  action: async ({ parsed }) => {
    const rows = await getFeedPostLikersPreviewBatchRepository({
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      postIds: parsed.postIds,
    });

    const items: FeedLikersPreviewItem[] = rows.map((row) => ({
      postId: String(row.post_id),
      likers: (row.liker_nicknames ?? []).map((nickname, index) => ({
        nickname: formatNicknameForDisplay(String(nickname)),
        userId: row.liker_user_ids?.[index] ?? null,
      })),
    }));
    return { ok: true, data: { items } };
  },
  onError: {
    logLabel: "[api/posts/likers-preview] preview fetch failed:",
    message: "수집한 사람 미리보기를 불러오는 중 오류가 발생했어요.",
  },
});

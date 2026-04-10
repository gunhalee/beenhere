import { fail, ok } from "@/lib/api/response";
import { API_ERROR_CODE } from "@/lib/api/common-errors";
import { parseCoordinatesFromSearchParams } from "@/lib/api/coordinates";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";

type Context = { params: Promise<{ userId: string }> };

type ListQueryInput = {
  userId: string;
  cursor?: string;
  limit: number;
  latitude?: number;
  longitude?: number;
};

type ListQueryResult<TItem> = {
  items: TItem[];
  nextCursor: string | null;
};

type ListQueryRepository<TItem> = (
  input: ListQueryInput,
) => Promise<ListQueryResult<TItem>>;

type HandleProfileListRouteInput<TItem> = {
  request: Request;
  context: Context;
  repository: ListQueryRepository<TItem>;
  internalErrorMessage: string;
  errorLogTag: string;
};

const OPTIONAL_PROFILE_COORDINATE_OPTIONS = {
  latitudeKeys: ["latitude"],
  longitudeKeys: ["longitude"],
  invalidMessage: "유효한 위치 좌표가 필요해요.",
  outOfRangeMessage: "위치 좌표 범위를 확인해 주세요.",
  required: false as const,
};

export async function handleProfileListRoute<TItem>({
  request,
  context,
  repository,
  internalErrorMessage,
  errorLogTag,
}: HandleProfileListRouteInput<TItem>) {
  const { userId } = await context.params;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  const coordinateResult = parseCoordinatesFromSearchParams(
    searchParams,
    OPTIONAL_PROFILE_COORDINATE_OPTIONS,
  );

  if (!coordinateResult.ok) {
    return fail(coordinateResult.message, 400, coordinateResult.code);
  }

  if (!hasSupabaseBrowserConfig()) {
    return ok({ items: [], nextCursor: null });
  }

  try {
    const result = await repository({
      userId,
      cursor,
      limit,
      latitude: coordinateResult.data?.latitude,
      longitude: coordinateResult.data?.longitude,
    });
    return ok({ items: result.items, nextCursor: result.nextCursor });
  } catch (error) {
    console.error(errorLogTag, error);
    return fail(internalErrorMessage, 500, API_ERROR_CODE.INTERNAL_ERROR);
  }
}

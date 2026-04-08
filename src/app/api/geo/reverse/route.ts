/**
 * GET /api/geo/reverse?lat=&lng=
 *
 * GPS 좌표 → 구(區) 수준 장소 라벨 변환.
 * Kakao Local API(coord2regioncode) 서버 프록시:
 *   - REST API 키 서버 보관
 *   - Next.js 캐시(1시간)로 동일 좌표 재호출 방지
 *
 * 반환 예: { placeLabel: "마포구" } | { placeLabel: "해운대구" } | { placeLabel: "제주시" }
 */
import { fail, ok } from "@/lib/api/response";

const KAKAO_COORD2REGION_URL =
  "https://dapi.kakao.com/v2/local/geo/coord2regioncode.json";
const REQUEST_TIMEOUT_MS = 6000;
const CACHE_REVALIDATE_SECONDS = 60 * 60; // 1시간
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;

type KakaoCoord2RegionResponse = {
  documents?: Array<{
    region_type?: "H" | "B" | string; // H: 행정동 / B: 법정동
    region_1depth_name?: string; // 시/도
    region_2depth_name?: string; // 구/군/시
    region_3depth_name?: string; // 읍/면/동
  }>;
};

/**
 * 동일 좌표에 대해 행정동(H) 결과를 우선한다.
 * 일부 지역은 법정동(B)만 오는 경우가 있어 fallback 한다.
 */
function pickPrimaryRegion(
  documents: NonNullable<KakaoCoord2RegionResponse["documents"]>,
) {
  if (documents.length === 0) return null;
  return (
    documents.find((doc) => doc.region_type === "H") ??
    documents.find((doc) => doc.region_type === "B") ??
    documents[0] ??
    null
  );
}

/**
 * Kakao 응답에서 placeLabel(구/군/시 우선)을 추출한다.
 */
function extractPlaceLabel(region: {
  region_1depth_name?: string;
  region_2depth_name?: string;
  region_3depth_name?: string;
}): string | null {
  const candidates = [
    region.region_2depth_name,
    region.region_3depth_name,
    region.region_1depth_name,
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }

  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return fail("유효한 좌표가 필요해요.", 400, "INVALID_LOCATION");
  }

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return fail("좌표 범위를 확인해 주세요.", 400, "INVALID_LOCATION");
  }

  if (!KAKAO_REST_API_KEY) {
    return fail(
      "서버 설정에 카카오 REST API 키가 없어요.",
      500,
      "GEOCODE_NOT_CONFIGURED",
    );
  }

  const url = new URL(KAKAO_COORD2REGION_URL);
  url.searchParams.set("x", String(lng)); // 경도
  url.searchParams.set("y", String(lat)); // 위도
  url.searchParams.set("input_coord", "WGS84");

  const controller = new AbortController();
  const timeoutHandle = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
      },
      signal: controller.signal,
      // Next.js 캐시: 동일 좌표 재요청 1시간 방지
      next: { revalidate: CACHE_REVALIDATE_SECONDS },
    });

    if (response.status === 401 || response.status === 403) {
      return fail(
        "역지오코딩 인증에 실패했어요. 서버 키 설정을 확인해 주세요.",
        502,
        "GEOCODE_AUTH_FAILED",
      );
    }

    if (response.status === 429) {
      return fail(
        "위치 요청이 많아요. 잠시 후 다시 시도해 주세요.",
        429,
        "GEOCODE_RATE_LIMITED",
      );
    }

    if (!response.ok) {
      throw new Error(`Kakao Local API error: ${response.status}`);
    }

    const json = (await response.json()) as KakaoCoord2RegionResponse;
    const primaryRegion = pickPrimaryRegion(json.documents ?? []);

    if (!primaryRegion) {
      return fail("이 좌표의 지역 정보를 찾지 못했어요.", 422, "GEOCODE_FAILED");
    }

    const placeLabel = extractPlaceLabel(primaryRegion);

    if (!placeLabel) {
      return fail("이 좌표의 지역 정보를 찾지 못했어요.", 422, "GEOCODE_FAILED");
    }

    return ok({ placeLabel });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return fail(
        "위치 확인 시간이 초과됐어요. 다시 시도해 주세요.",
        504,
        "GEOCODE_TIMEOUT",
      );
    }

    console.error("[api/geo/reverse] Kakao Local API 요청 실패:", error);
    return fail(
      "지역 정보를 가져오는 중 오류가 발생했어요.",
      502,
      "GEOCODE_ERROR",
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
}

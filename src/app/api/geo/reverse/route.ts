/**
 * GET /api/geo/reverse?lat=&lng=
 *
 * GPS 좌표 → 구(區) 수준 장소 라벨 변환.
 * Nominatim(OpenStreetMap) 서버 프록시:
 *   - CORS 우회
 *   - Next.js 캐시(1시간)로 동일 좌표 재호출 방지
 *   - User-Agent 요구사항 충족
 *
 * 반환 예: { placeLabel: "마포구" } | { placeLabel: "해운대구" } | { placeLabel: "제주시" }
 */
import { fail, ok } from "@/lib/api/response";

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const REQUEST_TIMEOUT_MS = 6000;
const CACHE_REVALIDATE_SECONDS = 60 * 60; // 1시간

// Nominatim geocodejson 응답 타입 (필요한 필드만)
type NominatimGeocodjson = {
  features?: Array<{
    properties?: {
      geocoding?: {
        county?: string;
        city?: string;
        state?: string;
        country?: string;
        country_code?: string;
        admin?: {
          level4?: string;  // 시/도  (서울특별시, 경기도)
          level5?: string;  // 자치구 (마포구, 해운대구)
          level6?: string;  // 시/군  (소규모 시·군)
          level8?: string;  // 행정동 (합정동)
        };
      };
    };
  }>;
};

type GeoCoding = NonNullable<
  NonNullable<
    NonNullable<NominatimGeocodjson["features"]>[number]["properties"]
  >["geocoding"]
>;

/**
 * Nominatim 응답에서 구(區) 수준 장소 라벨을 추출한다.
 *
 * 우선순위:
 *   1. admin.level5 — 광역시 자치구 (마포구, 해운대구)
 *   2. county       — 동일 데이터를 다른 키로 제공하기도 함
 *   3. admin.level6 — 소규모 시/군 (완주군, 고흥군)
 *   4. city         — 도시명 (제주시, 천안시)
 *   5. admin.level4 — 시/도 (최후 수단)
 */
function extractPlaceLabel(geocoding: GeoCoding): string | null {
  const candidates = [
    geocoding.admin?.level5,
    geocoding.county,
    geocoding.admin?.level6,
    geocoding.city,
    geocoding.admin?.level4,
    geocoding.state,
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

  const url = new URL(NOMINATIM_REVERSE_URL);
  url.searchParams.set("format", "geocodejson");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "12"); // 구(district) 수준
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));

  const controller = new AbortController();
  const timeoutHandle = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      headers: {
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.6",
        // Nominatim 이용 정책: 식별 가능한 User-Agent 필수
        "User-Agent": "beenhere-mvp/1.0 (https://github.com/beenhere)",
      },
      signal: controller.signal,
      // Next.js 캐시: 동일 좌표 재요청 1시간 방지
      next: { revalidate: CACHE_REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }

    const json = (await response.json()) as NominatimGeocodjson;
    const geocoding = json.features?.[0]?.properties?.geocoding;

    if (!geocoding) {
      return fail("이 좌표의 지역 정보를 찾지 못했어요.", 422, "GEOCODE_FAILED");
    }

    const placeLabel = extractPlaceLabel(geocoding);

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

    console.error("[api/geo/reverse] Nominatim 요청 실패:", error);
    return fail(
      "지역 정보를 가져오는 중 오류가 발생했어요.",
      502,
      "GEOCODE_ERROR",
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * 클라이언트 사이드 역지오코딩 유틸리티.
 *
 * GPS 좌표를 구(區) 수준 장소 라벨로 변환한다.
 * 실제 Kakao Local API 호출은 /api/geo/reverse 서버 라우트가 처리한다.
 *
 * 사용 예:
 *   const coords = await getCurrentBrowserCoordinates();
 *   const placeLabel = await resolvePlaceLabel(coords); // "마포구"
 */

import { fetchApi } from "@/lib/api/client";
import { API_ERROR_CODE } from "@/lib/api/common-errors";
import type { Coordinates } from "./browser-location";

type ReverseGeocodeResponse = { placeLabel: string };

/**
 * 좌표 → 구(區) 수준 장소 라벨.
 * 글 작성 시 placeLabel 필드에 사용한다.
 *
 * 실패 시 Error를 throw한다.
 * 호출 측에서 try/catch로 감싸고 사용자에게 에러 메시지를 보여준다.
 */
export async function resolvePlaceLabel(coords: Coordinates): Promise<string> {
  const params = new URLSearchParams({
    lat: String(coords.latitude),
    lng: String(coords.longitude),
  });

  const result = await fetchApi<ReverseGeocodeResponse>(
    `/api/geo/reverse?${params.toString()}`,
    {
      timeoutMs: 2500,
      timeoutErrorMessage: "위치 확인이 지연되고 있어요. 다시 시도해 주세요.",
      timeoutCode: API_ERROR_CODE.GEOCODE_TIMEOUT,
    },
  );

  if (!result.ok) {
    const code = result.code ?? API_ERROR_CODE.GEOCODE_ERROR;
    throw Object.assign(
      new Error(result.error ?? "지역 정보를 가져오지 못했어요."),
      { code },
    );
  }

  return result.data.placeLabel;
}

/**
 * 역지오코딩 에러 코드를 사용자 메시지로 변환한다.
 */
export function getGeocodingErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "지역 정보를 가져오지 못했어요. 다시 시도해 주세요.";
  }

  const code = (error as Error & { code?: string }).code;

  switch (code) {
    case API_ERROR_CODE.GEOCODE_TIMEOUT:
      return "위치 확인 시간이 초과됐어요. 다시 시도해 주세요.";
    case API_ERROR_CODE.GEOCODE_FAILED:
      return "이 위치의 지역 정보를 찾지 못했어요.";
    case API_ERROR_CODE.GEOCODE_NOT_CONFIGURED:
      return "위치 서비스 설정이 아직 완료되지 않았어요.";
    case API_ERROR_CODE.GEOCODE_AUTH_FAILED:
      return "위치 서비스 인증에 실패했어요. 잠시 후 다시 시도해 주세요.";
    case API_ERROR_CODE.GEOCODE_RATE_LIMITED:
      return "위치 요청이 많아요. 잠시 후 다시 시도해 주세요.";
    case API_ERROR_CODE.TIMEOUT:
      return "요청 시간이 초과됐어요. 다시 시도해 주세요.";
    case API_ERROR_CODE.NETWORK_ERROR:
      return "네트워크 연결을 확인해 주세요.";
    default:
      return "지역 정보를 가져오지 못했어요. 다시 시도해 주세요.";
  }
}

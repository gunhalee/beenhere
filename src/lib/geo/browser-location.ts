// 앱 전역에서 좌표를 다룰 때 이 타입을 사용한다
export type Coordinates = {
  latitude:  number;
  longitude: number;
};

export type GeoErrorCode =
  | "GEOLOCATION_UNAVAILABLE"
  | "GEOLOCATION_PERMISSION_DENIED"
  | "GEOLOCATION_POSITION_UNAVAILABLE"
  | "GEOLOCATION_TIMEOUT"
  | "GEOLOCATION_FAILED";

function canUseBrowserGeolocation() {
  return typeof window !== "undefined" && "geolocation" in navigator;
}

export function getCurrentBrowserCoordinates(
  timeoutMs = 10000,
): Promise<Coordinates> {
  if (!canUseBrowserGeolocation()) {
    return Promise.reject(new Error("GEOLOCATION_UNAVAILABLE" satisfies GeoErrorCode));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({ latitude: coords.latitude, longitude: coords.longitude });
      },
      (error) => {
        const code: GeoErrorCode =
          error.code === error.PERMISSION_DENIED
            ? "GEOLOCATION_PERMISSION_DENIED"
            : error.code === error.POSITION_UNAVAILABLE
              ? "GEOLOCATION_POSITION_UNAVAILABLE"
              : error.code === error.TIMEOUT
                ? "GEOLOCATION_TIMEOUT"
                : "GEOLOCATION_FAILED";
        reject(new Error(code));
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: timeoutMs },
    );
  });
}

/**
 * GeoErrorCode를 사용자에게 보여줄 메시지로 변환한다.
 * 작성 화면·위치 권한 배너에서 사용한다.
 */
export function getGeoErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "현재 위치를 확인하지 못했어요. 다시 시도해 주세요.";
  }

  switch (error.message as GeoErrorCode) {
    case "GEOLOCATION_PERMISSION_DENIED":
      return "위치 권한을 허용하면 이 위치에 글을 남길 수 있어요.";
    case "GEOLOCATION_TIMEOUT":
      return "위치 확인 시간이 초과됐어요. 다시 시도해 주세요.";
    case "GEOLOCATION_UNAVAILABLE":
      return "이 브라우저에서는 위치 정보를 사용할 수 없어요.";
    case "GEOLOCATION_POSITION_UNAVAILABLE":
      return "현재 위치를 아직 찾지 못했어요. 다시 시도해 주세요.";
    default:
      return "현재 위치를 확인하지 못했어요. 다시 시도해 주세요.";
  }
}

/**
 * 위치 권한 거부 여부를 판별한다.
 * 읽기 전용 모드 분기에 사용한다.
 */
export function isGeoPermissionDenied(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message === ("GEOLOCATION_PERMISSION_DENIED" satisfies GeoErrorCode)
  );
}

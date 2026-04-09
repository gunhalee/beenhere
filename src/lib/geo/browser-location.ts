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

export type GeoErrorMessageContext = "default" | "compose" | "like";
export type GeoRequestContext = "default" | "feed" | "compose" | "like";

type GetCurrentBrowserCoordinatesOptions = {
  timeoutMs?: number;
  context?: GeoRequestContext;
};

type CachedCoordinatesRecord = Coordinates & { savedAt: number };

const GEO_PERMISSION_DENIED_MESSAGES: Record<GeoErrorMessageContext, string> = {
  default: "위치 권한을 허용하면 이 위치에 글을 남길 수 있어요.",
  compose: "위치 권한을 허용하면 글을 남길 수 있어요. 브라우저 설정을 확인해 주세요.",
  like: "위치 권한을 허용해야 라이크를 남길 수 있어요.",
};

const GEO_TIMEOUT_MS_BY_CONTEXT: Record<GeoRequestContext, number> = {
  default: 10_000,
  feed: 3_000,
  compose: 2_500,
  like: 1_500,
};

const GEO_COORDINATES_CACHE_KEY = "beenhere:last-browser-coordinates";
const DEFAULT_COORDINATES_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

function canUseBrowserGeolocation() {
  return typeof window !== "undefined" && "geolocation" in navigator;
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseCoordinatesRecord(value: unknown): CachedCoordinatesRecord | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<CachedCoordinatesRecord>;
  if (
    !isFiniteNumber(candidate.latitude) ||
    !isFiniteNumber(candidate.longitude) ||
    !isFiniteNumber(candidate.savedAt)
  ) {
    return null;
  }

  return {
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    savedAt: candidate.savedAt,
  };
}

function saveCachedCoordinates(coords: Coordinates) {
  if (!canUseLocalStorage()) return;

  const record: CachedCoordinatesRecord = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    savedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(GEO_COORDINATES_CACHE_KEY, JSON.stringify(record));
  } catch {
    // private mode / quota exceeded 등은 무시
  }
}

function resolveTimeoutMs(
  optionsOrTimeoutMs?: number | GetCurrentBrowserCoordinatesOptions,
) {
  if (typeof optionsOrTimeoutMs === "number") {
    return optionsOrTimeoutMs;
  }

  const context = optionsOrTimeoutMs?.context ?? "default";
  return optionsOrTimeoutMs?.timeoutMs ?? GEO_TIMEOUT_MS_BY_CONTEXT[context];
}

export function getCachedBrowserCoordinates(
  maxAgeMs = DEFAULT_COORDINATES_CACHE_MAX_AGE_MS,
): Coordinates | null {
  if (!canUseLocalStorage()) return null;

  try {
    const raw = window.localStorage.getItem(GEO_COORDINATES_CACHE_KEY);
    if (!raw) return null;
    const parsed = parseCoordinatesRecord(JSON.parse(raw));
    if (!parsed) return null;
    if (Date.now() - parsed.savedAt > maxAgeMs) return null;

    return {
      latitude: parsed.latitude,
      longitude: parsed.longitude,
    };
  } catch {
    return null;
  }
}

export function getCurrentBrowserCoordinates(
  optionsOrTimeoutMs?: number | GetCurrentBrowserCoordinatesOptions,
): Promise<Coordinates> {
  if (!canUseBrowserGeolocation()) {
    return Promise.reject(new Error("GEOLOCATION_UNAVAILABLE" satisfies GeoErrorCode));
  }

  const timeoutMs = resolveTimeoutMs(optionsOrTimeoutMs);

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const value = { latitude: coords.latitude, longitude: coords.longitude };
        saveCachedCoordinates(value);
        resolve(value);
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
export function getGeoErrorMessage(
  error: unknown,
  context: GeoErrorMessageContext = "default",
): string {
  if (!(error instanceof Error)) {
    return "현재 위치를 확인하지 못했어요. 다시 시도해 주세요.";
  }

  switch (error.message as GeoErrorCode) {
    case "GEOLOCATION_PERMISSION_DENIED":
      return GEO_PERMISSION_DENIED_MESSAGES[context];
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

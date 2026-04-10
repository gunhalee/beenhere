import {
  getCachedBrowserCoordinates,
  getCurrentBrowserCoordinates,
  getGeoErrorMessage,
  type Coordinates,
  type GeoErrorMessageContext,
  type GeoRequestContext,
} from "./browser-location";

type CoordinatesRef = {
  current: Coordinates | null;
};

type ResolveCoordinatesSource = "ref" | "cache" | "browser";

type ResolveCoordinatesSuccess = {
  ok: true;
  coords: Coordinates;
  source: ResolveCoordinatesSource;
};

type ResolveCoordinatesFailure = {
  ok: false;
  error: unknown;
  message: string;
};

type ResolveCoordinatesOptions = {
  coordsRef: CoordinatesRef;
  context?: GeoRequestContext;
  errorContext?: GeoErrorMessageContext;
  timeoutMs?: number;
  allowRef?: boolean;
  allowCached?: boolean;
  allowCurrent?: boolean;
};

export async function resolveCoordinatesWithRef(
  options: ResolveCoordinatesOptions,
): Promise<ResolveCoordinatesSuccess | ResolveCoordinatesFailure> {
  const allowRef = options.allowRef ?? true;
  const allowCached = options.allowCached ?? true;
  const allowCurrent = options.allowCurrent ?? true;
  const context = options.context ?? "default";
  const errorContext = options.errorContext ?? "default";
  const timeoutMs = options.timeoutMs;

  if (allowRef && options.coordsRef.current) {
    return {
      ok: true,
      coords: options.coordsRef.current,
      source: "ref",
    };
  }

  if (allowCached) {
    const cachedCoords = getCachedBrowserCoordinates();
    if (cachedCoords) {
      options.coordsRef.current = cachedCoords;
      return {
        ok: true,
        coords: cachedCoords,
        source: "cache",
      };
    }
  }

  if (!allowCurrent) {
    const error = new Error("GEOLOCATION_UNAVAILABLE");
    return {
      ok: false,
      error,
      message: getGeoErrorMessage(error, errorContext),
    };
  }

  try {
    const currentCoords = await getCurrentBrowserCoordinates(
      timeoutMs === undefined ? { context } : { context, timeoutMs },
    );
    options.coordsRef.current = currentCoords;
    return {
      ok: true,
      coords: currentCoords,
      source: "browser",
    };
  } catch (error) {
    return {
      ok: false,
      error,
      message: getGeoErrorMessage(error, errorContext),
    };
  }
}

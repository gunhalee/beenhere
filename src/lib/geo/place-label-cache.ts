import type { Coordinates } from "./browser-location";
import { resolvePlaceLabel } from "./reverse-geocode";

type PlaceLabelCacheEntry = {
  placeLabel: string;
  expiresAt: number;
};

type ResolvePlaceLabelWithCacheOptions = {
  ttlMs?: number;
};

const DEFAULT_PLACE_LABEL_TTL_MS = 10 * 60 * 1000;
const PLACE_LABEL_COORD_PRECISION = 4;

const placeLabelCache = new Map<string, PlaceLabelCacheEntry>();
const inFlightRequests = new Map<string, Promise<string>>();

function getCacheKey(coords: Coordinates) {
  return `${coords.latitude.toFixed(PLACE_LABEL_COORD_PRECISION)}:${coords.longitude.toFixed(
    PLACE_LABEL_COORD_PRECISION,
  )}`;
}

export function getCachedPlaceLabel(coords: Coordinates): string | null {
  const key = getCacheKey(coords);
  const cached = placeLabelCache.get(key);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    placeLabelCache.delete(key);
    return null;
  }

  return cached.placeLabel;
}

export async function resolvePlaceLabelWithCache(
  coords: Coordinates,
  options?: ResolvePlaceLabelWithCacheOptions,
): Promise<string> {
  const cached = getCachedPlaceLabel(coords);
  if (cached) return cached;

  const key = getCacheKey(coords);
  const inFlight = inFlightRequests.get(key);
  if (inFlight) return inFlight;

  const ttlMs = options?.ttlMs ?? DEFAULT_PLACE_LABEL_TTL_MS;
  const request = resolvePlaceLabel(coords)
    .then((placeLabel) => {
      placeLabelCache.set(key, {
        placeLabel,
        expiresAt: Date.now() + ttlMs,
      });
      return placeLabel;
    })
    .finally(() => {
      inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, request);
  return request;
}

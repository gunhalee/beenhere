const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 50;

export function clampLimit(raw: number | undefined): number {
  if (!raw || !Number.isFinite(raw) || raw < 1) return DEFAULT_PAGE_LIMIT;
  return Math.min(raw, MAX_PAGE_LIMIT);
}

export function toNullableDistance(
  distanceMeters: number | null | undefined,
): number | null {
  if (distanceMeters == null) return null;
  const numericDistance = Number(distanceMeters);
  if (!Number.isFinite(numericDistance) || numericDistance < 0) {
    return null;
  }
  return numericDistance;
}

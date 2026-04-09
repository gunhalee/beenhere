import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Coordinates } from "./browser-location";
import {
  getCachedBrowserCoordinates,
  getCurrentBrowserCoordinates,
  getGeoErrorMessage,
} from "./browser-location";
import { resolveCoordinatesWithRef } from "./resolve-coordinates";

vi.mock("./browser-location", () => ({
  getCachedBrowserCoordinates: vi.fn(),
  getCurrentBrowserCoordinates: vi.fn(),
  getGeoErrorMessage: vi.fn(),
}));

describe("resolveCoordinatesWithRef", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCachedBrowserCoordinates).mockReturnValue(null);
    vi.mocked(getGeoErrorMessage).mockImplementation(() => "location error");
  });

  it("returns ref coordinates first when available", async () => {
    const coordsRef = {
      current: { latitude: 37.55, longitude: 127.02 } satisfies Coordinates,
    };

    const result = await resolveCoordinatesWithRef({
      coordsRef,
      context: "feed",
    });

    expect(result).toEqual({
      ok: true,
      coords: { latitude: 37.55, longitude: 127.02 },
      source: "ref",
    });
    expect(getCachedBrowserCoordinates).not.toHaveBeenCalled();
    expect(getCurrentBrowserCoordinates).not.toHaveBeenCalled();
  });

  it("falls back to cached coordinates and syncs ref", async () => {
    vi.mocked(getCachedBrowserCoordinates).mockReturnValue({
      latitude: 37.56,
      longitude: 127.03,
    });
    const coordsRef = { current: null as Coordinates | null };

    const result = await resolveCoordinatesWithRef({
      coordsRef,
      context: "feed",
    });

    expect(result).toEqual({
      ok: true,
      coords: { latitude: 37.56, longitude: 127.03 },
      source: "cache",
    });
    expect(coordsRef.current).toEqual({ latitude: 37.56, longitude: 127.03 });
    expect(getCurrentBrowserCoordinates).not.toHaveBeenCalled();
  });

  it("requests browser coordinates when ref/cache are unavailable", async () => {
    vi.mocked(getCurrentBrowserCoordinates).mockResolvedValue({
      latitude: 37.57,
      longitude: 127.04,
    });
    const coordsRef = { current: null as Coordinates | null };

    const result = await resolveCoordinatesWithRef({
      coordsRef,
      context: "like",
      errorContext: "like",
    });

    expect(result).toEqual({
      ok: true,
      coords: { latitude: 37.57, longitude: 127.04 },
      source: "browser",
    });
    expect(coordsRef.current).toEqual({ latitude: 37.57, longitude: 127.04 });
    expect(getCurrentBrowserCoordinates).toHaveBeenCalledWith({ context: "like" });
  });

  it("returns error and mapped message when browser request fails", async () => {
    const browserError = new Error("GEOLOCATION_PERMISSION_DENIED");
    vi.mocked(getCurrentBrowserCoordinates).mockRejectedValue(browserError);
    const coordsRef = { current: null as Coordinates | null };

    const result = await resolveCoordinatesWithRef({
      coordsRef,
      context: "like",
      errorContext: "like",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(browserError);
      expect(result.message).toBe("location error");
    }
    expect(getGeoErrorMessage).toHaveBeenCalledWith(browserError, "like");
  });
});

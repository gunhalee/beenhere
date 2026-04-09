import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePlaceLabel } from "./reverse-geocode";
import { getCachedPlaceLabel, resolvePlaceLabelWithCache } from "./place-label-cache";

vi.mock("./reverse-geocode", () => ({
  resolvePlaceLabel: vi.fn(),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("resolvePlaceLabelWithCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and caches when no cached value exists", async () => {
    const coords = { latitude: 37.501, longitude: 127.001 };
    vi.mocked(resolvePlaceLabel).mockResolvedValue("Gangnam-gu");

    const placeLabel = await resolvePlaceLabelWithCache(coords);

    expect(placeLabel).toBe("Gangnam-gu");
    expect(resolvePlaceLabel).toHaveBeenCalledTimes(1);
    expect(getCachedPlaceLabel(coords)).toBe("Gangnam-gu");
  });

  it("returns cached value immediately and updates cache in background", async () => {
    const coords = { latitude: 37.502, longitude: 127.002 };
    const deferred = createDeferred<string>();
    vi.mocked(resolvePlaceLabel)
      .mockResolvedValueOnce("Mapo-gu")
      .mockImplementationOnce(() => deferred.promise);

    await resolvePlaceLabelWithCache(coords);

    const immediate = await resolvePlaceLabelWithCache(coords);
    expect(immediate).toBe("Mapo-gu");
    expect(resolvePlaceLabel).toHaveBeenCalledTimes(2);

    deferred.resolve("Seodaemun-gu");
    await deferred.promise;
    await flushPromises();

    expect(getCachedPlaceLabel(coords)).toBe("Seodaemun-gu");
  });

  it("calls onRevalidated when background refresh returns a different label", async () => {
    const coords = { latitude: 37.503, longitude: 127.003 };
    const onRevalidated = vi.fn();

    vi.mocked(resolvePlaceLabel)
      .mockResolvedValueOnce("Jongno-gu")
      .mockResolvedValueOnce("Jung-gu");

    await resolvePlaceLabelWithCache(coords);

    const immediate = await resolvePlaceLabelWithCache(coords, {
      onRevalidated,
    });
    expect(immediate).toBe("Jongno-gu");
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(resolvePlaceLabel).toHaveBeenCalledTimes(2);
    expect(onRevalidated).toHaveBeenCalledTimes(1);
    expect(onRevalidated).toHaveBeenCalledWith("Jung-gu");
  });

  it("deduplicates background refresh requests per cache key", async () => {
    const coords = { latitude: 37.504, longitude: 127.004 };
    const deferred = createDeferred<string>();

    vi.mocked(resolvePlaceLabel)
      .mockResolvedValueOnce("Yongsan-gu")
      .mockImplementationOnce(() => deferred.promise);

    await resolvePlaceLabelWithCache(coords);

    const first = await resolvePlaceLabelWithCache(coords);
    const second = await resolvePlaceLabelWithCache(coords);

    expect(first).toBe("Yongsan-gu");
    expect(second).toBe("Yongsan-gu");
    expect(resolvePlaceLabel).toHaveBeenCalledTimes(2);

    deferred.resolve("Seongdong-gu");
    await deferred.promise;
    await flushPromises();
  });
});

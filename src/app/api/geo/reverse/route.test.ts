import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ROUTE_URL = "http://localhost/api/geo/reverse";

type ReverseRoute = typeof import("./route");

async function loadRouteWithApiKey(
  apiKey: string | null,
): Promise<ReverseRoute["GET"]> {
  if (apiKey === null) {
    delete process.env.KAKAO_REST_API_KEY;
  } else {
    process.env.KAKAO_REST_API_KEY = apiKey;
  }

  vi.resetModules();
  const { GET } = await import("./route");
  return GET;
}

function makeRequest(query: string) {
  return new Request(`${ROUTE_URL}?${query}`);
}

describe("GET /api/geo/reverse", () => {
  const originalApiKey = process.env.KAKAO_REST_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalApiKey === undefined) {
      delete process.env.KAKAO_REST_API_KEY;
    } else {
      process.env.KAKAO_REST_API_KEY = originalApiKey;
    }
  });

  it("returns 400 when coordinates are invalid", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const GET = await loadRouteWithApiKey("kakao-key");

    const response = await GET(makeRequest("lat=bad&lng=127.0"));
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("INVALID_LOCATION");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 500 when kakao key is not configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const GET = await loadRouteWithApiKey(null);

    const response = await GET(makeRequest("lat=37.5&lng=127.0"));
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("GEOCODE_NOT_CONFIGURED");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([401, 403])(
    "returns 502 GEOCODE_AUTH_FAILED when kakao responds %s",
    async (status) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({}), { status }),
      );
      const GET = await loadRouteWithApiKey("kakao-key");

      const response = await GET(makeRequest("lat=37.5&lng=127.0"));
      const json = (await response.json()) as { ok: boolean; code?: string };

      expect(response.status).toBe(502);
      expect(json.ok).toBe(false);
      expect(json.code).toBe("GEOCODE_AUTH_FAILED");
    },
  );

  it("returns 429 GEOCODE_RATE_LIMITED when kakao responds 429", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 429 }),
    );
    const GET = await loadRouteWithApiKey("kakao-key");

    const response = await GET(makeRequest("lat=37.5&lng=127.0"));
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(429);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("GEOCODE_RATE_LIMITED");
  });

  it("returns 422 GEOCODE_FAILED when no region documents are returned", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ documents: [] }), { status: 200 }),
    );
    const GET = await loadRouteWithApiKey("kakao-key");

    const response = await GET(makeRequest("lat=37.5&lng=127.0"));
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(422);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("GEOCODE_FAILED");
  });

  it("returns 504 GEOCODE_TIMEOUT on abort error", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(abortError);
    const GET = await loadRouteWithApiKey("kakao-key");

    const response = await GET(makeRequest("lat=37.5&lng=127.0"));
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(504);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("GEOCODE_TIMEOUT");
  });

  it("returns 502 GEOCODE_ERROR on unknown upstream error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 500 }),
    );
    const GET = await loadRouteWithApiKey("kakao-key");

    const response = await GET(makeRequest("lat=37.5&lng=127.0"));
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(502);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("GEOCODE_ERROR");
  });

  it("returns placeLabel and prefers H region over B region", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          documents: [
            { region_type: "B", region_2depth_name: "법정구" },
            { region_type: "H", region_2depth_name: "행정구" },
          ],
        }),
        { status: 200 },
      ),
    );
    const GET = await loadRouteWithApiKey("kakao-key");

    const response = await GET(makeRequest("lat=37.5&lng=127.0"));
    const json = (await response.json()) as {
      ok: boolean;
      data?: { placeLabel: string };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data?.placeLabel).toBe("행정구");
  });
});

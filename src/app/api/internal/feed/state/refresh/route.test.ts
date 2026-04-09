import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { refreshFeedStateRepository } from "@/lib/posts/repository/feed-state";
import { ApiRouteTimeoutError } from "@/lib/api/request";

vi.mock("@/lib/posts/repository/feed-state", () => ({
  refreshFeedStateRepository: vi.fn(),
}));

function makeRequest(authorization?: string) {
  return new Request("http://localhost/api/internal/feed/state/refresh", {
    headers: authorization ? { authorization } : undefined,
  });
}

describe("GET /api/internal/feed/state/refresh", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  it("returns 401 UNAUTHORIZED when auth header is missing", async () => {
    const response = await GET(makeRequest());
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(401);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("UNAUTHORIZED");
  });

  it("returns stateVersion + refreshedAt on success", async () => {
    vi.mocked(refreshFeedStateRepository).mockResolvedValue({
      stateVersion: "v-2",
      refreshedAt: "2026-01-02T00:00:00.000Z",
      sourceLastActivityAt: "2026-01-02T00:00:00.000Z",
    });

    const response = await GET(makeRequest("Bearer cron-secret"));
    const json = (await response.json()) as {
      ok: boolean;
      data?: { stateVersion: string; refreshedAt: string };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({
      stateVersion: "v-2",
      refreshedAt: "2026-01-02T00:00:00.000Z",
    });
  });

  it("returns 504 timeout code when refresh times out", async () => {
    vi.mocked(refreshFeedStateRepository).mockRejectedValue(
      new ApiRouteTimeoutError("timeout", "TIMEOUT_FEED_STATE_REFRESH"),
    );

    const response = await GET(makeRequest("Bearer cron-secret"));
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(504);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("TIMEOUT_FEED_STATE_REFRESH");
  });

  it("returns 500 INTERNAL_ERROR on unknown failure", async () => {
    vi.mocked(refreshFeedStateRepository).mockRejectedValue(new Error("db down"));

    const response = await GET(makeRequest("Bearer cron-secret"));
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("INTERNAL_ERROR");
  });
});

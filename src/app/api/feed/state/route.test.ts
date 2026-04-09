import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { readFeedStateRepository } from "@/lib/posts/repository/feed-state";
import { ApiRouteTimeoutError } from "@/lib/api/request";

vi.mock("@/lib/posts/repository/feed-state", () => ({
  readFeedStateRepository: vi.fn(),
}));

describe("GET /api/feed/state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns stateVersion + refreshedAt on success", async () => {
    vi.mocked(readFeedStateRepository).mockResolvedValue({
      stateVersion: "v-1",
      refreshedAt: "2026-01-01T00:00:00.000Z",
      sourceLastActivityAt: "2026-01-01T00:00:00.000Z",
    });

    const response = await GET();
    const json = (await response.json()) as {
      ok: boolean;
      data?: { stateVersion: string; refreshedAt: string };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({
      stateVersion: "v-1",
      refreshedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("returns 504 timeout code when state read times out", async () => {
    vi.mocked(readFeedStateRepository).mockRejectedValue(
      new ApiRouteTimeoutError("timeout", "TIMEOUT_STATE"),
    );

    const response = await GET();
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(504);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("TIMEOUT_STATE");
  });

  it("returns 500 INTERNAL_ERROR on unknown failure", async () => {
    vi.mocked(readFeedStateRepository).mockRejectedValue(new Error("db down"));

    const response = await GET();
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("INTERNAL_ERROR");
  });
});

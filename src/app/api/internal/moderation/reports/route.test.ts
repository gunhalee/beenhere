import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { listModerationReportsRepository } from "@/lib/moderation/repository";
import { ApiRouteTimeoutError } from "@/lib/api/request";

vi.mock("@/lib/moderation/repository", () => ({
  listModerationReportsRepository: vi.fn(),
}));

function makeRequest(authorization?: string, query = "") {
  const url =
    query.length > 0
      ? `http://localhost/api/internal/moderation/reports?${query}`
      : "http://localhost/api/internal/moderation/reports";

  return new Request(url, {
    headers: authorization ? { authorization } : undefined,
  });
}

describe("GET /api/internal/moderation/reports", () => {
  const originalModerationSecret = process.env.MODERATION_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MODERATION_SECRET = "moderation-secret";
  });

  afterEach(() => {
    if (originalModerationSecret === undefined) {
      delete process.env.MODERATION_SECRET;
    } else {
      process.env.MODERATION_SECRET = originalModerationSecret;
    }
  });

  it("returns 401 UNAUTHORIZED when auth header is missing", async () => {
    const response = await GET(makeRequest());
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(401);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("UNAUTHORIZED");
  });

  it("parses and clamps limit, then returns items on success", async () => {
    vi.mocked(listModerationReportsRepository).mockResolvedValue([]);

    const response = await GET(
      makeRequest("Bearer moderation-secret", "limit=1000"),
    );
    const json = (await response.json()) as {
      ok: boolean;
      data?: { items: unknown[] };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({ items: [] });
    expect(listModerationReportsRepository).toHaveBeenCalledWith(100);
  });

  it("returns 504 timeout code when list query times out", async () => {
    vi.mocked(listModerationReportsRepository).mockRejectedValue(
      new ApiRouteTimeoutError("timeout", "TIMEOUT_MODERATION_REPORTS"),
    );

    const response = await GET(makeRequest("Bearer moderation-secret"));
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(504);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("TIMEOUT_MODERATION_REPORTS");
  });

  it("returns 500 INTERNAL_ERROR on unknown failure", async () => {
    vi.mocked(listModerationReportsRepository).mockRejectedValue(
      new Error("db down"),
    );

    const response = await GET(makeRequest("Bearer moderation-secret"));
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("INTERNAL_ERROR");
  });
});

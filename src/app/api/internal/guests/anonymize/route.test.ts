import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

describe("GET /api/internal/guests/anonymize", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "test";
    process.env.CRON_SECRET = "";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.CRON_SECRET = originalCronSecret;
  });

  it("returns 401 when unauthorized in production mode", async () => {
    process.env.NODE_ENV = "production";
    process.env.CRON_SECRET = "secret";

    const request = new Request("http://localhost/api/internal/guests/anonymize");
    const response = await GET(request);
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(401);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("UNAUTHORIZED");
  });

  it("returns anonymized count payload", async () => {
    vi.mocked(createSupabaseAdminClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: [{ anonymized_count: 12 }],
        error: null,
      }),
    } as never);

    const request = new Request(
      "http://localhost/api/internal/guests/anonymize?inactiveDays=365&limit=100",
    );
    const response = await GET(request);
    const json = (await response.json()) as {
      ok: boolean;
      data?: {
        inactiveDays: number;
        limit: number;
        anonymizedCount: number;
      };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({
      inactiveDays: 365,
      limit: 100,
      anonymizedCount: 12,
    });
  });
});

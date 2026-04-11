import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  getServerUser: vi.fn(),
}));

describe("POST /api/consents/rate-limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns consent payload in mock mode", async () => {
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(false);

    const response = await POST();
    const json = (await response.json()) as {
      ok: boolean;
      data?: { consent: string; grantedAt: string };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data?.consent).toBe("rate_limit_write_at");
    expect(typeof json.data?.grantedAt).toBe("string");
  });

  it("requires auth when user session is missing", async () => {
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as never);
    vi.mocked(getServerUser).mockResolvedValue(null);

    const response = await POST();
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(401);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("UNAUTHORIZED");
  });
});

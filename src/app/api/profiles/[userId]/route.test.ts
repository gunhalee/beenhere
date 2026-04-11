import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { getPublicProfile } from "@/lib/profiles/service";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: vi.fn(),
}));

vi.mock("@/lib/profiles/service", () => ({
  getPublicProfile: vi.fn(),
}));

describe("GET /api/profiles/:userId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
  });

  it("returns public profile from service", async () => {
    vi.mocked(getPublicProfile).mockResolvedValue({
      id: "user-1",
      nickname: "Tester",
      createdAt: "2026-04-11T00:00:00.000Z",
    });

    const response = await GET(
      new Request("http://localhost/api/profiles/user-1"),
      {
        params: Promise.resolve({ userId: "user-1" }),
      },
    );
    const json = (await response.json()) as {
      ok: boolean;
      data?: { id: string; nickname: string };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({
      id: "user-1",
      nickname: "Tester",
    });
  });

  it("returns 404 when service returns null", async () => {
    vi.mocked(getPublicProfile).mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/profiles/missing"),
      {
        params: Promise.resolve({ userId: "missing" }),
      },
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(404);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("NOT_FOUND");
  });
});

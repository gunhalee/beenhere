import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { getProfileLikesRepository } from "@/lib/profiles/repository";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: vi.fn(),
}));

vi.mock("@/lib/profiles/repository", () => ({
  getProfileLikesRepository: vi.fn(),
}));

describe("GET /api/profiles/:userId/likes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
    vi.mocked(getProfileLikesRepository).mockResolvedValue({
      items: [],
      nextCursor: null,
    });
  });

  it("allows anonymous user to fetch own likes", async () => {
    const response = await GET(
      new Request("http://localhost/api/profiles/guest-1/likes"),
      {
        params: Promise.resolve({ userId: "guest-1" }),
      },
    );
    const json = (await response.json()) as {
      ok: boolean;
      data?: { items: unknown[]; nextCursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(getProfileLikesRepository).toHaveBeenCalledTimes(1);
    expect(getProfileLikesRepository).toHaveBeenCalledWith({
      userId: "guest-1",
      cursor: undefined,
      limit: 20,
      latitude: undefined,
      longitude: undefined,
    });
  });
});

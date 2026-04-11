import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { getProfileLikesList } from "@/lib/profiles/service";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: vi.fn(),
}));

vi.mock("@/lib/profiles/service", () => ({
  getProfileLikesList: vi.fn(),
}));

describe("GET /api/profiles/:userId/likes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
    vi.mocked(getProfileLikesList).mockResolvedValue({
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
    expect(getProfileLikesList).toHaveBeenCalledTimes(1);
    expect(getProfileLikesList).toHaveBeenCalledWith({
      userId: "guest-1",
      cursor: undefined,
      limit: 20,
      latitude: undefined,
      longitude: undefined,
    });
  });
});

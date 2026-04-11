import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { getProfilePostsList } from "@/lib/profiles/service";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: vi.fn(),
}));

vi.mock("@/lib/profiles/service", () => ({
  getProfilePostsList: vi.fn(),
}));

describe("GET /api/profiles/:userId/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
    vi.mocked(getProfilePostsList).mockResolvedValue({
      items: [],
      nextCursor: null,
    });
  });

  it("allows anonymous user to fetch own posts", async () => {
    const response = await GET(
      new Request("http://localhost/api/profiles/guest-1/posts"),
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
    expect(getProfilePostsList).toHaveBeenCalledTimes(1);
    expect(getProfilePostsList).toHaveBeenCalledWith({
      userId: "guest-1",
      cursor: undefined,
      limit: 20,
      latitude: undefined,
      longitude: undefined,
    });
  });
});

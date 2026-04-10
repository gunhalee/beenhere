import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProfileLikesRepository } from "@/lib/profiles/repository";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
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

  it("returns LOGIN_REQUIRED_FOR_ARCHIVE for anonymous user requesting own likes", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "guest-1",
              is_anonymous: true,
            },
          },
        }),
      },
    } as never);

    const response = await GET(
      new Request("http://localhost/api/profiles/guest-1/likes"),
      {
        params: Promise.resolve({ userId: "guest-1" }),
      },
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(403);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("LOGIN_REQUIRED_FOR_ARCHIVE");
    expect(getProfileLikesRepository).not.toHaveBeenCalled();
  });
});

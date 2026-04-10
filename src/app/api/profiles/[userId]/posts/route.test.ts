import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProfilePostsRepository } from "@/lib/profiles/repository";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/profiles/repository", () => ({
  getProfilePostsRepository: vi.fn(),
}));

describe("GET /api/profiles/:userId/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
    vi.mocked(getProfilePostsRepository).mockResolvedValue({
      items: [],
      nextCursor: null,
    });
  });

  it("returns LOGIN_REQUIRED_FOR_ARCHIVE for anonymous user requesting own posts", async () => {
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
      new Request("http://localhost/api/profiles/guest-1/posts"),
      {
        params: Promise.resolve({ userId: "guest-1" }),
      },
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(403);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("LOGIN_REQUIRED_FOR_ARCHIVE");
    expect(getProfilePostsRepository).not.toHaveBeenCalled();
  });
});

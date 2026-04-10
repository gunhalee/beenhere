import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureProfileExistsForUser } from "@/lib/profiles/ensure-profile";
import { mergeGuestIntoMember } from "@/lib/auth/guest-upgrade";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/profiles/ensure-profile", () => ({
  ensureProfileExistsForUser: vi.fn(),
}));

vi.mock("@/lib/auth/guest-upgrade", () => ({
  mergeGuestIntoMember: vi.fn(),
}));

type MockCallbackOptions = {
  exchangeError?: { code?: string; message?: string } | null;
  previousUserId?: string | null;
  previousUserAnonymous?: boolean;
  currentUserId?: string | null;
  currentUserAnonymous?: boolean;
};

function mockCallbackSupabase(options: MockCallbackOptions = {}) {
  const getUser = vi
    .fn()
    .mockResolvedValueOnce({
      data: {
        user:
          options.previousUserId === null
            ? null
            : {
                id: options.previousUserId ?? "guest-1",
                is_anonymous: options.previousUserAnonymous ?? true,
              },
      },
    })
    .mockResolvedValueOnce({
      data: {
        user:
          options.currentUserId === null
            ? null
            : {
                id: options.currentUserId ?? "user-1",
                is_anonymous: options.currentUserAnonymous ?? false,
              },
      },
    });

  const supabase = {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        error: options.exchangeError ?? null,
      }),
      getUser,
    },
  };

  vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase as never);
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
    vi.mocked(ensureProfileExistsForUser).mockResolvedValue({
      created: false,
      nickname: "User",
    });
    vi.mocked(mergeGuestIntoMember).mockResolvedValue({
      ok: true,
      mergedPosts: 1,
      mergedPostLocations: 1,
      mergedLikes: 1,
      mergedBlocks: 0,
      mergedReports: 0,
    });
  });

  it("redirects to profile with failed status when link callback has no code", async () => {
    const request = new Request(
      "http://localhost/auth/callback?intent=link-google&next=%2Fprofile%2Fuser-1",
    );

    const response = await GET(request);
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toBe(
      "http://localhost/profile/user-1?google_link=failed&google_link_reason=missing_code",
    );
  });

  it("redirects to profile with normalized failure reason when link exchange fails", async () => {
    mockCallbackSupabase({
      exchangeError: { code: "oauth_exchange_error" },
    });

    const request = new Request(
      "http://localhost/auth/callback?intent=link-google&next=%2Fprofile%2Fuser-1&code=abc123",
    );

    const response = await GET(request);
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toBe(
      "http://localhost/profile/user-1?google_link=failed&google_link_reason=oauth_exchange_error",
    );
  });

  it("redirects to next path on login callback and appends merged status", async () => {
    mockCallbackSupabase({
      previousUserId: "guest-1",
      previousUserAnonymous: true,
      currentUserId: "member-1",
      currentUserAnonymous: false,
    });

    const request = new Request("http://localhost/auth/callback?code=abc123");

    const response = await GET(request);
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toBe("http://localhost/?upgrade=merged");
    expect(mergeGuestIntoMember).toHaveBeenCalledWith({
      guestUserId: "guest-1",
      memberUserId: "member-1",
    });
  });

  it("redirects with failed upgrade reason when merge fails", async () => {
    mockCallbackSupabase({
      previousUserId: "guest-1",
      previousUserAnonymous: true,
      currentUserId: "member-1",
      currentUserAnonymous: false,
    });
    vi.mocked(mergeGuestIntoMember).mockResolvedValue({
      ok: false,
      error: "merge failed",
      code: "merge_failed",
    });

    const request = new Request("http://localhost/auth/callback?code=abc123");

    const response = await GET(request);
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toBe("http://localhost/?upgrade=failed&upgrade_reason=merge_failed");
  });

  it("redirects to profile with success status when google link callback succeeds", async () => {
    mockCallbackSupabase({
      previousUserId: "user-1",
      previousUserAnonymous: true,
      currentUserId: "user-1",
      currentUserAnonymous: true,
    });

    const request = new Request(
      "http://localhost/auth/callback?intent=link-google&next=%2Fprofile%2Fuser-1&code=abc123",
    );

    const response = await GET(request);
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toBe("http://localhost/profile/user-1?google_link=success");
    expect(mergeGuestIntoMember).not.toHaveBeenCalled();
  });
});

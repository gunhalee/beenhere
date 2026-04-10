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
  signInWithOAuthResult?: {
    data?: { provider?: string; url?: string | null };
    error?: { message?: string } | null;
  };
};

function mockCallbackSupabase(options: MockCallbackOptions = {}) {
  const signInWithOAuth = vi.fn().mockResolvedValue(
    options.signInWithOAuthResult ?? {
      data: { provider: "google", url: "https://accounts.example.com/oauth" },
      error: null,
    },
  );
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
      signInWithOAuth,
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        error: options.exchangeError ?? null,
      }),
      getUser,
    },
  };

  vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase as never);
  return supabase;
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

  it("auto-starts login flow when link callback reports identity_already_exists", async () => {
    const supabase = mockCallbackSupabase();

    const request = new Request(
      "http://localhost/auth/callback?intent=link-google&next=%2Fprofile%2Fguest-1&error_code=identity_already_exists&guest_user_id=11111111-1111-4111-8111-111111111111",
    );

    const response = await GET(request);
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toBe("https://accounts.example.com/oauth");
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: expect.objectContaining({
        skipBrowserRedirect: true,
        redirectTo: expect.stringContaining("intent=login"),
      }),
    });
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: expect.objectContaining({
        redirectTo: expect.stringContaining(
          "guest_user_id=11111111-1111-4111-8111-111111111111",
        ),
      }),
    });
  });

  it("returns auto_switch_failed when auto switch cannot start", async () => {
    mockCallbackSupabase({
      signInWithOAuthResult: {
        data: { provider: "google", url: null },
        error: { message: "switch unavailable" },
      },
    });

    const request = new Request(
      "http://localhost/auth/callback?intent=link-google&next=%2Fprofile%2Fguest-1&error_code=identity_already_exists",
    );

    const response = await GET(request);
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toBe(
      "http://localhost/profile/guest-1?google_link=failed&google_link_reason=auto_switch_failed",
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

  it("merges guest data and switches to member profile during link callback account switch", async () => {
    mockCallbackSupabase({
      previousUserId: "guest-1",
      previousUserAnonymous: true,
      currentUserId: "member-1",
      currentUserAnonymous: false,
    });

    const request = new Request(
      "http://localhost/auth/callback?intent=link-google&next=%2Fprofile%2Fguest-1&code=abc123",
    );

    const response = await GET(request);
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toBe("http://localhost/profile/member-1?upgrade=merged");
    expect(mergeGuestIntoMember).toHaveBeenCalledWith({
      guestUserId: "guest-1",
      memberUserId: "member-1",
    });
  });

  it("uses guest_user_id hint when previous session user is missing", async () => {
    mockCallbackSupabase({
      previousUserId: null,
      currentUserId: "member-1",
      currentUserAnonymous: false,
    });

    const request = new Request(
      "http://localhost/auth/callback?code=abc123&guest_user_id=11111111-1111-4111-8111-111111111111",
    );

    const response = await GET(request);
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toBe("http://localhost/?upgrade=merged");
    expect(mergeGuestIntoMember).toHaveBeenCalledWith({
      guestUserId: "11111111-1111-4111-8111-111111111111",
      memberUserId: "member-1",
    });
  });
});

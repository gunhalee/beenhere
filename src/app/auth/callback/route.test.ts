import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import {
  hasSupabaseBrowserConfig,
  getSupabaseConfig,
} from "@/lib/supabase/config";
import { createServerClient } from "@supabase/ssr";
import { ensureProfileExistsForUser } from "@/lib/profiles/ensure-profile";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: vi.fn(),
  getSupabaseConfig: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}));

vi.mock("@/lib/profiles/ensure-profile", () => ({
  ensureProfileExistsForUser: vi.fn(),
}));

type MockCallbackOptions = {
  exchangeError?: { code?: string; message?: string } | null;
  currentUserId?: string | null;
  currentUserAnonymous?: boolean;
};

function mockCallbackSupabase(options: MockCallbackOptions = {}) {
  const exchangeCodeForSession = vi.fn().mockResolvedValue({
    error: options.exchangeError ?? null,
  });
  const getUser = vi.fn().mockResolvedValue({
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
    auth: { exchangeCodeForSession, getUser },
  };

  vi.mocked(createServerClient).mockReturnValue(supabase as never);
  return supabase;
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
    vi.mocked(getSupabaseConfig).mockReturnValue({
      url: "http://supabase.test",
      anonKey: "test-anon-key",
      serviceRoleKey: null,
    });
    vi.mocked(ensureProfileExistsForUser).mockResolvedValue({
      created: false,
      nickname: "User",
    });
  });

  it("redirects to login with missing_code when callback has no code", async () => {
    const request = new Request("http://localhost/auth/callback");

    const response = await GET(request);
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toBe("http://localhost/auth/login?error=missing_code");
  });

  it("redirects to next path when supabase browser config is disabled", async () => {
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(false);

    const request = new Request(
      "http://localhost/auth/callback?code=abc123&next=%2Fprofile%2Fuser-1",
    );

    const response = await GET(request);
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toBe("http://localhost/profile/user-1");
  });

  it("redirects to login when code exchange fails", async () => {
    mockCallbackSupabase({
      exchangeError: { code: "oauth_exchange_error" },
    });

    const request = new Request(
      "http://localhost/auth/callback?code=abc123",
    );

    const response = await GET(request);
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toBe(
      "http://localhost/auth/login?error=exchange_failed",
    );
  });

  it("redirects to login when exchanged session has no user", async () => {
    mockCallbackSupabase({ currentUserId: null });

    const request = new Request(
      "http://localhost/auth/callback?code=abc123",
    );

    const response = await GET(request);
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toBe("http://localhost/auth/login");
  });

  it("ensures profile and redirects to next path on success", async () => {
    mockCallbackSupabase({
      currentUserId: "member-1",
      currentUserAnonymous: true,
    });

    const request = new Request(
      "http://localhost/auth/callback?code=abc123&next=%2Fprofile%2Fmember-1",
    );

    const response = await GET(request);
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toBe("http://localhost/profile/member-1");
    expect(ensureProfileExistsForUser).toHaveBeenCalledWith(
      expect.any(Object),
      "member-1",
      true,
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

type MockCallbackOptions = {
  exchangeError?: { code?: string; message?: string } | null;
  userId?: string | null;
  profileExists?: boolean;
};

function mockCallbackSupabase(options: MockCallbackOptions = {}) {
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: options.profileExists === false ? null : { id: options.userId ?? "user-1" },
    }),
  };

  const supabase = {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        error: options.exchangeError ?? null,
      }),
      getUser: vi.fn().mockResolvedValue({
        data: {
          user:
            options.userId === null
              ? null
              : {
                  id: options.userId ?? "user-1",
                },
        },
      }),
    },
    from: vi.fn().mockReturnValue(queryBuilder),
  };

  vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase as never);
  return { supabase, queryBuilder };
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
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

  it("redirects to next path on login callback even when profile does not exist", async () => {
    mockCallbackSupabase({
      userId: "user-1",
      profileExists: false,
    });

    const request = new Request("http://localhost/auth/callback?code=abc123");

    const response = await GET(request);
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toBe("http://localhost/");
  });

  it("redirects to profile with success status when google link callback succeeds", async () => {
    mockCallbackSupabase({
      userId: "user-1",
      profileExists: true,
    });

    const request = new Request(
      "http://localhost/auth/callback?intent=link-google&next=%2Fprofile%2Fuser-1&code=abc123",
    );

    const response = await GET(request);
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toBe("http://localhost/profile/user-1?google_link=success");
  });
});

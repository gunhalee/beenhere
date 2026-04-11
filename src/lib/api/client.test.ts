import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchApi } from "./client";
import { redirectToLoginWithNext } from "@/lib/auth/login-redirect";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

vi.mock("@/lib/auth/login-redirect", () => ({
  redirectToLoginWithNext: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: vi.fn(),
}));

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error?: string; code?: string };

function mockJsonResponse<T>(payload: ApiResult<T>) {
  return {
    json: vi.fn().mockResolvedValue(payload),
  };
}

function createMockSupabaseSessionClient(input?: {
  sessionUserId?: string | null;
  refreshUserId?: string | null;
}) {
  const auth = {
    getSession: vi.fn().mockResolvedValue({
      data: {
        session: input?.sessionUserId
          ? {
              user: { id: input.sessionUserId },
              refresh_token: "refresh-token",
            }
          : null,
      },
    }),
    refreshSession: vi.fn().mockResolvedValue({
      data: {
        session: input?.refreshUserId
          ? {
              user: { id: input.refreshUserId },
              refresh_token: "refresh-token-next",
            }
          : null,
      },
      error: input?.refreshUserId ? null : { message: "invalid refresh token" },
    }),
  };

  return { auth };
}

describe("fetchApi unauthorized recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns successful payload without auth recovery", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          data: { value: 1 },
        }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchApi<{ value: number }>("/api/test");

    expect(result).toEqual({ ok: true, data: { value: 1 } });
    expect(getSupabaseBrowserClient).not.toHaveBeenCalled();
    expect(redirectToLoginWithNext).not.toHaveBeenCalled();
  });

  it("recovers browser session and retries once before succeeding", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse({
          ok: false,
          error: "unauthorized",
          code: "UNAUTHORIZED",
        }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          data: { value: 2 },
        }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const supabase = createMockSupabaseSessionClient({
      sessionUserId: "user-1",
      refreshUserId: "user-1",
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(supabase as never);

    const result = await fetchApi<{ value: number }>("/api/test");

    expect(result).toEqual({ ok: true, data: { value: 2 } });
    expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(redirectToLoginWithNext).not.toHaveBeenCalled();
  });

  it("redirects to forced landing when session recovery fails", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse({
          ok: false,
          error: "unauthorized",
          code: "UNAUTHORIZED",
        }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const supabase = createMockSupabaseSessionClient({
      sessionUserId: null,
      refreshUserId: null,
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(supabase as never);

    const result = await fetchApi<{ value: number }>("/api/test");

    expect(result).toEqual({
      ok: false,
      error: "unauthorized",
      code: "UNAUTHORIZED",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(redirectToLoginWithNext).toHaveBeenCalledWith(undefined, {
      forceLanding: true,
    });
  });

  it("redirects when retry is still unauthorized after session recovery", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse({
          ok: false,
          error: "unauthorized-1",
          code: "UNAUTHORIZED",
        }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          ok: false,
          error: "unauthorized-2",
          code: "UNAUTHORIZED",
        }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const supabase = createMockSupabaseSessionClient({
      sessionUserId: "user-1",
      refreshUserId: "user-1",
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(supabase as never);

    const result = await fetchApi<{ value: number }>("/api/test");

    expect(result).toEqual({
      ok: false,
      error: "unauthorized-2",
      code: "UNAUTHORIZED",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(redirectToLoginWithNext).toHaveBeenCalledWith(undefined, {
      forceLanding: true,
    });
  });
});

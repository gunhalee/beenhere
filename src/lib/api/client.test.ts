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
              access_token: "access-token-session",
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
              access_token: "access-token-refresh",
            }
          : null,
      },
      error: input?.refreshUserId ? null : { message: "invalid refresh token" },
    }),
    getUser: vi.fn().mockResolvedValue({
      data: {
        user: input?.refreshUserId
          ? { id: input.refreshUserId }
          : input?.sessionUserId
            ? { id: input.sessionUserId }
            : null,
      },
      error: null,
    }),
  };

  return { auth };
}

describe("fetchApi unauthorized recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(
      createMockSupabaseSessionClient() as never,
    );
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
    expect(getSupabaseBrowserClient).toHaveBeenCalled();
    expect(redirectToLoginWithNext).not.toHaveBeenCalled();
  });

  it("adds Authorization header when browser session exists", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse({
          ok: true,
          data: { value: 9 },
        }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const supabase = createMockSupabaseSessionClient({
      sessionUserId: "user-1",
      refreshUserId: "user-1",
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(supabase as never);

    await fetchApi<{ value: number }>("/api/test");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-token-session",
        }),
      }),
    );
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
    expect(supabase.auth.getSession).toHaveBeenCalled();
    expect(supabase.auth.refreshSession).toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(redirectToLoginWithNext).not.toHaveBeenCalled();
  });

  it("recovers even when getSession is null but refreshSession restores user", async () => {
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
          data: { value: 3 },
        }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const supabase = createMockSupabaseSessionClient({
      sessionUserId: null,
      refreshUserId: "user-1",
    });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(supabase as never);

    const result = await fetchApi<{ value: number }>("/api/test");

    expect(result).toEqual({ ok: true, data: { value: 3 } });
    expect(supabase.auth.getSession).toHaveBeenCalled();
    expect(supabase.auth.refreshSession).toHaveBeenCalled();
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

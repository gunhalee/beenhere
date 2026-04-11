import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchApi } from "./client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

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

function mockBrowserClient(accessToken: string | null) {
  vi.mocked(getSupabaseBrowserClient).mockReturnValue({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: accessToken ? { access_token: accessToken } : null,
        },
      }),
    },
  } as never);
}

describe("fetchApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowserClient(null);
  });

  it("returns successful payload", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse({ ok: true, data: { value: 1 } }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchApi<{ value: number }>("/api/test");

    expect(result).toEqual({ ok: true, data: { value: 1 } });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("sends Authorization header when browser session exists", async () => {
    mockBrowserClient("my-access-token");

    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse({ ok: true, data: { value: 1 } }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    await fetchApi<{ value: number }>("/api/test");

    const callArgs = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(callArgs[1].headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer my-access-token",
      }),
    );
  });

  it("returns unauthorized result without redirecting", async () => {
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

    const result = await fetchApi<{ value: number }>("/api/test");

    expect(result).toEqual({
      ok: false,
      error: "unauthorized",
      code: "UNAUTHORIZED",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("sends Content-Type header and serialized body for POST", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse({ ok: true, data: { id: "1" } }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    await fetchApi<{ id: string }>("/api/test", {
      method: "POST",
      body: { name: "test" },
    });

    const callArgs = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(callArgs[1].headers).toEqual(
      expect.objectContaining({
        "Content-Type": "application/json",
      }),
    );
    expect(callArgs[1].body).toBe(JSON.stringify({ name: "test" }));
  });

  it("returns timeout error when request is aborted", async () => {
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("aborted"), { name: "AbortError" }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchApi<{ value: number }>("/api/test", {
      timeoutMs: 100,
      timeoutErrorMessage: "시간 초과",
      timeoutCode: "CUSTOM_TIMEOUT",
    });

    expect(result).toEqual({
      ok: false,
      error: "시간 초과",
      code: "CUSTOM_TIMEOUT",
    });
  });

  it("returns network error on fetch failure", async () => {
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await fetchApi<{ value: number }>("/api/test");

    expect(result).toEqual({
      ok: false,
      error: "network down",
      code: "NETWORK_ERROR",
    });
  });
});

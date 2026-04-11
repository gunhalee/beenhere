import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchApi } from "./client";

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error?: string; code?: string };

function mockJsonResponse<T>(payload: ApiResult<T>) {
  return {
    json: vi.fn().mockResolvedValue(payload),
  };
}

describe("fetchApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("does not send Authorization header", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse({ ok: true, data: { value: 1 } }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    await fetchApi<{ value: number }>("/api/test");

    const callArgs = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(callArgs[1].headers).toBeUndefined();
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
    expect(callArgs[1].headers).toEqual({
      "Content-Type": "application/json",
    });
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

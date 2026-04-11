import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

function createRequest(body: unknown) {
  return new Request("http://localhost/api/auth/google/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/google/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
  });

  it("returns invalid request when body is malformed json", async () => {
    const request = new Request("http://localhost/api/auth/google/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });

    const response = await POST(request);
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("INVALID_REQUEST");
  });

  it("returns invalid request when intent is not supported", async () => {
    const response = await POST(
      createRequest({ intent: "invalid-intent", nextPath: "/" }),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("INVALID_REQUEST");
  });

  it("starts login flow and returns redirect url", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { provider: "google", url: "https://accounts.example.com/oauth" },
      error: null,
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { signInWithOAuth },
    } as never);

    const response = await POST(
      createRequest({
        intent: "login",
        nextPath: "/profile/user-1",
      }),
    );
    const json = (await response.json()) as {
      ok: boolean;
      data?: { url: string };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data?.url).toBe("https://accounts.example.com/oauth");
    expect(signInWithOAuth).toHaveBeenCalledTimes(1);
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: expect.objectContaining({
        skipBrowserRedirect: true,
      }),
    });
  });

  it("returns INVALID_REQUEST when oauth starter fails", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { provider: "google", url: null },
      error: { message: "oauth disabled" },
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { signInWithOAuth },
    } as never);

    const response = await POST(
      createRequest({
        intent: "login",
        nextPath: "/profile/user-1",
      }),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("INVALID_REQUEST");
  });
});

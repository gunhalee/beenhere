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
    const linkIdentity = vi.fn();
    const getUser = vi.fn();

    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { signInWithOAuth, linkIdentity, getUser },
    } as never);

    const response = await POST(
      createRequest({
        intent: "login",
        nextPath: "/profile/user-1",
        guestUserId: "11111111-1111-4111-8111-111111111111",
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
        redirectTo: expect.stringContaining(
          "guest_user_id=11111111-1111-4111-8111-111111111111",
        ),
      }),
    });
    expect(linkIdentity).not.toHaveBeenCalled();
  });

  it("returns unauthorized for link flow without authenticated user", async () => {
    const signInWithOAuth = vi.fn();
    const linkIdentity = vi.fn();
    const getUser = vi.fn().mockResolvedValue({
      data: { user: null },
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { signInWithOAuth, linkIdentity, getUser },
    } as never);

    const response = await POST(
      createRequest({ intent: "link-google", nextPath: "/profile/user-1" }),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(401);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("UNAUTHORIZED");
    expect(linkIdentity).not.toHaveBeenCalled();
  });

  it("starts link flow and returns redirect url", async () => {
    const signInWithOAuth = vi.fn();
    const linkIdentity = vi.fn().mockResolvedValue({
      data: { provider: "google", url: "https://accounts.example.com/link" },
      error: null,
    });
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "guest-1" } },
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { signInWithOAuth, linkIdentity, getUser },
    } as never);

    const response = await POST(
      createRequest({ intent: "link-google", nextPath: "/profile/guest-1" }),
    );
    const json = (await response.json()) as {
      ok: boolean;
      data?: { url: string };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data?.url).toBe("https://accounts.example.com/link");
    expect(linkIdentity).toHaveBeenCalledTimes(1);
    expect(linkIdentity).toHaveBeenCalledWith({
      provider: "google",
      options: expect.objectContaining({
        skipBrowserRedirect: true,
      }),
    });
    expect(signInWithOAuth).not.toHaveBeenCalled();
  });

  it("returns INVALID_REQUEST when linkIdentity fails", async () => {
    const signInWithOAuth = vi.fn();
    const linkIdentity = vi.fn().mockResolvedValue({
      data: { provider: "google", url: null },
      error: { message: "Manual linking is disabled" },
    });
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "guest-1" } },
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { signInWithOAuth, linkIdentity, getUser },
    } as never);

    const response = await POST(
      createRequest({ intent: "link-google", nextPath: "/profile/guest-1" }),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("INVALID_REQUEST");
    expect(linkIdentity).toHaveBeenCalledTimes(1);
    expect(signInWithOAuth).not.toHaveBeenCalled();
  });
});

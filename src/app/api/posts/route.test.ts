import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPost } from "@/lib/posts/mutations";
import { ensureProfileExistsForUser } from "@/lib/profiles/ensure-profile";
import { consumeAnonymousWriteQuota } from "@/lib/auth/anonymous-write-quota";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/posts/mutations", () => ({
  createPost: vi.fn(),
}));

vi.mock("@/lib/profiles/ensure-profile", () => ({
  ensureProfileExistsForUser: vi.fn(),
}));

vi.mock("@/lib/auth/anonymous-write-quota", () => ({
  consumeAnonymousWriteQuota: vi.fn(),
}));

function makeJsonRequest(body: unknown) {
  return new Request("http://localhost/api/posts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(false);
    vi.mocked(ensureProfileExistsForUser).mockResolvedValue({
      created: false,
      nickname: "Guest",
    });
    vi.mocked(consumeAnonymousWriteQuota).mockResolvedValue({
      allowed: true,
      remaining: 999,
      resetAt: null,
    });
  });

  it("returns 400 for invalid clientRequestId format", async () => {
    const response = await POST(
      makeJsonRequest({
        content: "hello",
        latitude: 37.5,
        longitude: 127.0,
        placeLabel: "Gangnam-gu",
        clientRequestId: "bad",
      }),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("VALIDATION_ERROR");
    expect(createPost).not.toHaveBeenCalled();
  });

  it("passes clientRequestId through to domain mutation", async () => {
    vi.mocked(createPost).mockResolvedValue({
      ok: true,
      postId: "post-1",
    });

    const response = await POST(
      makeJsonRequest({
        content: "hello",
        latitude: 37.5,
        longitude: 127.0,
        placeLabel: "Gangnam-gu",
        clientRequestId: "req_20260409_0001",
      }),
    );
    const json = (await response.json()) as {
      ok: boolean;
      data?: { postId: string };
    };

    expect(response.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({ postId: "post-1" });
    expect(createPost).toHaveBeenCalledWith({
      content: "hello",
      latitude: 37.5,
      longitude: 127,
      placeLabel: "Gangnam-gu",
      clientRequestId: "req_20260409_0001",
    });
  });

  it("returns 401 when auth is required and user is missing", async () => {
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never);

    const response = await POST(
      makeJsonRequest({
        content: "hello",
        latitude: 37.5,
        longitude: 127.0,
        placeLabel: "Gangnam-gu",
      }),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(401);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("UNAUTHORIZED");
    expect(createPost).not.toHaveBeenCalled();
  });
});

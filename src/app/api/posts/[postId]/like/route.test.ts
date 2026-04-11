import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, POST } from "./route";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { likePost, unlikePost } from "@/lib/posts/mutations";
import { ensureProfileExistsForUser } from "@/lib/profiles/ensure-profile";
import { consumeAnonymousWriteQuota } from "@/lib/auth/anonymous-write-quota";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  getServerUser: vi.fn(),
}));

vi.mock("@/lib/posts/mutations", () => ({
  likePost: vi.fn(),
  unlikePost: vi.fn(),
}));

vi.mock("@/lib/profiles/ensure-profile", () => ({
  ensureProfileExistsForUser: vi.fn(),
}));

vi.mock("@/lib/auth/anonymous-write-quota", () => ({
  consumeAnonymousWriteQuota: vi.fn(),
}));

function makeContext(postId = "post-1") {
  return {
    params: Promise.resolve({ postId }),
  };
}

function makeJsonRequest(body: unknown) {
  return new Request("http://localhost/api/posts/post-1/like", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/posts/[postId]/like", () => {
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

  it("returns 400 when coordinates are invalid", async () => {
    const response = await POST(
      makeJsonRequest({
        latitude: null,
        longitude: 127,
        placeLabel: "Gangnam-gu",
      }),
      makeContext(),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("INVALID_LOCATION");
    expect(likePost).not.toHaveBeenCalled();
  });

  it("returns 400 when placeLabel is missing", async () => {
    const response = await POST(
      makeJsonRequest({
        latitude: 37.5,
        longitude: 127.0,
        placeLabel: " ",
      }),
      makeContext(),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("VALIDATION_ERROR");
    expect(likePost).not.toHaveBeenCalled();
  });

  it("returns 401 when auth is required and user is missing", async () => {
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never);
    vi.mocked(getServerUser).mockResolvedValue(null);

    const response = await POST(
      makeJsonRequest({
        latitude: 37.5,
        longitude: 127.0,
        placeLabel: "Gangnam-gu",
      }),
      makeContext(),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(401);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("UNAUTHORIZED");
    expect(likePost).not.toHaveBeenCalled();
  });

  it("propagates domain failure status/code from likePost", async () => {
    vi.mocked(likePost).mockResolvedValue({
      ok: false,
      code: "ALREADY_LIKED",
      message: "already liked",
      status: 409,
    });

    const response = await POST(
      makeJsonRequest({
        latitude: 37.5,
        longitude: 127.0,
        placeLabel: "Gangnam-gu",
      }),
      makeContext("post-9"),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(409);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("ALREADY_LIKED");
    expect(likePost).toHaveBeenCalledWith({
      postId: "post-9",
      latitude: 37.5,
      longitude: 127,
      placeLabel: "Gangnam-gu",
    });
  });

  it("returns likeCount on success", async () => {
    vi.mocked(likePost).mockResolvedValue({
      ok: true,
      likeCount: 7,
    });

    const response = await POST(
      makeJsonRequest({
        latitude: 37.5,
        longitude: 127.0,
        placeLabel: "Gangnam-gu",
      }),
      makeContext(),
    );
    const json = (await response.json()) as {
      ok: boolean;
      data?: { likeCount: number };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({ likeCount: 7 });
  });

  it("returns structured internal error when auth preflight throws", async () => {
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "guest-1",
              is_anonymous: true,
            },
          },
        }),
      },
      rpc: vi.fn().mockResolvedValue({ error: null }),
    } as never);
    vi.mocked(getServerUser).mockResolvedValue({ id: "guest-1", is_anonymous: true } as any);
    vi.mocked(ensureProfileExistsForUser).mockRejectedValue(new Error("preflight failed"));

    const response = await POST(
      makeJsonRequest({
        latitude: 37.5,
        longitude: 127.0,
        placeLabel: "Gangnam-gu",
      }),
      makeContext(),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("INTERNAL_ERROR");
    expect(likePost).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/posts/[postId]/like", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(false);
  });

  it("returns 401 when auth is required and user is missing", async () => {
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never);
    vi.mocked(getServerUser).mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/posts/post-1/like", {
        method: "DELETE",
      }),
      makeContext(),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(401);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("UNAUTHORIZED");
    expect(unlikePost).not.toHaveBeenCalled();
  });

  it("returns likeCount on success", async () => {
    vi.mocked(unlikePost).mockResolvedValue({
      ok: true,
      likeCount: 3,
    });

    const response = await DELETE(
      new Request("http://localhost/api/posts/post-1/like", {
        method: "DELETE",
      }),
      makeContext("post-9"),
    );
    const json = (await response.json()) as {
      ok: boolean;
      data?: { likeCount: number };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({ likeCount: 3 });
    expect(unlikePost).toHaveBeenCalledWith("post-9");
  });
});

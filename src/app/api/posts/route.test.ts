import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { createPost } from "@/lib/posts/mutations";
import { runWritePreflight } from "@/lib/auth/write-preflight";
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
  createPost: vi.fn(),
}));

vi.mock("@/lib/auth/write-preflight", () => ({
  runWritePreflight: vi.fn(),
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
    vi.mocked(runWritePreflight).mockResolvedValue({
      ok: true,
      user: { id: "user-1" },
      isAnonymous: false,
      supabase: {} as never,
    });
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
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
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
    vi.mocked(runWritePreflight).mockResolvedValue({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "로그인이 필요해요.",
    });

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

  it("returns rate-limit metadata including consent flag for anonymous users", async () => {
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
    vi.mocked(runWritePreflight).mockResolvedValue({
      ok: false,
      status: 429,
      code: "RATE_LIMITED",
      message: "게스트 계정의 쓰기 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
      details: {
        limit: 10,
        windowSeconds: 60,
        consentRequired: true,
      },
    });

    const response = await POST(
      makeJsonRequest({
        content: "hello",
        latitude: 37.5,
        longitude: 127.0,
        placeLabel: "Gangnam-gu",
      }),
    );
    const json = (await response.json()) as {
      ok: boolean;
      code?: string;
      details?: {
        limit?: number;
        windowSeconds?: number;
        consentRequired?: boolean;
      };
    };

    expect(response.status).toBe(429);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("RATE_LIMITED");
    expect(json.details?.limit).toBe(10);
    expect(json.details?.windowSeconds).toBe(60);
    expect(json.details?.consentRequired).toBe(true);
    expect(createPost).not.toHaveBeenCalled();
  });

  it("returns structured internal error when auth preflight throws", async () => {
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
    vi.mocked(runWritePreflight).mockResolvedValue({
      ok: false,
      status: 500,
      code: "INTERNAL_ERROR",
      message: "요청 검증 중 오류가 발생했어요.",
    });

    const response = await POST(
      makeJsonRequest({
        content: "hello",
        latitude: 37.5,
        longitude: 127.0,
        placeLabel: "Gangnam-gu",
      }),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("INTERNAL_ERROR");
    expect(createPost).not.toHaveBeenCalled();
  });
});

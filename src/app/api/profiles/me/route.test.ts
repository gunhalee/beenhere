import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMyProfileRepository } from "@/lib/profiles/repository";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/profiles/repository", () => ({
  getMyProfileRepository: vi.fn(),
  regenerateNicknameRepository: vi.fn(),
}));

function makeJsonRequest(body: unknown) {
  return new Request("http://localhost/api/profiles/me", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeInvalidJsonRequest() {
  return new Request("http://localhost/api/profiles/me", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
}

function mockSupabasePost(options?: {
  userId?: string | null;
  userError?: unknown;
  existing?: { id: string } | null;
  insertError?: { code?: string; message?: string; details?: string; hint?: string } | null;
}) {
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: options?.existing ?? null, error: null }),
    insert: vi.fn().mockResolvedValue({ error: options?.insertError ?? null }),
  };

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: options?.userId === undefined ? { id: "user-1" } : options.userId ? { id: options.userId } : null,
        },
        error: options?.userError ?? null,
      }),
    },
    from: vi.fn().mockReturnValue(queryBuilder),
  };

  vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase as never);
  return { supabase, queryBuilder };
}

describe("GET /api/profiles/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
  });

  it("returns account linking flags for authenticated user", async () => {
    vi.mocked(getMyProfileRepository).mockResolvedValue({
      id: "user-1",
      nickname: "Tester",
      nicknameChangedAt: null,
      createdAt: "2026-04-09T00:00:00.000Z",
      profileCreated: true,
      isAnonymous: true,
    });

    const response = await GET();
    const json = (await response.json()) as {
      ok: boolean;
      data?: {
        id: string;
        nickname: string;
        profileCreated: boolean;
        isAnonymous: boolean;
      };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toMatchObject({
      id: "user-1",
      nickname: "Tester",
      profileCreated: true,
      isAnonymous: true,
    });
  });

  it("returns INTERNAL_ERROR when repository throws", async () => {
    vi.mocked(getMyProfileRepository).mockRejectedValue(new Error("db read failed"));

    const response = await GET();
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("INTERNAL_ERROR");
  });
});

describe("POST /api/profiles/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
  });

  it("returns INVALID_REQUEST for malformed JSON", async () => {
    const response = await POST(makeInvalidJsonRequest());
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("INVALID_REQUEST");
  });

  it("returns VALIDATION_ERROR for invalid nickname length", async () => {
    const response = await POST(makeJsonRequest({ nickname: "a" }));
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("returns UNAUTHORIZED when user session is missing", async () => {
    mockSupabasePost({ userId: null });

    const response = await POST(makeJsonRequest({ nickname: "tester" }));
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(401);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("UNAUTHORIZED");
  });

  it("returns PROFILE_ALREADY_EXISTS when insert conflicts on profile id", async () => {
    mockSupabasePost({
      insertError: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "profiles_pkey"',
      },
    });

    const response = await POST(makeJsonRequest({ nickname: "tester" }));
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(409);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("PROFILE_ALREADY_EXISTS");
  });

  it("returns NICKNAME_TAKEN for nickname unique constraint conflict", async () => {
    mockSupabasePost({
      insertError: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "profiles_nickname_key"',
      },
    });

    const response = await POST(makeJsonRequest({ nickname: "tester" }));
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(409);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("NICKNAME_TAKEN");
  });

  it("falls back to PROFILE_ALREADY_EXISTS when unique violation is ambiguous", async () => {
    const { queryBuilder } = mockSupabasePost({
      existing: { id: "user-1" },
      insertError: { code: "23505" },
    });

    const response = await POST(makeJsonRequest({ nickname: "tester" }));
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(409);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("PROFILE_ALREADY_EXISTS");
    expect(queryBuilder.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("creates profile and returns display nickname on success", async () => {
    const { queryBuilder } = mockSupabasePost();

    const response = await POST(makeJsonRequest({ nickname: "  tester  " }));
    const json = (await response.json()) as {
      ok: boolean;
      data?: { nickname: string };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data?.nickname).toBe("Tester");
    expect(queryBuilder.insert).toHaveBeenCalledWith({
      id: "user-1",
      nickname: "tester",
    });
  });
});

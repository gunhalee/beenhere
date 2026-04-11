import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseServerClient, getServerUser } from "./server";
import { cookies, headers } from "next/headers";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("./config", () => ({
  getSupabaseConfig: vi.fn(() => ({
    url: "https://example.supabase.co",
    anonKey: "anon-key",
    serviceRoleKey: "service-role-key",
  })),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url: string, _anonKey: string, _options: unknown) => ({
    auth: {
      getUser: vi.fn(),
    },
  })),
}));

describe("getServerUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cookies).mockResolvedValue({
      getAll: vi.fn().mockReturnValue([]),
      set: vi.fn(),
    } as never);
  });

  it("prefers Authorization header over cookie session", async () => {
    vi.mocked(headers).mockResolvedValue({
      get: vi.fn().mockReturnValue("Bearer access-token"),
    } as never);

    const supabase = (await createSupabaseServerClient()) as {
      auth: { getUser: ReturnType<typeof vi.fn> };
    };

    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const user = await getServerUser(supabase as never);

    expect(user).toMatchObject({ id: "user-1" });
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
    expect(supabase.auth.getUser).toHaveBeenCalledWith("access-token");
  });

  it("falls back to cookie session when Authorization header is absent", async () => {
    vi.mocked(headers).mockResolvedValue({
      get: vi.fn().mockReturnValue(null),
    } as never);

    const supabase = (await createSupabaseServerClient()) as {
      auth: { getUser: ReturnType<typeof vi.fn> };
    };

    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-2" } },
      error: null,
    });

    const user = await getServerUser(supabase as never);

    expect(user).toMatchObject({ id: "user-2" });
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
    expect(supabase.auth.getUser).toHaveBeenCalledWith();
  });
});

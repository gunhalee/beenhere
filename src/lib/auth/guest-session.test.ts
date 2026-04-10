import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearMyProfileCache, clearProfileCache } from "@/lib/api/profile-client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureGuestSession } from "./guest-session";

vi.mock("@/lib/api/profile-client", () => ({
  clearMyProfileCache: vi.fn(),
  clearProfileCache: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: vi.fn(),
}));

function createMockSupabase() {
  return {
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
      signInAnonymously: vi.fn(),
    },
    rpc: vi.fn(),
  };
}

describe("ensureGuestSession guest activity touch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("touches guest activity when current anonymous session exists", async () => {
    const supabase = createMockSupabase();
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          refresh_token: "refresh-token-current",
          user: { id: "guest-current", is_anonymous: true },
        },
      },
    });
    supabase.rpc.mockResolvedValue({ error: null });

    vi.mocked(getSupabaseBrowserClient).mockReturnValue(supabase as never);

    const result = await ensureGuestSession();

    expect(result).toEqual({ ok: true, userId: "guest-current", restored: false });
    expect(supabase.rpc).toHaveBeenCalledWith("touch_profile_activity", {
      p_user_id: "guest-current",
      p_is_anonymous: true,
    });
  });

  it("touches guest activity when guest session is restored by refresh token", async () => {
    const supabase = createMockSupabase();
    window.localStorage.setItem("beenhere.guest_refresh_token", "stored-refresh-token");

    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
    });
    supabase.auth.refreshSession.mockResolvedValue({
      error: null,
      data: {
        session: {
          refresh_token: "refresh-token-restored",
          user: { id: "guest-restored", is_anonymous: true },
        },
      },
    });
    supabase.rpc.mockResolvedValue({ error: null });

    vi.mocked(getSupabaseBrowserClient).mockReturnValue(supabase as never);

    const result = await ensureGuestSession();

    expect(result).toEqual({ ok: true, userId: "guest-restored", restored: true });
    expect(clearMyProfileCache).toHaveBeenCalledTimes(1);
    expect(clearProfileCache).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("touch_profile_activity", {
      p_user_id: "guest-restored",
      p_is_anonymous: true,
    });
  });

  it("does not fail guest login flow even when activity touch rpc errors", async () => {
    const supabase = createMockSupabase();
    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
    });
    supabase.auth.refreshSession.mockResolvedValue({
      error: { message: "invalid refresh token" },
      data: { session: null },
    });
    supabase.auth.signInAnonymously.mockResolvedValue({
      error: null,
      data: {
        session: {
          refresh_token: "refresh-token-new",
          user: { id: "guest-new", is_anonymous: true },
        },
      },
    });
    supabase.rpc.mockResolvedValue({
      error: { code: "XX999", message: "rpc unavailable" },
    });

    vi.mocked(getSupabaseBrowserClient).mockReturnValue(supabase as never);

    const result = await ensureGuestSession();

    expect(result).toEqual({ ok: true, userId: "guest-new", restored: false });
    expect(supabase.rpc).toHaveBeenCalledWith("touch_profile_activity", {
      p_user_id: "guest-new",
      p_is_anonymous: true,
    });
  });
});

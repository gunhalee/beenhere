import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import {
  getSupabaseConfig,
  hasSupabaseBrowserConfig,
} from "@/lib/supabase/config";
import { createServerClient } from "@supabase/ssr";
import { createRouteCookieBridge } from "@/lib/supabase/route-cookie-bridge";

vi.mock("@/lib/supabase/config", () => ({
  getSupabaseConfig: vi.fn(),
  hasSupabaseBrowserConfig: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/route-cookie-bridge", () => ({
  createRouteCookieBridge: vi.fn(),
}));

describe("auth logout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
    vi.mocked(getSupabaseConfig).mockReturnValue({
      url: "http://supabase.test",
      anonKey: "anon-key",
      serviceRoleKey: null,
    });
  });

  it("GET redirects to login without signing out", async () => {
    const response = await GET(new Request("http://localhost/auth/logout"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/auth/login");
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("POST signs out and applies cookie bridge when supabase is enabled", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createServerClient).mockReturnValue({
      auth: { signOut },
    } as never);

    const bridge = {
      getAll: vi.fn().mockReturnValue([]),
      setAll: vi.fn(),
      applyToResponse: vi.fn((response: Response) => response),
    };
    vi.mocked(createRouteCookieBridge).mockResolvedValue(bridge as never);

    const response = await POST(new Request("http://localhost/auth/logout"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/auth/login");
    expect(createServerClient).toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(bridge.applyToResponse).toHaveBeenCalled();
  });

  it("POST redirects without supabase signout when browser config is disabled", async () => {
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(false);

    const response = await POST(new Request("http://localhost/auth/logout"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/auth/login");
    expect(createServerClient).not.toHaveBeenCalled();
    expect(createRouteCookieBridge).not.toHaveBeenCalled();
  });
});

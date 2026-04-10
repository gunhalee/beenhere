import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMyProfileRepository } from "./repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { touchProfileActivity } from "@/lib/auth/profile-activity";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/auth/profile-activity", () => ({
  touchProfileActivity: vi.fn(),
}));

function createProfileRowQuery(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
}

describe("profiles repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns my profile even when touch_profile_activity fails", async () => {
    const profileQuery = createProfileRowQuery({
      id: "user-1",
      nickname: "tester",
      nickname_changed_at: null,
      created_at: "2026-04-10T00:00:00.000Z",
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              is_anonymous: false,
              identities: [{ provider: "google" }],
              app_metadata: { provider: "google", providers: ["google"] },
            },
          },
        }),
      },
      from: vi.fn().mockReturnValue(profileQuery),
    } as never);

    vi.mocked(touchProfileActivity).mockRejectedValue(new Error("rpc down"));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await getMyProfileRepository();

    expect(result).toMatchObject({
      id: "user-1",
      nickname: "Tester",
      profileCreated: true,
      googleLinked: true,
      canLinkGoogle: false,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("returns null when profile row is missing", async () => {
    const profileQuery = createProfileRowQuery(null, { code: "PGRST116" });

    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-2",
              is_anonymous: true,
              identities: [],
              app_metadata: { providers: [] },
            },
          },
        }),
      },
      from: vi.fn().mockReturnValue(profileQuery),
    } as never);
    vi.mocked(touchProfileActivity).mockResolvedValue(undefined);

    const result = await getMyProfileRepository();

    expect(result).toBeNull();
  });
});

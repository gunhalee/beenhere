import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMyProfileRepository, getProfileLikesRepository } from "./repository";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { touchProfileActivity } from "@/lib/auth/profile-activity";
import { ensureProfileExistsForUser } from "@/lib/profiles/ensure-profile";
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  getServerUser: vi.fn(),
}));

vi.mock("@/lib/auth/profile-activity", () => ({
  touchProfileActivity: vi.fn(),
}));

vi.mock("@/lib/profiles/ensure-profile", () => ({
  ensureProfileExistsForUser: vi.fn(),
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

    vi.mocked(getServerUser).mockResolvedValue({
      id: "user-1",
      is_anonymous: false,
    } as never);

    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      from: vi.fn().mockReturnValue(profileQuery),
    } as never);

    vi.mocked(touchProfileActivity).mockRejectedValue(new Error("rpc down"));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await getMyProfileRepository();

    expect(result).toMatchObject({
      id: "user-1",
      nickname: "Tester",
      profileCreated: true,
      isAnonymous: false,
    });
    expect(ensureProfileExistsForUser).not.toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("auto-creates missing profile row and returns my profile", async () => {
    const profileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } })
        .mockResolvedValueOnce({
          data: {
            id: "user-2",
            nickname: "guest_user",
            nickname_changed_at: null,
            created_at: "2026-04-11T00:00:00.000Z",
          },
          error: null,
        }),
    };

    vi.mocked(getServerUser).mockResolvedValue({
      id: "user-2",
      is_anonymous: true,
    } as never);

    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      from: vi.fn().mockReturnValue(profileQuery),
    } as never);
    vi.mocked(touchProfileActivity).mockResolvedValue(undefined);
    vi.mocked(ensureProfileExistsForUser).mockResolvedValue({
      created: true,
      nickname: "Guest_User",
    });

    const result = await getMyProfileRepository();

    expect(result).toMatchObject({
      id: "user-2",
      nickname: "Guest User",
      profileCreated: true,
      isAnonymous: true,
    });
    expect(ensureProfileExistsForUser).toHaveBeenCalledWith(
      expect.anything(),
      "user-2",
      true,
    );
  });

  it("returns null when getServerUser returns null", async () => {
    vi.mocked(getServerUser).mockResolvedValue(null);
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      from: vi.fn(),
    } as never);

    const result = await getMyProfileRepository();

    expect(result).toBeNull();
  });

  it("maps post metadata separately from like metadata in liked posts", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          post_id: "post-1",
          content: "hello",
          author_id: "author-1",
          author_nickname: "writer",
          place_label: "Mapo-gu",
          distance_meters: 1234,
          last_activity_at: "2026-04-01T00:00:00.000Z",
          like_id: "like-1",
          like_created_at: "2026-04-02T00:00:00.000Z",
          like_place_label: "Gangnam-gu",
          like_distance_meters: 222,
          like_count: 7,
          my_like: true,
        },
      ],
      error: null,
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      rpc,
    } as never);

    const result = await getProfileLikesRepository({
      userId: "user-1",
      limit: 20,
    });

    expect(rpc).toHaveBeenCalledWith(
      "get_profile_likes",
      expect.objectContaining({
        target_user_id: "user-1",
      }),
    );

    expect(result.items[0]).toMatchObject({
      postId: "post-1",
      placeLabel: "Mapo-gu",
      distanceMeters: 1234,
      likePlaceLabel: "Gangnam-gu",
      likeDistanceMeters: 222,
      likeCount: 7,
      myLike: true,
    });
    expect(typeof result.items[0]?.relativeTime).toBe("string");
    expect(typeof result.items[0]?.likeRelativeTime).toBe("string");
  });
});

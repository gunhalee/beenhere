import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readFeedStateRepository,
  refreshFeedStateRepository,
} from "./feed-state";
import {
  hasSupabaseBrowserConfig,
  hasSupabaseServerConfig,
} from "@/lib/supabase/config";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: vi.fn(),
  hasSupabaseServerConfig: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
}));

function createPostActivityQueryMock(lastActivityAt: string | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi
      .fn()
      .mockResolvedValue({
        data: lastActivityAt ? [{ last_activity_at: lastActivityAt }] : [],
        error: null,
      }),
  };
}

describe("feed-state repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
    vi.mocked(hasSupabaseServerConfig).mockReturnValue(true);
  });

  it("returns mock state when browser config is missing", async () => {
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(false);

    const result = await readFeedStateRepository();

    expect(result.stateVersion).toBe("mock-static");
    expect(result.sourceLastActivityAt).toBeNull();
  });

  it("returns rpc result on read success", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            version: 7,
            source_last_activity_at: "2026-04-09T00:00:00.000Z",
            refreshed_at: "2026-04-09T00:00:05.000Z",
          },
        ],
        error: null,
      }),
    } as never);

    const result = await readFeedStateRepository();

    expect(result).toEqual({
      stateVersion: "7",
      sourceLastActivityAt: "2026-04-09T00:00:00.000Z",
      refreshedAt: "2026-04-09T00:00:05.000Z",
    });
  });

  it("falls back to legacy read when get_feed_state rpc is missing", async () => {
    const fallbackQuery = createPostActivityQueryMock("2026-04-10T00:00:00.000Z");
    const serverClient = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "PGRST202",
          message: "Could not find the function public.get_feed_state()",
        },
      }),
      from: vi.fn().mockReturnValue(fallbackQuery),
    };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(serverClient as never);

    const result = await readFeedStateRepository();

    expect(result.stateVersion).toBe("legacy:2026-04-10T00:00:00.000Z");
    expect(result.sourceLastActivityAt).toBe("2026-04-10T00:00:00.000Z");
    expect(serverClient.from).toHaveBeenCalledWith("posts");
  });

  it("returns mock-static when compatibility fallback also fails", async () => {
    const failingQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "42501", message: "permission denied for table posts" },
      }),
    };
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "42883",
          message: "function get_feed_state() does not exist",
        },
      }),
      from: vi.fn().mockReturnValue(failingQuery),
    } as never);

    const result = await readFeedStateRepository();

    expect(result.stateVersion).toBe("mock-static");
    expect(result.sourceLastActivityAt).toBeNull();
  });

  it("throws on non-compatibility rpc read error", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "XX000", message: "unexpected internal error" },
      }),
    } as never);

    await expect(readFeedStateRepository()).rejects.toMatchObject({
      code: "XX000",
    });
  });

  it("falls back to legacy refresh read when refresh rpc is missing", async () => {
    const fallbackQuery = createPostActivityQueryMock("2026-04-11T00:00:00.000Z");
    const adminClient = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "42883",
          message: 'function refresh_feed_state() does not exist',
        },
      }),
      from: vi.fn().mockReturnValue(fallbackQuery),
    };
    vi.mocked(createSupabaseAdminClient).mockResolvedValue(adminClient as never);

    const result = await refreshFeedStateRepository();

    expect(result.stateVersion).toBe("legacy:2026-04-11T00:00:00.000Z");
    expect(result.sourceLastActivityAt).toBe("2026-04-11T00:00:00.000Z");
    expect(adminClient.from).toHaveBeenCalledWith("posts");
  });
});

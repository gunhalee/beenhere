import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearFeedStateReadCache,
  readFeedStateCachedRepository,
  readFeedStateRepository,
  refreshFeedStateBestEffort,
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

describe("feed-state repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFeedStateReadCache();
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

  it("throws when get_feed_state rpc fails", async () => {
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

  it("deduplicates in-flight cached read requests", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          version: 9,
          source_last_activity_at: "2026-04-09T00:00:00.000Z",
          refreshed_at: "2026-04-09T00:00:05.000Z",
        },
      ],
      error: null,
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      rpc,
    } as never);

    const [first, second] = await Promise.all([
      readFeedStateCachedRepository(),
      readFeedStateCachedRepository(),
    ]);

    expect(first.stateVersion).toBe("9");
    expect(second.stateVersion).toBe("9");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("bypasses cache when force option is enabled", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            version: 1,
            source_last_activity_at: "2026-04-09T00:00:00.000Z",
            refreshed_at: "2026-04-09T00:00:05.000Z",
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            version: 2,
            source_last_activity_at: "2026-04-10T00:00:00.000Z",
            refreshed_at: "2026-04-10T00:00:05.000Z",
          },
        ],
        error: null,
      });

    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      rpc,
    } as never);

    const initial = await readFeedStateCachedRepository();
    const forced = await readFeedStateCachedRepository({ force: true });

    expect(initial.stateVersion).toBe("1");
    expect(forced.stateVersion).toBe("2");
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("returns rpc result on refresh success", async () => {
    vi.mocked(createSupabaseAdminClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            version: 21,
            source_last_activity_at: "2026-04-11T00:00:00.000Z",
            refreshed_at: "2026-04-11T00:00:05.000Z",
          },
        ],
        error: null,
      }),
    } as never);

    const result = await refreshFeedStateRepository();

    expect(result).toEqual({
      stateVersion: "21",
      sourceLastActivityAt: "2026-04-11T00:00:00.000Z",
      refreshedAt: "2026-04-11T00:00:05.000Z",
    });
  });

  it("throws when refresh_feed_state rpc fails", async () => {
    vi.mocked(createSupabaseAdminClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "XX001", message: "refresh failed" },
      }),
    } as never);

    await expect(refreshFeedStateRepository()).rejects.toMatchObject({
      code: "XX001",
    });
  });

  it("deduplicates concurrent best-effort refresh calls", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          version: 11,
          source_last_activity_at: "2026-04-12T00:00:00.000Z",
          refreshed_at: "2026-04-12T00:00:05.000Z",
        },
      ],
      error: null,
    });

    vi.mocked(createSupabaseAdminClient).mockResolvedValue({
      rpc,
    } as never);

    await Promise.all([
      refreshFeedStateBestEffort("create_post"),
      refreshFeedStateBestEffort("like_post"),
    ]);

    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("throttles repeated best-effort refresh calls in cooldown window", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          version: 12,
          source_last_activity_at: "2026-04-13T00:00:00.000Z",
          refreshed_at: "2026-04-13T00:00:05.000Z",
        },
      ],
      error: null,
    });

    vi.mocked(createSupabaseAdminClient).mockResolvedValue({
      rpc,
    } as never);

    await refreshFeedStateBestEffort("delete_post");
    await refreshFeedStateBestEffort("delete_post");

    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
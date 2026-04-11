import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { loadNearbyFeedService } from "@/lib/posts/service/feed-read";
import { readFeedStateCachedRepository } from "@/lib/posts/repository/feed-state";
import { decodeFeedCursor } from "@/lib/posts/repository/cursor";

vi.mock("@/lib/posts/service/feed-read", () => ({
  loadNearbyFeedService: vi.fn(),
}));

vi.mock("@/lib/posts/repository/feed-state", () => ({
  readFeedStateCachedRepository: vi.fn(),
}));

vi.mock("@/lib/posts/repository/cursor", () => ({
  decodeFeedCursor: vi.fn(),
}));

function makeRequest(query: string) {
  return new Request(`http://localhost/api/feed/nearby?${query}`);
}

describe("GET /api/feed/nearby", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(decodeFeedCursor).mockReturnValue({
      distanceMeters: 123,
      lastActivityAt: "2026-01-01T00:00:00.000Z",
      postId: "p1",
      radiusMeters: 10000,
    });
    vi.mocked(loadNearbyFeedService).mockResolvedValue({
      items: [],
      nextCursor: null,
      radiusMeters: 10000,
    });
    vi.mocked(readFeedStateCachedRepository).mockResolvedValue({
      stateVersion: "v1",
      refreshedAt: "2026-01-01T00:00:00.000Z",
      sourceLastActivityAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("returns 400 when coordinates are invalid", async () => {
    const response = await GET(makeRequest("latitude=bad&longitude=127.0"));
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("INVALID_LOCATION");
    expect(loadNearbyFeedService).not.toHaveBeenCalled();
  });

  it("returns 400 when cursor is invalid", async () => {
    vi.mocked(decodeFeedCursor).mockReturnValue(null);

    const response = await GET(
      makeRequest("latitude=37.5&longitude=127.0&cursor=invalid"),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("INVALID_CURSOR");
    expect(loadNearbyFeedService).not.toHaveBeenCalled();
  });

  it("returns items + nextCursor + stateVersion on success", async () => {
    vi.mocked(loadNearbyFeedService).mockResolvedValue({
      items: [
        {
          postId: "p1",
          content: "hello",
        },
      ] as never[],
      nextCursor: "cursor-1",
      radiusMeters: 10000,
    });

    const response = await GET(makeRequest("latitude=37.5&longitude=127.0"));
    const json = (await response.json()) as {
      ok: boolean;
      data?: {
        items: Array<{ postId: string }>;
        nextCursor: string | null;
        stateVersion: string | null;
        radiusMeters?: number;
      };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data?.items[0]?.postId).toBe("p1");
    expect(json.data?.nextCursor).toBe("cursor-1");
    expect(json.data?.stateVersion).toBe("v1");
    expect(json.data?.radiusMeters).toBe(10000);
  });

  it("skips inline feed-state read on paginated cursor requests", async () => {
    const response = await GET(
      makeRequest("latitude=37.5&longitude=127.0&cursor=cursor-1"),
    );
    const json = (await response.json()) as {
      ok: boolean;
      data?: { stateVersion: string | null };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data?.stateVersion).toBeNull();
    expect(readFeedStateCachedRepository).not.toHaveBeenCalled();
  });

  it("still returns success when inline feed-state read fails", async () => {
    vi.mocked(readFeedStateCachedRepository).mockRejectedValue(new Error("state failed"));

    const response = await GET(makeRequest("latitude=37.5&longitude=127.0"));
    const json = (await response.json()) as {
      ok: boolean;
      data?: { stateVersion: string | null };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data?.stateVersion).toBeNull();
  });

  it("returns 500 when nearby feed query fails", async () => {
    vi.mocked(loadNearbyFeedService).mockRejectedValue(new Error("db down"));

    const response = await GET(makeRequest("latitude=37.5&longitude=127.0"));
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("INTERNAL_ERROR");
  });
});

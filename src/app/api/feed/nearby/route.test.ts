import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { loadNearbyFeedRepository } from "@/lib/posts/repository/feed";
import { readFeedStateRepository } from "@/lib/posts/repository/feed-state";
import { decodeFeedCursor } from "@/lib/posts/repository/cursor";

vi.mock("@/lib/posts/repository/feed", () => ({
  loadNearbyFeedRepository: vi.fn(),
}));

vi.mock("@/lib/posts/repository/feed-state", () => ({
  readFeedStateRepository: vi.fn(),
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
    });
    vi.mocked(loadNearbyFeedRepository).mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    vi.mocked(readFeedStateRepository).mockResolvedValue({
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
    expect(loadNearbyFeedRepository).not.toHaveBeenCalled();
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
    expect(loadNearbyFeedRepository).not.toHaveBeenCalled();
  });

  it("returns items + nextCursor + stateVersion on success", async () => {
    vi.mocked(loadNearbyFeedRepository).mockResolvedValue({
      items: [
        {
          postId: "p1",
          content: "hello",
        },
      ] as never[],
      nextCursor: "cursor-1",
    });

    const response = await GET(makeRequest("latitude=37.5&longitude=127.0"));
    const json = (await response.json()) as {
      ok: boolean;
      data?: {
        items: Array<{ postId: string }>;
        nextCursor: string | null;
        stateVersion: string | null;
      };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data?.items[0]?.postId).toBe("p1");
    expect(json.data?.nextCursor).toBe("cursor-1");
    expect(json.data?.stateVersion).toBe("v1");
  });

  it("still returns success when inline feed-state read fails", async () => {
    vi.mocked(readFeedStateRepository).mockRejectedValue(new Error("state failed"));

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
    vi.mocked(loadNearbyFeedRepository).mockRejectedValue(new Error("db down"));

    const response = await GET(makeRequest("latitude=37.5&longitude=127.0"));
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("INTERNAL_ERROR");
  });
});


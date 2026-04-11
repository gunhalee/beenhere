import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getFeedPostLikersPreviewBatchRepository } from "@/lib/posts/repository/feed";

vi.mock("@/lib/posts/repository/feed", () => ({
  getFeedPostLikersPreviewBatchRepository: vi.fn(),
}));

describe("GET /api/posts/likers-preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when coordinates are invalid", async () => {
    const response = await GET(
      new Request("http://localhost/api/posts/likers-preview?latitude=bad&longitude=127"),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("INVALID_LOCATION");
  });

  it("returns 400 when postIds is missing", async () => {
    const response = await GET(
      new Request("http://localhost/api/posts/likers-preview?latitude=37.5&longitude=127"),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("returns mapped preview items on success", async () => {
    vi.mocked(getFeedPostLikersPreviewBatchRepository).mockResolvedValue([
      {
        post_id: "post-1",
        liker_user_ids: ["u1", "u2"],
        liker_nicknames: ["A", "amber_river"],
      },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/posts/likers-preview?latitude=37.5&longitude=127&postIds=post-1",
      ),
    );
    const json = (await response.json()) as {
      ok: boolean;
      data?: {
        items: Array<{
          postId: string;
          likers: Array<{ userId: string | null; nickname: string }>;
        }>;
      };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data?.items).toEqual([
      {
        postId: "post-1",
        likers: [
          { userId: "u1", nickname: "A" },
          { userId: "u2", nickname: "Amber River" },
        ],
      },
    ]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { reportPost } from "@/lib/posts/mutations";
import { runWritePreflight } from "@/lib/auth/write-preflight";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: vi.fn(),
}));

vi.mock("@/lib/posts/mutations", () => ({
  reportPost: vi.fn(),
}));

vi.mock("@/lib/auth/write-preflight", () => ({
  runWritePreflight: vi.fn(),
}));

function makeContext(postId = "post-1") {
  return {
    params: Promise.resolve({ postId }),
  };
}

function makeJsonRequest(body: unknown) {
  return new Request("http://localhost/api/posts/post-1/report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/posts/[postId]/report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
    vi.mocked(runWritePreflight).mockResolvedValue({
      ok: true,
      user: { id: "user-1" },
      isAnonymous: false,
      supabase: {} as never,
    });
  });

  it("returns alreadyReported=false on fresh success", async () => {
    vi.mocked(reportPost).mockResolvedValue({
      ok: true,
      alreadyReported: false,
    });

    const response = await POST(
      makeJsonRequest({ reasonCode: "spam" }),
      makeContext("post-9"),
    );
    const json = (await response.json()) as {
      ok: boolean;
      data?: { postId: string; alreadyReported: boolean };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({
      postId: "post-9",
      alreadyReported: false,
    });
  });

  it("treats duplicate report as idempotent success", async () => {
    vi.mocked(reportPost).mockResolvedValue({
      ok: true,
      alreadyReported: true,
    });

    const response = await POST(
      makeJsonRequest({ reasonCode: "spam" }),
      makeContext("post-9"),
    );
    const json = (await response.json()) as {
      ok: boolean;
      data?: { postId: string; alreadyReported: boolean };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({
      postId: "post-9",
      alreadyReported: true,
    });
  });
});

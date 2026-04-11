import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { deleteBlockRepository } from "@/lib/blocks/repository";
import { runWritePreflight } from "@/lib/auth/write-preflight";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: vi.fn(),
}));

vi.mock("@/lib/blocks/repository", () => ({
  deleteBlockRepository: vi.fn(),
}));

vi.mock("@/lib/auth/write-preflight", () => ({
  runWritePreflight: vi.fn(),
}));

function makeContext(userId = "user-2") {
  return {
    params: Promise.resolve({ userId }),
  };
}

describe("DELETE /api/blocks/:userId", () => {
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

  it("returns alreadyUnblocked flag on success", async () => {
    vi.mocked(deleteBlockRepository).mockResolvedValue({
      unblocked: true,
      alreadyUnblocked: false,
    });

    const response = await DELETE(
      new Request("http://localhost/api/blocks/user-2", {
        method: "DELETE",
      }),
      makeContext("user-2"),
    );
    const json = (await response.json()) as {
      ok: boolean;
      data?: { unblocked: true; alreadyUnblocked: boolean };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({
      unblocked: true,
      alreadyUnblocked: false,
    });
  });

  it("returns idempotent success when already unblocked", async () => {
    vi.mocked(deleteBlockRepository).mockResolvedValue({
      unblocked: true,
      alreadyUnblocked: true,
    });

    const response = await DELETE(
      new Request("http://localhost/api/blocks/user-2", {
        method: "DELETE",
      }),
      makeContext("user-2"),
    );
    const json = (await response.json()) as {
      ok: boolean;
      data?: { unblocked: true; alreadyUnblocked: boolean };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({
      unblocked: true,
      alreadyUnblocked: true,
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createBlockRepository } from "@/lib/blocks/repository";
import { runWritePreflight } from "@/lib/auth/write-preflight";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: vi.fn(),
}));

vi.mock("@/lib/blocks/repository", () => ({
  createBlockRepository: vi.fn(),
}));

vi.mock("@/lib/auth/write-preflight", () => ({
  runWritePreflight: vi.fn(),
}));

function makeJsonRequest(body: unknown) {
  return new Request("http://localhost/api/blocks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/blocks", () => {
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

  it("returns alreadyBlocked flag on success", async () => {
    vi.mocked(createBlockRepository).mockResolvedValue({
      blocked: true,
      alreadyBlocked: false,
    });

    const response = await POST(
      makeJsonRequest({ blockedUserId: "user-2" }),
    );
    const json = (await response.json()) as {
      ok: boolean;
      data?: { blocked: true; alreadyBlocked: boolean };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({
      blocked: true,
      alreadyBlocked: false,
    });
  });

  it("returns idempotent success when already blocked", async () => {
    vi.mocked(createBlockRepository).mockResolvedValue({
      blocked: true,
      alreadyBlocked: true,
    });

    const response = await POST(
      makeJsonRequest({ blockedUserId: "user-2" }),
    );
    const json = (await response.json()) as {
      ok: boolean;
      data?: { blocked: true; alreadyBlocked: boolean };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({
      blocked: true,
      alreadyBlocked: true,
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { hidePostByReportRepository } from "@/lib/moderation/repository";
import { ApiRouteTimeoutError } from "@/lib/api/request";

vi.mock("@/lib/moderation/repository", () => ({
  hidePostByReportRepository: vi.fn(),
}));

function makeRequest(authorization?: string) {
  return new Request("http://localhost/api/internal/moderation/reports/r1/hide", {
    method: "POST",
    headers: authorization ? { authorization } : undefined,
  });
}

function makeContext(reportId = "r1") {
  return {
    params: Promise.resolve({ reportId }),
  };
}

describe("POST /api/internal/moderation/reports/[reportId]/hide", () => {
  const originalModerationSecret = process.env.MODERATION_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MODERATION_SECRET = "moderation-secret";
  });

  afterEach(() => {
    if (originalModerationSecret === undefined) {
      delete process.env.MODERATION_SECRET;
    } else {
      process.env.MODERATION_SECRET = originalModerationSecret;
    }
  });

  it("returns 401 UNAUTHORIZED when auth header is missing", async () => {
    const response = await POST(makeRequest(), makeContext());
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(401);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 VALIDATION_ERROR when reportId is blank", async () => {
    const response = await POST(
      makeRequest("Bearer moderation-secret"),
      makeContext("   "),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("returns hide result on success", async () => {
    vi.mocked(hidePostByReportRepository).mockResolvedValue({
      reportId: "r1",
      postId: "p1",
      hidden: true,
      alreadyHidden: false,
    });

    const response = await POST(
      makeRequest("Bearer moderation-secret"),
      makeContext("r1"),
    );
    const json = (await response.json()) as {
      ok: boolean;
      data?: {
        reportId: string;
        postId: string;
        hidden: boolean;
        alreadyHidden: boolean;
      };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data).toEqual({
      reportId: "r1",
      postId: "p1",
      hidden: true,
      alreadyHidden: false,
    });
  });

  it("returns 504 timeout code when hide processing times out", async () => {
    vi.mocked(hidePostByReportRepository).mockRejectedValue(
      new ApiRouteTimeoutError("timeout", "TIMEOUT_MODERATION_HIDE"),
    );

    const response = await POST(
      makeRequest("Bearer moderation-secret"),
      makeContext("r1"),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(504);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("TIMEOUT_MODERATION_HIDE");
  });

  it("returns 404 REPORT_NOT_FOUND when report is missing", async () => {
    vi.mocked(hidePostByReportRepository).mockRejectedValue({
      code: "REPORT_NOT_FOUND",
    });

    const response = await POST(
      makeRequest("Bearer moderation-secret"),
      makeContext("r1"),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(404);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("REPORT_NOT_FOUND");
  });

  it("returns 404 POST_NOT_FOUND when post is missing", async () => {
    vi.mocked(hidePostByReportRepository).mockRejectedValue({
      code: "POST_NOT_FOUND",
    });

    const response = await POST(
      makeRequest("Bearer moderation-secret"),
      makeContext("r1"),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(404);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("POST_NOT_FOUND");
  });

  it("returns 500 INTERNAL_ERROR on unknown failure", async () => {
    vi.mocked(hidePostByReportRepository).mockRejectedValue(
      new Error("db down"),
    );

    const response = await POST(
      makeRequest("Bearer moderation-secret"),
      makeContext("r1"),
    );
    const json = (await response.json()) as { ok: boolean; code?: string };

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("INTERNAL_ERROR");
  });
});

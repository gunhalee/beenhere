import { fail, ok } from "@/lib/api/response";
import {
  API_ERROR_CODE,
  API_ERROR_MESSAGE,
  API_TIMEOUT_CODE,
} from "@/lib/api/common-errors";
import { isApiRouteTimeoutError, runWithTimeout } from "@/lib/api/request";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const GUEST_ANONYMIZE_TIMEOUT_MS = 5000;

function isAuthorizedCronRequest(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization");
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return false;
  }

  return authorization.slice("Bearer ".length).trim() === configuredSecret;
}

function parseInactiveDays(searchParams: URLSearchParams) {
  const parsed = Number.parseInt(searchParams.get("inactiveDays") ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 365;
  return parsed;
}

function parseBatchLimit(searchParams: URLSearchParams) {
  const parsed = Number.parseInt(searchParams.get("limit") ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 500;
  return Math.min(parsed, 2000);
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return fail(API_ERROR_MESSAGE.AUTH_INVALID, 401, API_ERROR_CODE.UNAUTHORIZED);
  }

  const { searchParams } = new URL(request.url);
  const inactiveDays = parseInactiveDays(searchParams);
  const limit = parseBatchLimit(searchParams);

  try {
    const result = await runWithTimeout(
      async () => {
        const adminClient = await createSupabaseAdminClient();
        const { data, error } = await adminClient.rpc("anonymize_inactive_guest_profiles", {
          p_inactive_days: inactiveDays,
          p_limit: limit,
        });

        if (error) throw error;

        const row = Array.isArray(data) ? data[0] : data;
        const anonymizedCount = Number((row as { anonymized_count?: unknown })?.anonymized_count ?? 0);
        return {
          anonymizedCount: Number.isFinite(anonymizedCount) ? anonymizedCount : 0,
        };
      },
      GUEST_ANONYMIZE_TIMEOUT_MS,
      API_TIMEOUT_CODE.TIMEOUT_GUEST_ANONYMIZE,
      "게스트 익명화 배치 실행 시간이 초과됐어요.",
    );

    return ok({
      inactiveDays,
      limit,
      anonymizedCount: result.anonymizedCount,
    });
  } catch (error) {
    if (isApiRouteTimeoutError(error)) {
      return fail("게스트 익명화 배치가 지연되고 있어요.", 504, error.code);
    }

    const detail =
      error && typeof error === "object" && "message" in error
        ? (error as { message: string }).message
        : String(error);
    console.error("[api/internal/guests/anonymize] anonymize failed:", detail, error);
    return fail(
      "게스트 익명화 처리 중 오류가 발생했어요.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
}

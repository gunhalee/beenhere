import { API_ERROR_CODE, API_ERROR_MESSAGE } from "@/lib/api/common-errors";
import {
  createSupabaseServerClient,
  getServerUser,
  type ServerClient,
} from "@/lib/supabase/server";
import { ensureProfileExistsForUser } from "@/lib/profiles/ensure-profile";
import { consumeAnonymousWriteQuota } from "./anonymous-write-quota";
import { touchProfileActivity } from "./profile-activity";

export const WRITE_RATE_LIMIT = 10;
export const WRITE_RATE_WINDOW_SECONDS = 60;
export const RATE_LIMIT_CONSENT_KEY = "rate_limit_write_at";

export type WritePreflightSuccess = {
  ok: true;
  supabase: ServerClient;
  user: NonNullable<Awaited<ReturnType<typeof getServerUser>>>;
  isAnonymous: boolean;
};

export type WritePreflightFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

type Options = {
  ensureProfile?: boolean;
  touchActivity?: boolean;
  requireQuota?: boolean;
  includeConsentDetails?: boolean;
};

function hasRateLimitConsent(userMetadata: unknown) {
  if (!userMetadata || typeof userMetadata !== "object" || Array.isArray(userMetadata)) {
    return false;
  }

  const consents = (userMetadata as { consents?: unknown }).consents;
  if (!consents || typeof consents !== "object" || Array.isArray(consents)) {
    return false;
  }

  return typeof (consents as Record<string, unknown>)[RATE_LIMIT_CONSENT_KEY] === "string";
}

function calculateRetryAfterSeconds(resetAt: string | null) {
  if (!resetAt) {
    return null;
  }

  const resetTimeMs = Date.parse(resetAt);
  if (!Number.isFinite(resetTimeMs)) {
    return null;
  }

  const seconds = Math.ceil((resetTimeMs - Date.now()) / 1000);
  return Math.max(seconds, 0);
}

export async function runWritePreflight(
  options: Options = {},
): Promise<WritePreflightSuccess | WritePreflightFailure> {
  const {
    ensureProfile = false,
    touchActivity = false,
    requireQuota = false,
    includeConsentDetails = false,
  } = options;

  try {
    const supabase = await createSupabaseServerClient();
    const user = await getServerUser(supabase);

    if (!user) {
      return {
        ok: false,
        status: 401,
        code: API_ERROR_CODE.UNAUTHORIZED,
        message: API_ERROR_MESSAGE.AUTH_REQUIRED,
      };
    }

    const isAnonymous = Boolean(user.is_anonymous);

    if (ensureProfile) {
      await ensureProfileExistsForUser(supabase, user.id, isAnonymous);
    }

    if (touchActivity) {
      await touchProfileActivity({
        supabase,
        userId: user.id,
        isAnonymous,
      });
    }

    if (requireQuota) {
      const quota = await consumeAnonymousWriteQuota({
        supabase,
        userId: user.id,
        isAnonymous,
      });

      if (!quota.allowed) {
        return {
          ok: false,
          status: 429,
          code: API_ERROR_CODE.RATE_LIMITED,
          message: "게스트 계정의 쓰기 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
          details: {
            resetAt: quota.resetAt,
            remaining: quota.remaining,
            ...(includeConsentDetails
              ? {
                  retryAfterSeconds: calculateRetryAfterSeconds(quota.resetAt),
                  limit: WRITE_RATE_LIMIT,
                  windowSeconds: WRITE_RATE_WINDOW_SECONDS,
                  consentRequired:
                    isAnonymous && !hasRateLimitConsent(user.user_metadata),
                }
              : {}),
          },
        };
      }
    }

    return {
      ok: true,
      supabase,
      user,
      isAnonymous,
    };
  } catch {
    return {
      ok: false,
      status: 500,
      code: API_ERROR_CODE.INTERNAL_ERROR,
      message: "요청 검증 중 오류가 발생했어요.",
    };
  }
}

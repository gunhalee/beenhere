import { fail, ok } from "@/lib/api/response";
import { API_ERROR_CODE, API_ERROR_MESSAGE } from "@/lib/api/common-errors";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CONSENT_KEY = "rate_limit_write_at";

function readConsentsMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...(value as Record<string, unknown>) };
}

export async function POST() {
  const grantedAt = new Date().toISOString();

  if (!hasSupabaseBrowserConfig()) {
    return ok({ consent: CONSENT_KEY, grantedAt });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return fail(API_ERROR_MESSAGE.AUTH_REQUIRED, 401, API_ERROR_CODE.UNAUTHORIZED);
  }

  const currentMetadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? { ...user.user_metadata }
      : {};
  const currentConsents = readConsentsMetadata(currentMetadata.consents);
  currentConsents[CONSENT_KEY] = grantedAt;

  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      ...currentMetadata,
      consents: currentConsents,
    },
  });

  if (updateError) {
    return fail(
      "동의 상태를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }

  return ok({ consent: CONSENT_KEY, grantedAt });
}

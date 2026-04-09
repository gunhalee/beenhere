import { readJsonBody } from "@/lib/api/request";
import { fail, ok } from "@/lib/api/response";
import { API_ERROR_CODE, API_ERROR_MESSAGE } from "@/lib/api/common-errors";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createBlockRepository } from "@/lib/blocks/repository";
import { ensureProfileExistsForUser } from "@/lib/profiles/ensure-profile";
import { consumeAnonymousWriteQuota } from "@/lib/auth/anonymous-write-quota";
import type { CreateBlockBody } from "@/types/api";

export async function POST(request: Request) {
  const bodyResult = await readJsonBody<CreateBlockBody>(request);
  if (!bodyResult.ok) return bodyResult.response;

  const { blockedUserId } = bodyResult.body;

  if (!blockedUserId?.trim()) {
    return fail(
      "Target user ID is required.",
      400,
      API_ERROR_CODE.VALIDATION_ERROR,
    );
  }

  if (!hasSupabaseBrowserConfig()) {
    return ok({ blocked: true as const });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail(
      API_ERROR_MESSAGE.AUTH_REQUIRED,
      401,
      API_ERROR_CODE.UNAUTHORIZED,
    );
  }

  if (user.id === blockedUserId) {
    return fail(
      "You cannot block yourself.",
      400,
      API_ERROR_CODE.VALIDATION_ERROR,
    );
  }

  await ensureProfileExistsForUser(supabase, user.id);

  const quota = await consumeAnonymousWriteQuota({
    supabase,
    userId: user.id,
    isAnonymous: Boolean(user.is_anonymous),
  });

  if (!quota.allowed) {
    return fail(
      "Too many write actions for this guest account. Please try again shortly.",
      429,
      API_ERROR_CODE.RATE_LIMITED,
      {
        resetAt: quota.resetAt,
        remaining: quota.remaining,
      },
    );
  }

  try {
    await createBlockRepository(blockedUserId);
    return ok({ blocked: true as const });
  } catch (error) {
    console.error("[api/blocks] block failed:", error);
    return fail(
      "Failed to block user.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
}


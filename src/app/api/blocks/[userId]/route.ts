import { fail, ok } from "@/lib/api/response";
import { API_ERROR_CODE, API_ERROR_MESSAGE } from "@/lib/api/common-errors";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteBlockRepository } from "@/lib/blocks/repository";
import { ensureProfileExistsForUser } from "@/lib/profiles/ensure-profile";
import { consumeAnonymousWriteQuota } from "@/lib/auth/anonymous-write-quota";

type Context = { params: Promise<{ userId: string }> };

export async function DELETE(_request: Request, context: Context) {
  const { userId: blockedUserId } = await context.params;

  if (!hasSupabaseBrowserConfig()) {
    return ok({ unblocked: true as const });
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
    await deleteBlockRepository(blockedUserId);
    return ok({ unblocked: true as const });
  } catch (error) {
    console.error("[api/blocks/:userId] unblock failed:", error);
    return fail(
      "Failed to unblock user.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
}


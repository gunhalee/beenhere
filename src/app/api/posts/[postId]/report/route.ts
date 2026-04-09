import { readJsonBody } from "@/lib/api/request";
import { fail, ok } from "@/lib/api/response";
import { API_ERROR_CODE, API_ERROR_MESSAGE } from "@/lib/api/common-errors";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reportPost } from "@/lib/posts/mutations";
import { ensureProfileExistsForUser } from "@/lib/profiles/ensure-profile";
import { consumeAnonymousWriteQuota } from "@/lib/auth/anonymous-write-quota";
import type { ReportPostBody } from "@/types/api";

type Context = { params: Promise<{ postId: string }> };

export async function POST(request: Request, context: Context) {
  const { postId } = await context.params;

  const bodyResult = await readJsonBody<ReportPostBody>(request);
  if (!bodyResult.ok) return bodyResult.response;

  const { reasonCode } = bodyResult.body;

  if (!reasonCode?.trim()) {
    return fail("Reason code is required.", 400, API_ERROR_CODE.VALIDATION_ERROR);
  }

  if (hasSupabaseBrowserConfig()) {
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
  }

  try {
    const result = await reportPost({ postId, reasonCode });

    if (!result.ok) {
      return fail(result.message, 400, result.code);
    }

    return ok({ postId });
  } catch (error) {
    console.error("[api/posts/:postId/report] report failed:", error);
    return fail(
      "Failed to submit report.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
}


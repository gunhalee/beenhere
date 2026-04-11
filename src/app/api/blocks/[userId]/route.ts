import { fail, ok } from "@/lib/api/response";
import { API_ERROR_CODE, API_ERROR_MESSAGE } from "@/lib/api/common-errors";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { deleteBlockRepository } from "@/lib/blocks/repository";
import { ensureProfileExistsForUser } from "@/lib/profiles/ensure-profile";
import { consumeAnonymousWriteQuota } from "@/lib/auth/anonymous-write-quota";
import { touchProfileActivity } from "@/lib/auth/profile-activity";

type Context = { params: Promise<{ userId: string }> };

export async function DELETE(_request: Request, context: Context) {
  const { userId: blockedUserId } = await context.params;

  if (!hasSupabaseBrowserConfig()) {
    return ok({ unblocked: true as const });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const user = await getServerUser(supabase);

    if (!user) {
      return fail(
        API_ERROR_MESSAGE.AUTH_REQUIRED,
        401,
        API_ERROR_CODE.UNAUTHORIZED,
      );
    }

    const isAnonymous = Boolean(user.is_anonymous);

    await ensureProfileExistsForUser(supabase, user.id, isAnonymous);
    await touchProfileActivity({
      supabase,
      userId: user.id,
      isAnonymous,
    });

    const quota = await consumeAnonymousWriteQuota({
      supabase,
      userId: user.id,
      isAnonymous,
    });

    if (!quota.allowed) {
      return fail(
        "게스트 계정의 쓰기 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
        429,
        API_ERROR_CODE.RATE_LIMITED,
        {
          resetAt: quota.resetAt,
          remaining: quota.remaining,
        },
      );
    }
  } catch (error) {
    console.error("[api/blocks/:userId] auth preflight failed:", error);
    return fail(
      "요청 검증 중 오류가 발생했어요.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }

  try {
    await deleteBlockRepository(blockedUserId);
    return ok({ unblocked: true as const });
  } catch (error) {
    console.error("[api/blocks/:userId] 차단 해제 실패:", error);
    return fail(
      "차단 해제 중 오류가 발생했어요.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
}

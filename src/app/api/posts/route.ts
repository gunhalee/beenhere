import { readJsonBody } from "@/lib/api/request";
import { fail, ok } from "@/lib/api/response";
import { API_ERROR_CODE, API_ERROR_MESSAGE } from "@/lib/api/common-errors";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPost } from "@/lib/posts/mutations";
import { ensureProfileExistsForUser } from "@/lib/profiles/ensure-profile";
import { consumeAnonymousWriteQuota } from "@/lib/auth/anonymous-write-quota";
import type { CreatePostBody } from "@/types/api";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const CLIENT_REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;

export async function POST(request: Request) {
  const bodyResult = await readJsonBody<CreatePostBody>(request);

  if (!bodyResult.ok) return bodyResult.response;

  const { content, latitude, longitude, placeLabel } = bodyResult.body;
  const clientRequestId = bodyResult.body.clientRequestId?.trim() || undefined;

  if (!content?.trim()) {
    return fail("Content is required.", 400, API_ERROR_CODE.VALIDATION_ERROR);
  }

  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
    return fail("Valid location coordinates are required.", 400, API_ERROR_CODE.INVALID_LOCATION);
  }

  if (!placeLabel?.trim()) {
    return fail("Place label is required.", 400, API_ERROR_CODE.VALIDATION_ERROR);
  }

  if (clientRequestId && !CLIENT_REQUEST_ID_PATTERN.test(clientRequestId)) {
    return fail(
      "clientRequestId is invalid.",
      400,
      API_ERROR_CODE.VALIDATION_ERROR,
    );
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
    const result = await createPost({
      content,
      latitude,
      longitude,
      placeLabel,
      clientRequestId,
    });

    if (!result.ok) {
      return fail(result.message, 400, result.code);
    }

    return ok({ postId: result.postId }, 201);
  } catch (error) {
    console.error("[api/posts] create post failed:", error);
    return fail(
      "Failed to create post.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
}


import { fail, ok } from "@/lib/api/response";
import { readJsonBody } from "@/lib/api/request";
import { API_ERROR_CODE, API_ERROR_MESSAGE } from "@/lib/api/common-errors";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildGoogleCallbackUrl,
  sanitizeGuestUserId,
  isGoogleOAuthIntent,
  sanitizeNextPath,
} from "@/lib/auth/google-oauth-common";

type StartGoogleOAuthBody = {
  intent?: string;
  nextPath?: string;
  guestUserId?: string;
};

type StartGoogleOAuthResponse = {
  url: string;
};

type OAuthLikeError = {
  code?: string | null;
  message?: string | null;
} | null;

function shouldFallbackToLogin(error: OAuthLikeError) {
  if (!error) return false;

  const code = (error.code ?? "").toLowerCase();
  if (code === "manual_linking_disabled" || code === "identity_already_exists") {
    return true;
  }

  const message = (error.message ?? "").toLowerCase();
  if (!message) return false;

  return (
    /manual linking is disabled/i.test(message) ||
    /identity.*already.*(exists|linked)/i.test(message) ||
    /already linked to another user/i.test(message)
  );
}

async function startGoogleLoginOAuth(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  redirectTo: string;
  errorMessage: string;
}) {
  const { data, error } = await input.supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: input.redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    return fail(
      error?.message ?? input.errorMessage,
      400,
      API_ERROR_CODE.INVALID_REQUEST,
    );
  }

  return ok<StartGoogleOAuthResponse>({ url: data.url });
}

export async function POST(request: Request) {
  if (!hasSupabaseBrowserConfig()) {
    return fail(API_ERROR_MESSAGE.AUTH_INVALID, 500, API_ERROR_CODE.INTERNAL_ERROR);
  }

  const bodyResult = await readJsonBody<StartGoogleOAuthBody>(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const { intent, nextPath, guestUserId } = bodyResult.body;
  if (!isGoogleOAuthIntent(intent)) {
    return fail(API_ERROR_MESSAGE.INVALID_REQUEST, 400, API_ERROR_CODE.INVALID_REQUEST);
  }

  const sanitizedNextPath = sanitizeNextPath(nextPath);
  const sanitizedGuestUserId = sanitizeGuestUserId(guestUserId);
  const origin = new URL(request.url).origin;
  const redirectTo = buildGoogleCallbackUrl({
    origin,
    intent,
    nextPath: sanitizedNextPath,
    guestUserId: sanitizedGuestUserId,
  });

  try {
    const supabase = await createSupabaseServerClient();

    if (intent === "link-google") {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return fail(API_ERROR_MESSAGE.AUTH_REQUIRED, 401, API_ERROR_CODE.UNAUTHORIZED);
      }

      const { data, error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (shouldFallbackToLogin(error)) {
        const fallbackRedirectTo = buildGoogleCallbackUrl({
          origin,
          intent: "login",
          nextPath: sanitizedNextPath,
          guestUserId: sanitizedGuestUserId ?? sanitizeGuestUserId(user.id),
        });

        return startGoogleLoginOAuth({
          supabase,
          redirectTo: fallbackRedirectTo,
          errorMessage: "Google 계정 연동을 시작하지 못했어요.",
        });
      }

      if (error || !data?.url) {
        return fail(
          error?.message ?? "Google 계정 연동을 시작하지 못했어요.",
          400,
          API_ERROR_CODE.INVALID_REQUEST,
        );
      }

      return ok<StartGoogleOAuthResponse>({ url: data.url });
    }

    return startGoogleLoginOAuth({
      supabase,
      redirectTo,
      errorMessage: "Google 로그인을 시작하지 못했어요.",
    });
  } catch (error) {
    console.error("[api/auth/google/start] failed:", error);
    return fail(
      "Google 인증 시작 중 오류가 발생했어요.",
      500,
      API_ERROR_CODE.INTERNAL_ERROR,
    );
  }
}

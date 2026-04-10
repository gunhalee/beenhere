import { NextResponse } from "next/server";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureProfileExistsForUser } from "@/lib/profiles/ensure-profile";
import { mergeGuestIntoMember } from "@/lib/auth/guest-upgrade";
import {
  buildGoogleCallbackUrl,
  GUEST_USER_ID_PARAM,
  sanitizeGuestUserId,
  sanitizeNextPath,
} from "@/lib/auth/google-oauth-common";

const LINK_GOOGLE_INTENT = "link-google";
const LINK_STATUS_PARAM = "google_link";
const LINK_REASON_PARAM = "google_link_reason";
const UPGRADE_STATUS_PARAM = "upgrade";
const UPGRADE_REASON_PARAM = "upgrade_reason";
const IDENTITY_ALREADY_EXISTS_REASON = "identity_already_exists";
const AUTO_SWITCH_FAILED_REASON = "auto_switch_failed";

function normalizeReason(reason: string | null, fallback: string): string {
  if (!reason) return fallback;
  const normalized = reason.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  if (!normalized) return fallback;
  return normalized.slice(0, 64);
}

function redirectWithLinkStatus(input: {
  origin: string;
  nextPath: string;
  status: "success" | "failed";
  reason?: string;
}) {
  const targetUrl = new URL(input.nextPath, input.origin);
  targetUrl.searchParams.set(LINK_STATUS_PARAM, input.status);
  if (input.reason) {
    targetUrl.searchParams.set(LINK_REASON_PARAM, input.reason);
  }
  return NextResponse.redirect(targetUrl.toString());
}

function redirectWithUpgradeStatus(input: {
  origin: string;
  nextPath: string;
  status?: "merged" | "failed";
  reason?: string;
}) {
  const targetUrl = new URL(input.nextPath, input.origin);
  if (input.status) {
    targetUrl.searchParams.set(UPGRADE_STATUS_PARAM, input.status);
  }
  if (input.reason) {
    targetUrl.searchParams.set(UPGRADE_REASON_PARAM, input.reason);
  }
  return NextResponse.redirect(targetUrl.toString());
}

function resolveNextPathAfterUpgrade(input: {
  origin: string;
  nextPath: string;
  previousGuestUserId: string | null;
  currentUserId: string;
  status?: "merged" | "failed";
}) {
  if (!input.status || !input.previousGuestUserId) {
    return input.nextPath;
  }

  const targetUrl = new URL(input.nextPath, input.origin);
  if (targetUrl.pathname !== `/profile/${input.previousGuestUserId}`) {
    return input.nextPath;
  }

  targetUrl.pathname = `/profile/${input.currentUserId}`;
  return `${targetUrl.pathname}${targetUrl.search}`;
}

async function tryRedirectToGoogleLogin(input: {
  origin: string;
  nextPath: string;
  guestUserId?: string | null;
}) {
  if (!hasSupabaseBrowserConfig()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const redirectTo = buildGoogleCallbackUrl({
    origin: input.origin,
    intent: "login",
    nextPath: input.nextPath,
    guestUserId: input.guestUserId,
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    return null;
  }

  return NextResponse.redirect(data.url);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const intent = searchParams.get("intent");
  const isLinkGoogleIntent = intent === LINK_GOOGLE_INTENT;
  const nextPath = sanitizeNextPath(searchParams.get("next"));
  const previousGuestUserIdHint = sanitizeGuestUserId(
    searchParams.get(GUEST_USER_ID_PARAM),
  );

  if (!code) {
    if (isLinkGoogleIntent) {
      const reason = normalizeReason(
        searchParams.get("error_code") ?? searchParams.get("error"),
        "missing_code",
      );

      if (reason === IDENTITY_ALREADY_EXISTS_REASON) {
        const autoSwitchResponse = await tryRedirectToGoogleLogin({
          origin,
          nextPath,
          guestUserId: previousGuestUserIdHint,
        });

        if (autoSwitchResponse) {
          return autoSwitchResponse;
        }
      }

      return redirectWithLinkStatus({
        origin,
        nextPath,
        status: "failed",
        reason:
          reason === IDENTITY_ALREADY_EXISTS_REASON ? AUTO_SWITCH_FAILED_REASON : reason,
      });
    }
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  if (!hasSupabaseBrowserConfig()) {
    if (isLinkGoogleIntent) {
      return redirectWithLinkStatus({
        origin,
        nextPath,
        status: "failed",
        reason: "supabase_not_configured",
      });
    }
    return NextResponse.redirect(`${origin}${nextPath}`);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user: previousUser },
  } = await supabase.auth.getUser();
  const previousGuestUserId = previousUser
    ? previousUser.is_anonymous === true
      ? previousUser.id
      : null
    : previousGuestUserIdHint;

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    if (isLinkGoogleIntent) {
      const exchangeError = error as { code?: string; message?: string };
      const reason = normalizeReason(
        exchangeError.code ?? exchangeError.message ?? null,
        "exchange_failed",
      );

      if (reason === IDENTITY_ALREADY_EXISTS_REASON) {
        const autoSwitchResponse = await tryRedirectToGoogleLogin({
          origin,
          nextPath,
          guestUserId: previousGuestUserId,
        });

        if (autoSwitchResponse) {
          return autoSwitchResponse;
        }
      }

      return redirectWithLinkStatus({
        origin,
        nextPath,
        status: "failed",
        reason:
          reason === IDENTITY_ALREADY_EXISTS_REASON ? AUTO_SWITCH_FAILED_REASON : reason,
      });
    }
    return NextResponse.redirect(`${origin}/auth/login?error=exchange_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isLinkGoogleIntent) {
      return redirectWithLinkStatus({
        origin,
        nextPath,
        status: "failed",
        reason: "user_missing",
      });
    }
    return NextResponse.redirect(`${origin}/auth/login`);
  }

  await ensureProfileExistsForUser(supabase, user.id, Boolean(user.is_anonymous));

  let upgradeStatus: "merged" | "failed" | undefined;
  let upgradeReason: string | undefined;
  const canAttemptMerge =
    previousGuestUserId &&
    previousGuestUserId !== user.id &&
    user.is_anonymous !== true;

  if (canAttemptMerge) {
    const mergeResult = await mergeGuestIntoMember({
      guestUserId: previousGuestUserId,
      memberUserId: user.id,
    });

    if (mergeResult.ok) {
      upgradeStatus = "merged";
    } else {
      upgradeStatus = "failed";
      upgradeReason = normalizeReason(mergeResult.code ?? mergeResult.error, "merge_failed");
    }
  }

  if (isLinkGoogleIntent) {
    if (upgradeStatus) {
      return redirectWithUpgradeStatus({
        origin,
        nextPath: `/profile/${user.id}`,
        status: upgradeStatus,
        reason: upgradeReason,
      });
    }

    return redirectWithLinkStatus({
      origin,
      nextPath,
      status: "success",
    });
  }

  return redirectWithUpgradeStatus({
    origin,
    nextPath: resolveNextPathAfterUpgrade({
      origin,
      nextPath,
      previousGuestUserId,
      currentUserId: user.id,
      status: upgradeStatus,
    }),
    status: upgradeStatus,
    reason: upgradeReason,
  });
}

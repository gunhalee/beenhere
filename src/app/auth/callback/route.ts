import { NextResponse } from "next/server";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureProfileExistsForUser } from "@/lib/profiles/ensure-profile";
import { mergeGuestIntoMember } from "@/lib/auth/guest-upgrade";
import {
  GUEST_USER_ID_PARAM,
  sanitizeGuestUserId,
  sanitizeNextPath,
} from "@/lib/auth/google-oauth-common";

const LINK_GOOGLE_INTENT = "link-google";
const LINK_STATUS_PARAM = "google_link";
const LINK_REASON_PARAM = "google_link_reason";
const UPGRADE_STATUS_PARAM = "upgrade";
const UPGRADE_REASON_PARAM = "upgrade_reason";

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
      return redirectWithLinkStatus({
        origin,
        nextPath,
        status: "failed",
        reason,
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
      return redirectWithLinkStatus({
        origin,
        nextPath,
        status: "failed",
        reason: normalizeReason(
          exchangeError.code ?? exchangeError.message ?? null,
          "exchange_failed",
        ),
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
    !isLinkGoogleIntent &&
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
    return redirectWithLinkStatus({
      origin,
      nextPath,
      status: "success",
    });
  }

  return redirectWithUpgradeStatus({
    origin,
    nextPath,
    status: upgradeStatus,
    reason: upgradeReason,
  });
}

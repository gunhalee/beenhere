import { NextResponse } from "next/server";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const LINK_GOOGLE_INTENT = "link-google";
const LINK_STATUS_PARAM = "google_link";
const LINK_REASON_PARAM = "google_link_reason";

function sanitizeNextPath(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const intent = searchParams.get("intent");
  const isLinkGoogleIntent = intent === LINK_GOOGLE_INTENT;
  const nextPath = sanitizeNextPath(searchParams.get("next"));

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    if (isLinkGoogleIntent) {
      return redirectWithLinkStatus({
        origin,
        nextPath,
        status: "failed",
        reason: "profile_missing",
      });
    }
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  if (isLinkGoogleIntent) {
    return redirectWithLinkStatus({
      origin,
      nextPath,
      status: "success",
    });
  }

  return NextResponse.redirect(`${origin}${nextPath}`);
}

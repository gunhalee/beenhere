import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig, hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { ensureProfileExistsForUser } from "@/lib/profiles/ensure-profile";
import { sanitizeNextPath } from "@/lib/auth/google-oauth-common";
import { createRouteCookieBridge } from "@/lib/supabase/route-cookie-bridge";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = sanitizeNextPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  if (!hasSupabaseBrowserConfig()) {
    return NextResponse.redirect(`${origin}${nextPath}`);
  }

  const { url, anonKey } = getSupabaseConfig();
  const cookieBridge = await createRouteCookieBridge();

  const supabase = createServerClient(url!, anonKey!, {
    cookies: {
      getAll() {
        return cookieBridge.getAll();
      },
      setAll(cookiesToSet) {
        cookieBridge.setAll(cookiesToSet);
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/auth/login?error=exchange_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/login`);
  }

  await ensureProfileExistsForUser(supabase, user.id, Boolean(user.is_anonymous));

  return cookieBridge.applyToResponse(
    NextResponse.redirect(new URL(nextPath, origin)),
  );
}

import { NextResponse } from "next/server";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureProfileExistsForUser } from "@/lib/profiles/ensure-profile";
import { sanitizeNextPath } from "@/lib/auth/google-oauth-common";

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

  const supabase = await createSupabaseServerClient();
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

  return NextResponse.redirect(`${origin}${nextPath}`);
}

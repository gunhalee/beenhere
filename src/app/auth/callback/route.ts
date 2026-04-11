import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig, hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { ensureProfileExistsForUser } from "@/lib/profiles/ensure-profile";
import { sanitizeNextPath } from "@/lib/auth/google-oauth-common";

type PendingCookie = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function applyCookies(response: NextResponse, pendingCookies: PendingCookie[]) {
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options);
  }
  return response;
}

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
  const cookieStore = await cookies();
  const pendingCookies: PendingCookie[] = [];

  const supabase = createServerClient(url!, anonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        pendingCookies.length = 0;
        pendingCookies.push(...cookiesToSet);
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Handled via explicit applyCookies below
          }
        });
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

  return applyCookies(
    NextResponse.redirect(new URL(nextPath, origin)),
    pendingCookies,
  );
}

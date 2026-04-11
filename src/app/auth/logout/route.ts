import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  getSupabaseConfig,
  hasSupabaseBrowserConfig,
} from "@/lib/supabase/config";
import { createRouteCookieBridge } from "@/lib/supabase/route-cookie-bridge";

/**
 * GET must be side-effect free so prefetch/speculative requests
 * can never silently log users out.
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/auth/login`);
}

/**
 * Local sign-out only. After logout, always move to login landing.
 * signOut 이 설정하는 쿠키 삭제를 redirect 응답에 명시적으로 적용한다.
 */
export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const response = NextResponse.redirect(`${origin}/auth/login`);
  let cookieBridge: Awaited<ReturnType<typeof createRouteCookieBridge>> | null =
    null;

  if (hasSupabaseBrowserConfig()) {
    const { url, anonKey } = getSupabaseConfig();
    cookieBridge = await createRouteCookieBridge();
    const activeCookieBridge = cookieBridge;

    const supabase = createServerClient(url!, anonKey!, {
      cookies: {
        getAll() {
          return activeCookieBridge.getAll();
        },
        setAll(cookiesToSet, headersToSet) {
          activeCookieBridge.setAll(cookiesToSet, headersToSet);
        },
      },
    });

    await supabase.auth.signOut({ scope: "local" });
  }

  return cookieBridge ? cookieBridge.applyToResponse(response) : response;
}

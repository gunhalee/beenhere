import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig, hasSupabaseBrowserConfig } from "@/lib/supabase/config";

/**
 * Local sign-out only. After logout, always move to login landing.
 * signOut 이 설정하는 쿠키 삭제를 redirect 응답에 명시적으로 적용한다.
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const response = NextResponse.redirect(`${origin}/auth/login`);

  if (hasSupabaseBrowserConfig()) {
    const { url, anonKey } = getSupabaseConfig();
    const cookieStore = await cookies();

    const supabase = createServerClient(url!, anonKey!, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Handled via explicit response.cookies.set below
            }
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    await supabase.auth.signOut({ scope: "local" });
  }

  return response;
}


import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseServerConfig } from "@/lib/supabase/config";

/**
 * 로그아웃 처리.
 * 세션을 무효화하고 /auth/login 으로 리다이렉트한다.
 * Link href="/auth/logout" 으로 접근 (GET).
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  if (hasSupabaseServerConfig()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(`${origin}/auth/login`);
}

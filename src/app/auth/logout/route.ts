import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";

/**
 * Local sign-out only. After logout, always move to login landing.
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  if (hasSupabaseBrowserConfig()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
  }

  return NextResponse.redirect(`${origin}/auth/login`);
}


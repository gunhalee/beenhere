"use client";

import { clearMyProfileCache, clearProfileCache } from "@/lib/api/profile-client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type GoogleOAuthIntent = "login" | "link-google";

type StartGoogleOAuthInput = {
  intent: GoogleOAuthIntent;
  nextPath?: string;
};

type StartGoogleOAuthResult =
  | { ok: true }
  | { ok: false; error: string };

function sanitizeNextPath(nextPath?: string): string {
  if (!nextPath) return "/";
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) return "/";
  return nextPath;
}

function buildCallbackUrl(input: StartGoogleOAuthInput): string {
  const callbackUrl = new URL("/auth/callback", window.location.origin);
  callbackUrl.searchParams.set("intent", input.intent);
  callbackUrl.searchParams.set("next", sanitizeNextPath(input.nextPath));
  return callbackUrl.toString();
}

export async function startGoogleOAuth(
  input: StartGoogleOAuthInput,
): Promise<StartGoogleOAuthResult> {
  clearMyProfileCache();
  clearProfileCache();

  const redirectTo = buildCallbackUrl(input);
  const supabase = getSupabaseBrowserClient();

  if (input.intent === "link-google") {
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

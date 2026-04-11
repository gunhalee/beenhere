const GOOGLE_OAUTH_INTENTS = ["login"] as const;

export type GoogleOAuthIntent = (typeof GOOGLE_OAUTH_INTENTS)[number];

export function isGoogleOAuthIntent(value: unknown): value is GoogleOAuthIntent {
  return (
    typeof value === "string" &&
    (GOOGLE_OAUTH_INTENTS as readonly string[]).includes(value)
  );
}

export function sanitizeNextPath(nextPath?: string | null): string {
  if (!nextPath) return "/";
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) return "/";
  return nextPath;
}

export function buildGoogleCallbackUrl(input: {
  origin: string;
  intent: GoogleOAuthIntent;
  nextPath?: string | null;
}) {
  const callbackUrl = new URL("/auth/callback", input.origin);
  callbackUrl.searchParams.set("intent", input.intent);
  callbackUrl.searchParams.set("next", sanitizeNextPath(input.nextPath));
  return callbackUrl.toString();
}

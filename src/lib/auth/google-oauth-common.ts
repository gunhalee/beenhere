const GOOGLE_OAUTH_INTENTS = ["login", "link-google"] as const;
export const GUEST_USER_ID_PARAM = "guest_user_id";

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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function sanitizeGuestUserId(value?: string | null) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) return null;
  return normalized;
}

export function buildGoogleCallbackUrl(input: {
  origin: string;
  intent: GoogleOAuthIntent;
  nextPath?: string | null;
  guestUserId?: string | null;
}) {
  const callbackUrl = new URL("/auth/callback", input.origin);
  callbackUrl.searchParams.set("intent", input.intent);
  callbackUrl.searchParams.set("next", sanitizeNextPath(input.nextPath));
  const guestUserId = sanitizeGuestUserId(input.guestUserId);
  if (guestUserId) {
    callbackUrl.searchParams.set(GUEST_USER_ID_PARAM, guestUserId);
  }
  return callbackUrl.toString();
}

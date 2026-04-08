function capitalizeToken(token: string): string {
  if (!token) return token;

  const first = token.slice(0, 1).toUpperCase();
  const rest = token.slice(1);

  if (token === token.toLowerCase() || token === token.toUpperCase()) {
    return first + rest.toLowerCase();
  }

  return first + rest;
}

/**
 * Convert service nicknames like "amber_river" to "Amber River" for display.
 * Storage format is unchanged; this is presentation-only.
 */
export function formatNicknameForDisplay(nickname: string | null | undefined): string {
  if (!nickname) return "";

  const normalized = nickname
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (!normalized) return "";

  return normalized
    .split(" ")
    .map(capitalizeToken)
    .join(" ");
}


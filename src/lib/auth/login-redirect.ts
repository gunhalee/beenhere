import { sanitizeNextPath } from "./google-oauth-common";

const AUTH_LOGIN_PATH = "/auth/login";
const AUTH_CALLBACK_PATH = "/auth/callback";

function isAuthLandingPath(pathname: string) {
  return pathname === AUTH_LOGIN_PATH || pathname === AUTH_CALLBACK_PATH;
}

export function buildLoginPathWithNext(nextPath: string) {
  const safeNextPath = sanitizeNextPath(nextPath);
  return `${AUTH_LOGIN_PATH}?next=${encodeURIComponent(safeNextPath)}`;
}

export function redirectToLoginWithNext(nextPath?: string) {
  if (typeof window === "undefined") return;
  if (isAuthLandingPath(window.location.pathname)) return;

  const fallbackCurrentPath = `${window.location.pathname}${window.location.search}`;
  const destination = buildLoginPathWithNext(nextPath ?? fallbackCurrentPath);
  window.location.assign(destination);
}

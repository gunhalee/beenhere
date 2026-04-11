import { sanitizeNextPath } from "./google-oauth-common";

const AUTH_LOGIN_PATH = "/auth/login";
const AUTH_CALLBACK_PATH = "/auth/callback";
const FORCE_LANDING_PARAM = "forceLanding";

function isAuthLandingPath(pathname: string) {
  return pathname === AUTH_LOGIN_PATH || pathname === AUTH_CALLBACK_PATH;
}

type LoginRedirectOptions = {
  forceLanding?: boolean;
};

export function buildLoginPathWithNext(
  nextPath: string,
  options?: LoginRedirectOptions,
) {
  const safeNextPath = sanitizeNextPath(nextPath);
  const searchParams = new URLSearchParams();
  searchParams.set("next", safeNextPath);
  if (options?.forceLanding) {
    searchParams.set(FORCE_LANDING_PARAM, "1");
  }
  return `${AUTH_LOGIN_PATH}?${searchParams.toString()}`;
}

export function redirectToLoginWithNext(
  nextPath?: string,
  options?: LoginRedirectOptions,
) {
  if (typeof window === "undefined") return;
  if (isAuthLandingPath(window.location.pathname)) return;

  const fallbackCurrentPath = `${window.location.pathname}${window.location.search}`;
  const destination = buildLoginPathWithNext(
    nextPath ?? fallbackCurrentPath,
    options,
  );
  window.location.assign(destination);
}

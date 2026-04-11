import { NextResponse, type NextRequest } from "next/server";
import { sanitizeNextPath } from "@/lib/auth/google-oauth-common";

const AUTH_LOGIN_PATH = "/auth/login";
const AUTH_CALLBACK_PATH = "/auth/callback";
const FORCE_LANDING_PARAM = "forceLanding";

function isApiPath(pathname: string) {
  return pathname.startsWith("/api");
}

function isPublicUnauthPath(pathname: string) {
  return pathname === AUTH_LOGIN_PATH || pathname === AUTH_CALLBACK_PATH;
}

function getCurrentPathWithSearch(request: NextRequest) {
  return `${request.nextUrl.pathname}${request.nextUrl.search}`;
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      ({ name }) =>
        name.includes("-auth-token") && !name.includes("code-verifier"),
    );
}

/**
 * Lightweight route guard.
 *
 * Token refresh is handled exclusively by the browser's GoTrueClient
 * (autoRefreshToken: true). The middleware does NOT create a Supabase
 * client or call getUser(), avoiding the refresh-token race condition
 * where the middleware and browser client compete for the same
 * single-use refresh token.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAuth = hasSupabaseAuthCookie(request);
  const forceLanding =
    request.nextUrl.searchParams.get(FORCE_LANDING_PARAM) === "1";

  if (pathname === AUTH_LOGIN_PATH && hasAuth && !forceLanding) {
    const nextPath = sanitizeNextPath(
      request.nextUrl.searchParams.get("next"),
    );
    return NextResponse.redirect(new URL(nextPath, request.url));
  }

  if (!hasAuth && !isApiPath(pathname) && !isPublicUnauthPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = AUTH_LOGIN_PATH;
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "next",
      sanitizeNextPath(getCurrentPathWithSearch(request)),
    );
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

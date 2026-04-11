import { createServerClient } from "@supabase/ssr";
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

function isLikelyRefreshRaceError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const normalizedText =
    `${(error as { code?: string }).code ?? ""} ${(error as { message?: string }).message ?? ""}`.toLowerCase();

  if (!normalizedText) return false;

  return (
    normalizedText.includes("refresh token") ||
    normalizedText.includes("invalid refresh token") ||
    normalizedText.includes("already used")
  );
}

function withSupabaseSessionHeaders(
  source: NextResponse,
  target: NextResponse,
) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });

  source.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    if (key.toLowerCase() === "content-length") return;
    target.headers.set(key, value);
  });

  return target;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip session checks in mock mode when Supabase is not configured.
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Keep middleware as the canonical server-side auth check.
  const userResult = await supabase.auth.getUser();
  const user = userResult.data.user;

  const { pathname } = request.nextUrl;
  const forceLanding =
    request.nextUrl.searchParams.get(FORCE_LANDING_PARAM) === "1";

  if (pathname === AUTH_LOGIN_PATH && user && !forceLanding) {
    const nextPath = sanitizeNextPath(request.nextUrl.searchParams.get("next"));
    const redirectResponse = NextResponse.redirect(new URL(nextPath, request.url));
    return withSupabaseSessionHeaders(response, redirectResponse);
  }

  const shouldAllowTransientAuthDesync =
    !user &&
    !isApiPath(pathname) &&
    !isPublicUnauthPath(pathname) &&
    hasSupabaseAuthCookie(request) &&
    isLikelyRefreshRaceError(userResult.error);

  if (shouldAllowTransientAuthDesync) {
    return response;
  }

  if (!user && !isApiPath(pathname) && !isPublicUnauthPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = AUTH_LOGIN_PATH;
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "next",
      sanitizeNextPath(getCurrentPathWithSearch(request)),
    );
    const redirectResponse = NextResponse.redirect(loginUrl);
    return withSupabaseSessionHeaders(response, redirectResponse);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

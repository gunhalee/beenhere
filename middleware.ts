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

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  // Snapshot BEFORE getUser() — if a concurrent request already consumed
  // the refresh token, getUser() triggers setAll() with session-deleting
  // cookies. We must be able to return a clean response in that case.
  const hadAuthCookie = hasSupabaseAuthCookie(request);
  const originalRequestHeaders = new Headers(request.headers);

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

  const userResult = await supabase.auth.getUser();
  const user = userResult.data.user;

  // When a refresh token race occurs (concurrent request already consumed
  // the token), @supabase/ssr calls setAll() with empty cookie values,
  // effectively deleting the session. DO NOT propagate these deletion
  // cookies — return a clean pass-through so the browser keeps its
  // existing session cookies intact. The successful concurrent request's
  // response will deliver the refreshed cookies.
  if (!user && hadAuthCookie && isLikelyRefreshRaceError(userResult.error)) {
    return NextResponse.next({
      request: { headers: originalRequestHeaders },
    });
  }

  const { pathname } = request.nextUrl;
  const forceLanding =
    request.nextUrl.searchParams.get(FORCE_LANDING_PARAM) === "1";

  if (pathname === AUTH_LOGIN_PATH && user && !forceLanding) {
    const nextPath = sanitizeNextPath(request.nextUrl.searchParams.get("next"));
    const redirectResponse = NextResponse.redirect(new URL(nextPath, request.url));
    return withSupabaseSessionHeaders(response, redirectResponse);
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

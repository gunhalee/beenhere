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

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase 미설정(mock 모드)이면 세션 갱신 없이 통과
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

  // 세션 갱신 (PKCE / refresh token 처리)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const forceLanding = request.nextUrl.searchParams.get(FORCE_LANDING_PARAM) === "1";

  if (pathname === AUTH_LOGIN_PATH && user && !forceLanding) {
    const nextPath = sanitizeNextPath(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(nextPath, request.url));
  }

  if (!user && !isApiPath(pathname) && !isPublicUnauthPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = AUTH_LOGIN_PATH;
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "next",
      sanitizeNextPath(getCurrentPathWithSearch(request)),
    );
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};


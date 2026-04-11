import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { getSupabaseConfig } from "./config";

/**
 * Server Component / Route Handler 에서 사용하는 Supabase 클라이언트.
 *
 * 인증 이중 경로:
 *  1차 — 미들웨어가 갱신한 쿠키 (쿠키 전파가 정상이면 동작)
 *  2차 — 클라이언트가 보낸 Authorization 헤더 (global.headers 로 설정)
 *
 * global.headers.Authorization 을 설정하면, 쿠키 세션이 없을 때
 * RLS 의 auth.uid() 가 해당 토큰의 sub 클레임으로 평가된다.
 * 쿠키 세션이 존재하면 Supabase 내부에서 쿠키 토큰이 우선한다.
 */
export async function createSupabaseServerClient() {
  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey) {
    throw new Error("Supabase server config is missing.");
  }

  const cookieStore = await cookies();
  const headerStore = await headers();
  const authorizationHeader = headerStore.get("authorization");

  return createServerClient(url, anonKey, {
    global: authorizationHeader
      ? { headers: { Authorization: authorizationHeader } }
      : undefined,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component 에서는 쿠키 set 불가 — middleware 가 담당
        }
      },
    },
  });
}

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function extractBearerToken(raw: string | null) {
  if (!raw) return null;
  const [scheme, token] = raw.split(" ", 2);
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * bearer 토큰 → 쿠키 세션 순서로 인증된 유저를 반환한다.
 *
 * 모든 Route Handler 에서 supabase.auth.getUser() 를 직접 호출하는
 * 대신 이 함수를 사용해야 한다.
 *
 * Authorization 헤더가 있으면 그것만으로 먼저 검증한다.
 * 이렇게 해야 서버가 쿠키 세션을 먼저 읽으면서 refresh token 을
 * 소비하지 않고, 브라우저 클라이언트와의 refresh 경합을 피할 수 있다.
 *
 * Authorization 헤더가 없을 때만 쿠키 세션으로 getUser() 를 호출한다.
 */
export async function getServerUser(supabase: ServerClient) {
  const requestHeaders = await headers();
  const token = extractBearerToken(requestHeaders.get("authorization"));

  if (token) {
    const bearerResult = await supabase.auth.getUser(token);
    if (bearerResult.data.user) return bearerResult.data.user;
    return null;
  }

  const cookieResult = await supabase.auth.getUser();
  if (cookieResult.error || !cookieResult.data.user) return null;
  return cookieResult.data.user;
}

/**
 * RLS 를 우회하는 서버 전용 관리자 클라이언트.
 * 운영자 조치(신고 처리, 게시물 숨김 등)에만 사용한다.
 * Route Handler 내부에서만 호출할 것.
 */
export async function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseConfig();

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin config is missing.");
  }

  const { createClient } = await import("@supabase/supabase-js");

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

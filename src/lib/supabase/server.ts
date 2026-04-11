import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { getSupabaseConfig } from "./config";

/**
 * Server Component / Route Handler 에서 사용하는 Supabase 클라이언트.
 *
 * 인증 경로:
 * 1차 — 미들웨어가 갱신한 쿠키 (Edge → Serverless 전파가 되면 동작)
 * 2차 — 클라이언트가 보낸 Authorization 헤더 (global.headers 로 설정)
 *
 * global.headers.Authorization 을 설정하면 RLS 의 auth.uid() 가
 * 해당 토큰의 sub 클레임으로 평가되어 DB 쿼리도 정상 동작한다.
 * 쿠키가 정상 전파된 경우에도 같은 유저이므로 충돌하지 않는다.
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

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";

/**
 * Server Component / Route Handler 에서 사용하는 Supabase 클라이언트.
 * 쿠키를 통해 사용자 세션을 읽고 갱신한다.
 *
 * 미들웨어가 매 요청마다 쿠키 기반 토큰 갱신을 담당하므로,
 * 이 클라이언트는 별도 Authorization 헤더 없이 쿠키만으로 인증한다.
 */
export async function createSupabaseServerClient() {
  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey) {
    throw new Error("Supabase server config is missing.");
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
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

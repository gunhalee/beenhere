"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

let _client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Client Component 에서 사용하는 Supabase 브라우저 클라이언트.
 * 싱글턴으로 관리하여 중복 인스턴스 생성을 방지한다.
 *
 * autoRefreshToken: false — 토큰 갱신은 미들웨어가 담당한다.
 * 브라우저 클라이언트가 자동 갱신을 시도하면 미들웨어가 이미
 * 소비한 refresh token 을 사용하게 되고, 실패 시
 * GoTrueClient._removeSession() 이 모든 세션 쿠키를 삭제한다.
 */
export function getSupabaseBrowserClient() {
  if (_client) return _client;

  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey) {
    throw new Error("Supabase browser config is missing.");
  }

  _client = createBrowserClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
    },
  });
  return _client;
}

"use client";

import { createBrowserClient } from "@supabase/ssr";
import { parse as parseCookie, serialize as serializeCookie } from "cookie";
import { getSupabaseConfig } from "./config";

let _client: ReturnType<typeof createBrowserClient> | null = null;

function isAuthTokenCookie(name: string) {
  return name.includes("-auth-token");
}

/**
 * Client Component 에서 사용하는 Supabase 브라우저 클라이언트.
 * 싱글턴으로 관리하여 중복 인스턴스 생성을 방지한다.
 *
 * autoRefreshToken 은 켜두되, 커스텀 setAll 로 쿠키 삭제를 차단한다.
 *
 * GoTrueClient._recoverAndRefresh() 가 미들웨어와 refresh token 을
 * 경합하면 _callRefreshToken() 이 실패하고 _removeSession() 이
 * setAll([ { name, value: "", maxAge: 0 } ]) 로 쿠키를 삭제한다.
 * 커스텀 setAll 은 이 삭제 요청을 무시하여 쿠키를 보존한다.
 * 정상적인 세션 갱신(value 가 비어있지 않은 경우)은 그대로 동작한다.
 */
export function getSupabaseBrowserClient() {
  if (_client) return _client;

  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey) {
    throw new Error("Supabase browser config is missing.");
  }

  _client = createBrowserClient(url, anonKey, {
    cookies: {
      getAll() {
        const parsed = parseCookie(document.cookie);
        return Object.keys(parsed).map((name) => ({
          name,
          value: parsed[name] ?? "",
        }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          if (!value && isAuthTokenCookie(name)) {
            return;
          }
          document.cookie = serializeCookie(name, value, options);
        });
      },
    },
  });
  return _client;
}

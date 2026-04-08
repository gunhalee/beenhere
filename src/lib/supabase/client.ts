"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

let _client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Client Component 에서 사용하는 Supabase 브라우저 클라이언트.
 * 싱글턴으로 관리하여 중복 인스턴스 생성을 방지한다.
 */
export function getSupabaseBrowserClient() {
  if (_client) return _client;

  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey) {
    throw new Error("Supabase browser config is missing.");
  }

  _client = createBrowserClient(url, anonKey);
  return _client;
}

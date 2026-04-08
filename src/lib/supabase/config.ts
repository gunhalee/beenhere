type SupabaseConfig = {
  url: string | null;
  anonKey: string | null;
  serviceRoleKey: string | null;
};

export function getSupabaseConfig(): SupabaseConfig {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
  };
}

/** 서버 사이드 Supabase 연산 가능 여부 */
export function hasSupabaseServerConfig(): boolean {
  const { url, serviceRoleKey } = getSupabaseConfig();
  return Boolean(url && serviceRoleKey);
}

/** 클라이언트 사이드 Supabase 연산 가능 여부 */
export function hasSupabaseBrowserConfig(): boolean {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey);
}

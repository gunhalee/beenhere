import type { ApiResult } from "@/types/api";
import { API_ERROR_CODE } from "./common-errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const DEFAULT_TIMEOUT_MS = 8000;

type FetchOptions = {
  method?: "GET" | "POST" | "DELETE" | "PATCH";
  body?: unknown;
  timeoutMs?: number;
  timeoutErrorMessage?: string;
  timeoutCode?: string;
};

async function getAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * 클라이언트 사이드 API 호출 헬퍼.
 *
 * 인증은 브라우저 쿠키 + Authorization 헤더 이중 경로로 처리한다.
 * - 쿠키: 미들웨어가 갱신한 세션 (주 경로)
 * - Authorization: 브라우저 세션의 access token (폴백)
 *
 * 서버의 Supabase 클라이언트는 global.headers 를 설정하지 않으므로
 * RLS 쿼리는 쿠키 기반으로 동작하고, Authorization 헤더는
 * getAuthenticatedUser() 의 폴백에서만 사용된다.
 *
 * 401 응답 시 리다이렉트를 하지 않는다 — 각 호출측이
 * 컨텍스트에 맞게 처리한다.
 */
export async function fetchApi<T>(
  path: string,
  options: FetchOptions = {},
): Promise<ApiResult<T>> {
  const {
    method = "GET",
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    timeoutErrorMessage = "요청 시간이 초과됐습니다.",
    timeoutCode = API_ERROR_CODE.TIMEOUT,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const accessToken = await getAccessToken();

    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(path, {
      method,
      headers: Object.keys(headers).length ? headers : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    return (await response.json()) as ApiResult<T>;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: timeoutErrorMessage, code: timeoutCode };
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
      code: API_ERROR_CODE.NETWORK_ERROR,
    };
  } finally {
    clearTimeout(timer);
  }
}

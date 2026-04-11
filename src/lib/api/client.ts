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

async function syncBrowserSession() {
  if (typeof window === "undefined") return;

  const supabase = getSupabaseBrowserClient();

  // getUser() forces the auth client to reconcile the current session
  // with Supabase Auth instead of trusting only locally cached state.
  // This reduces cases where getSession() returns a stale access token
  // that the server rejects immediately.
  await supabase.auth.getUser();
}

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
 * 서버의 createSupabaseServerClient() 는 Authorization 헤더가 있으면
 * global.headers 에 설정하여 RLS 쿼리에도 적용하고,
 * getServerUser() 에서 쿠키 실패 시 bearer 폴백으로 사용한다.
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
    const requestOnce = async () => {
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
    };

    await syncBrowserSession();

    const firstResult = await requestOnce();
    if (
      !firstResult.ok &&
      firstResult.code === API_ERROR_CODE.UNAUTHORIZED &&
      typeof window !== "undefined"
    ) {
      try {
        await syncBrowserSession();
        return await requestOnce();
      } catch {
        return firstResult;
      }
    }

    return firstResult;
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

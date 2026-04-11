import type { ApiResult } from "@/types/api";
import { API_ERROR_CODE } from "./common-errors";

const DEFAULT_TIMEOUT_MS = 8000;

type FetchOptions = {
  method?: "GET" | "POST" | "DELETE" | "PATCH";
  body?: unknown;
  timeoutMs?: number;
  timeoutErrorMessage?: string;
  timeoutCode?: string;
};

/**
 * 클라이언트 사이드 API 호출 헬퍼.
 *
 * 인증은 브라우저 쿠키로만 처리한다.
 * 미들웨어가 매 요청 전에 쿠키 기반 토큰을 갱신하므로,
 * 클라이언트에서 별도로 Authorization 헤더를 보내지 않는다.
 *
 * 401 응답 시 리다이렉트를 하지 않는다 — 각 호출측이
 * 컨텍스트에 맞게 처리한다 (재시도, 에러 표시, 로그인 리다이렉트 등).
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
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
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

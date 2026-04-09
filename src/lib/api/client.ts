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
 * - 기본 8초 timeout
 * - ok/fail 응답 구조 유지
 * - raw fetch 대신 이 함수를 우선 사용한다 (maintenance guide 5-2)
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
    const response = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const json = (await response.json()) as ApiResult<T>;
    return json;
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

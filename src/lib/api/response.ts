import { NextResponse } from "next/server";
import type { ApiOk, ApiErr, ApiErrorDetails } from "@/types/api";

/** 성공 응답 */
export function ok<T>(data: T, status = 200): NextResponse<ApiOk<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

/** 실패 응답 */
export function fail(
  error: string,
  status = 400,
  code?: string,
  details?: ApiErrorDetails,
): NextResponse<ApiErr> {
  return NextResponse.json(
    {
      ok: false,
      error,
      ...(code ? { code } : {}),
      ...(details ? { details } : {}),
    },
    { status },
  );
}

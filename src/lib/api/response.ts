import { NextResponse } from "next/server";
import type { ApiOk, ApiErr } from "@/types/api";

/** 성공 응답 */
export function ok<T>(data: T, status = 200): NextResponse<ApiOk<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

/** 실패 응답 */
export function fail(
  error: string,
  status = 400,
  code?: string,
): NextResponse<ApiErr> {
  return NextResponse.json({ ok: false, error, ...(code ? { code } : {}) }, { status });
}

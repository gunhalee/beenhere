import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type PendingCookie = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

/**
 * Route Handler 전용 쿠키 브리지.
 *
 * @supabase/ssr 는 auth state 변화마다 setAll() 을 여러 번 호출할 수 있다.
 * 청크 세션 쿠키(auth-token.0, .1, ...)가 여러 호출에 걸쳐 나뉘어 와도
 * cookie name 기준으로 최신값을 누적하고, 응답 직전에 한 번에 반영한다.
 */
export async function createRouteCookieBridge() {
  const cookieStore = await cookies();
  const pendingCookies = new Map<string, PendingCookie>();

  return {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet: PendingCookie[]) {
      cookiesToSet.forEach(({ name, value, options }) => {
        pendingCookies.set(name, { name, value, options });
        try {
          cookieStore.set(name, value, options);
        } catch {
          // Route Handler outside mutable response scope.
        }
      });
    },
    applyToResponse(response: NextResponse) {
      for (const { name, value, options } of pendingCookies.values()) {
        response.cookies.set(name, value, options);
      }
      return response;
    },
  };
}

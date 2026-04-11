"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { redirectToLoginWithNext } from "@/lib/auth/login-redirect";
import { clearMyProfileCache, clearProfileCache } from "@/lib/api/profile-client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const AUTH_LOGIN_PATH = "/auth/login";
const AUTH_CALLBACK_PATH = "/auth/callback";

function listSupabaseAuthCookieNames() {
  return document.cookie
    .split(";")
    .map((part) => part.trim().split("=")[0] ?? "")
    .filter(
      (name) =>
        name.includes("-auth-token") || name.includes("code-verifier"),
    );
}

function clearCookieByName(name: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
}

/**
 * 브라우저 세션 복원 bootstrap.
 *
 * auth-token 청크 쿠키가 남아 있는데도 getSession()/getUser() 가 모두
 * 실패하면, 세션 청크가 깨진 상태로 간주한다. 이 경우 stale 쿠키를
 * 제거하고 로그인 화면으로 되돌려 이중 세션 해석을 줄인다.
 */
export function AuthSessionBootstrap() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (pathname === AUTH_CALLBACK_PATH) return;

      const authCookieNames = listSupabaseAuthCookieNames();
      if (authCookieNames.length === 0) return;

      const supabase = getSupabaseBrowserClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || session) return;

      const userResult = await supabase.auth.getUser();
      if (cancelled || userResult.data.user) return;

      clearMyProfileCache();
      clearProfileCache();
      authCookieNames.forEach(clearCookieByName);

      if (pathname !== AUTH_LOGIN_PATH) {
        redirectToLoginWithNext(undefined, { forceLanding: true });
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}

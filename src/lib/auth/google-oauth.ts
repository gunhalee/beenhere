"use client";

import { clearMyProfileCache, clearProfileCache } from "@/lib/api/profile-client";
import { fetchApi } from "@/lib/api/client";
import {
  type GoogleOAuthIntent,
  sanitizeNextPath,
} from "@/lib/auth/google-oauth-common";

type StartGoogleOAuthInput = {
  intent: GoogleOAuthIntent;
  nextPath?: string;
};

type StartGoogleOAuthResult =
  | { ok: true }
  | { ok: false; error: string };

type StartGoogleOAuthApiResponse = {
  url: string;
};

export async function startGoogleOAuth(
  input: StartGoogleOAuthInput,
): Promise<StartGoogleOAuthResult> {
  clearMyProfileCache();
  clearProfileCache();

  const apiResult = await fetchApi<StartGoogleOAuthApiResponse>(
    "/api/auth/google/start",
    {
      method: "POST",
      body: {
        intent: input.intent,
        nextPath: sanitizeNextPath(input.nextPath),
      },
      timeoutMs: 5000,
      timeoutErrorMessage: "Google 인증 시작이 지연되고 있어요.",
    },
  );

  if (!apiResult.ok) {
    return {
      ok: false,
      error: apiResult.error ?? "Google 인증을 시작하지 못했어요.",
    };
  }

  if (typeof window === "undefined") {
    return {
      ok: false,
      error: "브라우저 환경에서만 Google 인증을 시작할 수 있어요.",
    };
  }

  const redirectUrl = apiResult.data.url;
  if (!redirectUrl) {
    return {
      ok: false,
      error: "Google 인증 URL을 받지 못했어요.",
    };
  }

  window.location.assign(redirectUrl);
  return { ok: true };
}

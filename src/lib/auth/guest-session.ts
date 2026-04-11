"use client";

import { clearMyProfileCache, clearProfileCache } from "@/lib/api/profile-client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const DEVICE_ID_STORAGE_KEY = "beenhere.device_id";
const GUEST_REFRESH_TOKEN_STORAGE_KEY = "beenhere.guest_refresh_token";

type EnsureGuestSessionResult =
  | { ok: true; userId: string; restored: boolean }
  | { ok: false; error: string };

type SessionLike = {
  refresh_token?: string | null;
  user: {
    id: string;
    is_anonymous?: boolean;
  };
};

type EnsureGuestSessionWithRetryOptions = {
  maxAttempts?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  jitterMs?: number;
};

const DEFAULT_RETRY_OPTIONS: Required<EnsureGuestSessionWithRetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 300,
  backoffFactor: 3,
  jitterMs: 120,
};

let inFlightBootstrap: Promise<EnsureGuestSessionResult> | null = null;

async function touchGuestLastActive(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  input: { userId: string; isAnonymous: boolean },
) {
  if (!input.isAnonymous) return;
  if (typeof (supabase as { rpc?: unknown }).rpc !== "function") return;

  const { error } = await supabase.rpc("touch_profile_activity", {
    p_user_id: input.userId,
    p_is_anonymous: true,
  });

  if (!error) {
    return;
  }

  console.warn("[guest-session] failed to touch guest last_active_at", error);
}

async function ensureProfileBootstrap() {
  try {
    const response = await fetch("/api/profiles/me", {
      method: "GET",
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
    };

    if (payload?.ok) {
      return { ok: true } as const;
    }

    return {
      ok: false,
      error:
        payload?.error ??
        "Guest profile is not ready yet. Please try again.",
    } as const;
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Guest profile setup failed. Please try again.",
    } as const;
  }
}

async function finalizeSession(input: {
  supabase: ReturnType<typeof getSupabaseBrowserClient>;
  session: SessionLike;
  restored: boolean;
}) {
  const isAnonymous = Boolean(input.session.user.is_anonymous);
  if (isAnonymous && input.session.refresh_token) {
    saveGuestSession({
      refreshToken: input.session.refresh_token,
      userId: input.session.user.id,
    });
  } else {
    clearPersistedGuestSession();
  }

  clearMyProfileCache();
  clearProfileCache();

  const profileBootstrap = await ensureProfileBootstrap();
  if (!profileBootstrap.ok) {
    return {
      ok: false,
      error: profileBootstrap.error,
    } as const;
  }

  await touchGuestLastActive(input.supabase, {
    userId: input.session.user.id,
    isAnonymous,
  });

  return {
    ok: true,
    userId: input.session.user.id,
    restored: input.restored,
  } as const;
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function readStorage(key: string) {
  if (!canUseLocalStorage()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Intentionally ignored; guest login should still proceed without persistence.
  }
}

function removeStorage(key: string) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage removal failures.
  }
}

function generateDeviceId() {
  const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (randomUUID) {
    return randomUUID();
  }

  return `device_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getOrCreateDeviceId() {
  const existing = readStorage(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;

  const next = generateDeviceId();
  writeStorage(DEVICE_ID_STORAGE_KEY, next);
  return next;
}

function readGuestRefreshToken() {
  return readStorage(GUEST_REFRESH_TOKEN_STORAGE_KEY);
}

function saveGuestSession(input: { refreshToken: string; userId: string }) {
  writeStorage(GUEST_REFRESH_TOKEN_STORAGE_KEY, input.refreshToken);
}

export function clearPersistedGuestSession() {
  removeStorage(GUEST_REFRESH_TOKEN_STORAGE_KEY);
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function computeRetryDelay(
  attemptIndex: number,
  options: Required<EnsureGuestSessionWithRetryOptions>,
) {
  const exponentialDelay = options.initialDelayMs * options.backoffFactor ** attemptIndex;
  const jitter = Math.floor(Math.random() * (options.jitterMs + 1));
  return exponentialDelay + jitter;
}

export async function ensureGuestSession(): Promise<EnsureGuestSessionResult> {
  const supabase = getSupabaseBrowserClient();
  const deviceId = getOrCreateDeviceId();

  const {
    data: { session: currentSession },
  } = await supabase.auth.getSession();

  if (currentSession?.user) {
    return finalizeSession({
      supabase,
      session: currentSession,
      restored: false,
    });
  }

  const storedRefreshToken = readGuestRefreshToken();
  if (storedRefreshToken) {
    const restored = await supabase.auth.refreshSession({
      refresh_token: storedRefreshToken,
    });

    if (!restored.error && restored.data.session?.user) {
      return finalizeSession({
        supabase,
        session: restored.data.session,
        restored: true,
      });
    }

    clearPersistedGuestSession();
  }

  const created = await supabase.auth.signInAnonymously({
    options: {
      data: {
        device_id: deviceId,
      },
    },
  });

  if (created.error || !created.data.session?.user) {
    return {
      ok: false,
      error: created.error?.message ?? "게스트 로그인에 실패했어요. 다시 시도해 주세요.",
    };
  }

  return finalizeSession({
    supabase,
    session: created.data.session,
    restored: false,
  });
}

async function ensureGuestSessionWithRetry(
  options?: EnsureGuestSessionWithRetryOptions,
): Promise<EnsureGuestSessionResult> {
  const resolvedOptions = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  let lastError = "게스트 세션을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.";

  for (let attempt = 0; attempt < resolvedOptions.maxAttempts; attempt += 1) {
    const result = await ensureGuestSession();
    if (result.ok) {
      return result;
    }

    lastError = result.error;
    const isLastAttempt = attempt === resolvedOptions.maxAttempts - 1;
    if (isLastAttempt) {
      break;
    }

    const delayMs = computeRetryDelay(attempt, resolvedOptions);
    await sleep(delayMs);
  }

  return { ok: false, error: lastError };
}

export async function bootstrapGuestSession(
  options?: EnsureGuestSessionWithRetryOptions,
) {
  if (inFlightBootstrap) {
    return inFlightBootstrap;
  }

  inFlightBootstrap = ensureGuestSessionWithRetry(options).finally(() => {
    inFlightBootstrap = null;
  });

  return inFlightBootstrap;
}

"use client";

import { clearMyProfileCache, clearProfileCache } from "@/lib/api/profile-client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const DEVICE_ID_STORAGE_KEY = "beenhere.device_id";
const GUEST_REFRESH_TOKEN_STORAGE_KEY = "beenhere.guest_refresh_token";
const GUEST_USER_ID_STORAGE_KEY = "beenhere.guest_user_id";

type EnsureGuestSessionResult =
  | { ok: true; userId: string; restored: boolean }
  | { ok: false; error: string };

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

function isActivityRpcCompatibilityMissing(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === "PGRST202" || error.code === "42883" || error.code === "42P01") {
    return true;
  }
  return /touch_profile_activity/i.test(error.message ?? "");
}

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

  if (!error || isActivityRpcCompatibilityMissing(error)) {
    return;
  }

  console.warn("[guest-session] failed to touch guest last_active_at", error);
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
  writeStorage(GUEST_USER_ID_STORAGE_KEY, input.userId);
}

// Public accessor used by auth handoff flows.
export function readLastGuestUserID() {
  return readStorage(GUEST_USER_ID_STORAGE_KEY);
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
    if (currentSession.refresh_token && currentSession.user.is_anonymous) {
      saveGuestSession({
        refreshToken: currentSession.refresh_token,
        userId: currentSession.user.id,
      });
    }
    await touchGuestLastActive(supabase, {
      userId: currentSession.user.id,
      isAnonymous: Boolean(currentSession.user.is_anonymous),
    });
    return { ok: true, userId: currentSession.user.id, restored: false };
  }

  const storedRefreshToken = readGuestRefreshToken();
  if (storedRefreshToken) {
    const restored = await supabase.auth.refreshSession({
      refresh_token: storedRefreshToken,
    });

    if (!restored.error && restored.data.session?.user) {
      const restoredSession = restored.data.session;
      saveGuestSession({
        refreshToken: restoredSession.refresh_token,
        userId: restoredSession.user.id,
      });
      clearMyProfileCache();
      clearProfileCache();
      await touchGuestLastActive(supabase, {
        userId: restoredSession.user.id,
        isAnonymous: Boolean(restoredSession.user.is_anonymous),
      });
      return { ok: true, userId: restoredSession.user.id, restored: true };
    }
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

  saveGuestSession({
    refreshToken: created.data.session.refresh_token,
    userId: created.data.session.user.id,
  });
  clearMyProfileCache();
  clearProfileCache();
  await touchGuestLastActive(supabase, {
    userId: created.data.session.user.id,
    isAnonymous: Boolean(created.data.session.user.is_anonymous),
  });

  return { ok: true, userId: created.data.session.user.id, restored: false };
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

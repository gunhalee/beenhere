"use client";

import { clearMyProfileCache, clearProfileCache } from "@/lib/api/profile-client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const DEVICE_ID_STORAGE_KEY = "beenhere.device_id";
const GUEST_REFRESH_TOKEN_STORAGE_KEY = "beenhere.guest_refresh_token";
const GUEST_USER_ID_STORAGE_KEY = "beenhere.guest_user_id";

type EnsureGuestSessionResult =
  | { ok: true; userId: string; restored: boolean }
  | { ok: false; error: string };

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

export function readLastGuestUserId() {
  return readStorage(GUEST_USER_ID_STORAGE_KEY);
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

  return { ok: true, userId: created.data.session.user.id, restored: false };
}

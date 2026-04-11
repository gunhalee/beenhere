"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  clearMyProfileCache,
  clearProfileCache,
  regenNicknameClient,
  updateMyProfileCacheNickname,
} from "@/lib/api/profile-client";
import { API_ERROR_CODE } from "@/lib/api/common-errors";
import { daysUntilNicknameRegen } from "@/lib/nickname/generate";

type Props = {
  nickname: string;
  isMyProfile: boolean;
  nicknameChangedAt?: string | null;
  onBlockClick?: () => void;
  onNicknameChange?: (newNickname: string, nicknameChangedAt: string) => void;
  onAuthRequired?: () => void;
};

function readDaysRemaining(details: unknown): number | null {
  if (!details || typeof details !== "object") return null;
  const days = (details as { daysRemaining?: unknown }).daysRemaining;
  if (typeof days !== "number" || !Number.isFinite(days) || days < 1) return null;
  return Math.ceil(days);
}

export function ProfileHeader({
  nickname,
  isMyProfile,
  nicknameChangedAt = null,
  onBlockClick,
  onNicknameChange,
  onAuthRequired,
}: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const daysUntilRegen = daysUntilNicknameRegen(nicknameChangedAt);
  const canRegenNickname = daysUntilRegen === 0;

  async function handleRegenNickname() {
    if (regenLoading) return;
    if (!canRegenNickname) {
      setRegenError(`프로필 이름은 ${daysUntilRegen}일 후 변경할 수 있어요.`);
      return;
    }

    setRegenLoading(true);
    setRegenError(null);

    const result = await regenNicknameClient();
    setRegenLoading(false);

    if (!result.ok) {
      if (result.code === API_ERROR_CODE.UNAUTHORIZED) {
        onAuthRequired?.();
        return;
      }

      const daysRemaining = readDaysRemaining(result.details);
      if (result.code === API_ERROR_CODE.COOLDOWN_ACTIVE && daysRemaining !== null) {
        setRegenError(`프로필 이름은 ${daysRemaining}일 후 변경할 수 있어요.`);
        return;
      }

      setRegenError(result.error ?? "프로필 이름을 변경하지 못했어요.");
      return;
    }

    updateMyProfileCacheNickname({
      nickname: result.data.nickname,
      nicknameChangedAt: result.data.nicknameChangedAt,
    });
    onNicknameChange?.(result.data.nickname, result.data.nicknameChangedAt);
  }

  return (
    <header
      style={{
        backdropFilter: "blur(10px)",
        background: "rgba(255, 255, 255, 0.95)",
        borderBottom: "1px solid rgba(17, 24, 39, 0.06)",
        padding: "calc(env(safe-area-inset-top, 0px) + 14px) 20px 14px",
        position: "sticky",
        top: 0,
        zIndex: 4,
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: "12px",
          justifyContent: "space-between",
        }}
      >
        <button
          aria-label="뒤로"
          onClick={() => router.back()}
          type="button"
          style={{
            appearance: "none",
            background: "none",
            border: "none",
            color: "#374151",
            cursor: "pointer",
            fontSize: "20px",
            flexShrink: 0,
            lineHeight: 1,
            padding: "4px",
          }}
        >
          ←
        </button>

        <h1
          style={{
            color: "#111827",
            flex: 1,
            fontSize: "15px",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            margin: 0,
            overflow: "hidden",
            textAlign: "center",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {nickname}
        </h1>

        <div style={{ position: "relative" }}>
          <button
            aria-label="메뉴"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            type="button"
            style={{
              appearance: "none",
              background: "none",
              border: "none",
              color: "#6b7280",
              cursor: "pointer",
              fontSize: "20px",
              lineHeight: 1,
              padding: "4px",
            }}
          >
            ⋯
          </button>

          {menuOpen ? (
            <>
              <button
                aria-label="메뉴 닫기"
                onClick={() => setMenuOpen(false)}
                type="button"
                style={{
                  appearance: "none",
                  background: "transparent",
                  border: "none",
                  cursor: "default",
                  inset: 0,
                  padding: 0,
                  position: "fixed",
                  zIndex: 10,
                }}
              />
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  boxShadow: "0 8px 24px rgba(17, 24, 39, 0.12)",
                  minWidth: "170px",
                  overflow: "hidden",
                  position: "absolute",
                  right: 0,
                  top: "36px",
                  zIndex: 11,
                }}
              >
                {isMyProfile ? (
                  <>
                    <button
                      disabled={regenLoading || !canRegenNickname}
                      onClick={() => {
                        setMenuOpen(false);
                        void handleRegenNickname();
                      }}
                      type="button"
                      style={{
                        appearance: "none",
                        background: "none",
                        border: "none",
                        borderBottom: "1px solid #f3f4f6",
                        color: regenLoading || !canRegenNickname ? "#9ca3af" : "#111827",
                        cursor: regenLoading || !canRegenNickname ? "default" : "pointer",
                        fontSize: "14px",
                        fontWeight: 500,
                        padding: "12px 16px",
                        textAlign: "left",
                        width: "100%",
                      }}
                    >
                      {regenLoading
                        ? "변경 중..."
                        : canRegenNickname
                          ? "프로필 이름 변경"
                          : `프로필 이름 변경 (${daysUntilRegen}일)`}
                    </button>
                    <Link
                      href="/auth/logout"
                      onClick={() => {
                        clearMyProfileCache();
                        clearProfileCache();
                      }}
                      style={{
                        color: "#ef4444",
                        display: "block",
                        fontSize: "14px",
                        fontWeight: 500,
                        padding: "12px 16px",
                        textDecoration: "none",
                      }}
                    >
                      로그아웃
                    </Link>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onBlockClick?.();
                    }}
                    type="button"
                    style={{
                      appearance: "none",
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: 500,
                      padding: "12px 16px",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    차단하기
                  </button>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {regenError ? (
        <p
          style={{
            color: "#ef4444",
            fontSize: "12px",
            margin: "8px 0 0",
            textAlign: "center",
          }}
        >
          {regenError}
        </p>
      ) : null}
    </header>
  );
}

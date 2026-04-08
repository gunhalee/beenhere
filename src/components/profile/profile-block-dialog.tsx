"use client";

import { useState } from "react";
import { blockUserClient } from "@/lib/api/profile-client";

type Props = {
  targetNickname: string;
  targetUserId: string;
  onBlocked: () => void;
  onClose: () => void;
};

export function ProfileBlockDialog({
  targetNickname,
  targetUserId,
  onBlocked,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (loading) return;
    setLoading(true);
    setError(null);

    const result = await blockUserClient(targetUserId);

    if (!result.ok) {
      setLoading(false);
      setError(result.error ?? "차단에 실패했어요. 다시 시도해 주세요.");
      return;
    }

    onBlocked();
  }

  return (
    <>
      {/* 백드롭 */}
      <button
        aria-label="닫기"
        onClick={onClose}
        type="button"
        style={{
          appearance: "none",
          background: "rgba(17, 24, 39, 0.4)",
          border: "none",
          cursor: "default",
          inset: 0,
          padding: 0,
          position: "fixed",
          zIndex: 20,
        }}
      />

      {/* 다이얼로그 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="차단 확인"
        style={{
          background: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 16px 48px rgba(17, 24, 39, 0.2)",
          left: "50%",
          maxWidth: "340px",
          padding: "24px",
          position: "fixed",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "calc(100% - 40px)",
          zIndex: 21,
        }}
      >
        <p
          style={{
            color: "#111827",
            fontSize: "16px",
            fontWeight: 700,
            margin: "0 0 8px",
            textAlign: "center",
          }}
        >
          {targetNickname}님을 차단할까요?
        </p>
        <p
          style={{
            color: "#6b7280",
            fontSize: "13px",
            lineHeight: 1.6,
            margin: "0 0 24px",
            textAlign: "center",
          }}
        >
          서로의 글과 프로필이 보이지 않아요.
          <br />
          차단 후 이 프로필을 떠납니다.
        </p>

        {error ? (
          <p
            style={{
              color: "#ef4444",
              fontSize: "12px",
              margin: "0 0 12px",
              textAlign: "center",
            }}
          >
            {error}
          </p>
        ) : null}

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            disabled={loading}
            onClick={onClose}
            type="button"
            style={{
              appearance: "none",
              background: "#f3f4f6",
              border: "none",
              borderRadius: "12px",
              color: "#374151",
              cursor: "pointer",
              flex: 1,
              fontSize: "14px",
              fontWeight: 600,
              padding: "12px",
            }}
          >
            취소
          </button>
          <button
            disabled={loading}
            onClick={handleConfirm}
            type="button"
            style={{
              appearance: "none",
              background: loading ? "#9ca3af" : "#ef4444",
              border: "none",
              borderRadius: "12px",
              color: "#ffffff",
              cursor: loading ? "default" : "pointer",
              flex: 1,
              fontSize: "14px",
              fontWeight: 600,
              padding: "12px",
            }}
          >
            {loading ? "처리 중…" : "차단하기"}
          </button>
        </div>
      </div>
    </>
  );
}

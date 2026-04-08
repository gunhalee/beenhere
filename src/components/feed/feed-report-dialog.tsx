"use client";

import { useState } from "react";
import type { ReportState } from "@/lib/hooks/use-post-actions";

const REASON_OPTIONS = [
  { code: "spam", label: "스팸 · 도배" },
  { code: "harassment", label: "괴롭힘 · 혐오 표현" },
  { code: "misinformation", label: "허위 정보" },
  { code: "other", label: "기타" },
] as const;

type Props = {
  reportState: ReportState;
  onConfirm: (reasonCode: string) => void;
  onClose: () => void;
};

export function FeedReportDialog({ reportState, onConfirm, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const { submitting, errorMessage, successMessage } = reportState;

  if (!reportState.postId) return null;

  function handleConfirm() {
    if (!selected || submitting) return;
    onConfirm(selected);
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
        aria-label="신고"
        style={{
          background: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 16px 48px rgba(17, 24, 39, 0.2)",
          left: "50%",
          maxWidth: "360px",
          padding: "24px",
          position: "fixed",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "calc(100% - 40px)",
          zIndex: 21,
        }}
      >
        {successMessage ? (
          <>
            <p
              style={{
                color: "#111827",
                fontSize: "15px",
                fontWeight: 600,
                margin: "0 0 8px",
                textAlign: "center",
              }}
            >
              신고가 접수됐어요
            </p>
            <p
              style={{
                color: "#6b7280",
                fontSize: "13px",
                lineHeight: 1.6,
                margin: "0 0 20px",
                textAlign: "center",
              }}
            >
              검토 후 적절한 조치를 취할게요.
            </p>
            <button
              onClick={onClose}
              type="button"
              style={{
                appearance: "none",
                background: "#111827",
                border: "none",
                borderRadius: "12px",
                color: "#ffffff",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 600,
                padding: "12px",
                width: "100%",
              }}
            >
              확인
            </button>
          </>
        ) : (
          <>
            <p
              style={{
                color: "#111827",
                fontSize: "15px",
                fontWeight: 700,
                margin: "0 0 16px",
              }}
            >
              신고 사유를 선택해 주세요
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                marginBottom: "20px",
              }}
            >
              {REASON_OPTIONS.map(({ code, label }) => (
                <label
                  key={code}
                  style={{
                    alignItems: "center",
                    background: selected === code ? "#f3f4f6" : "#f9fafb",
                    border: `1px solid ${selected === code ? "#d1d5db" : "#e5e7eb"}`,
                    borderRadius: "12px",
                    cursor: "pointer",
                    display: "flex",
                    gap: "10px",
                    padding: "12px 14px",
                  }}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={code}
                    checked={selected === code}
                    onChange={() => setSelected(code)}
                    style={{ accentColor: "#111827" }}
                  />
                  <span style={{ color: "#111827", fontSize: "14px" }}>
                    {label}
                  </span>
                </label>
              ))}
            </div>

            {errorMessage ? (
              <p
                style={{
                  color: "#ef4444",
                  fontSize: "12px",
                  margin: "0 0 12px",
                  textAlign: "center",
                }}
              >
                {errorMessage}
              </p>
            ) : null}

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={onClose}
                disabled={submitting}
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
                onClick={handleConfirm}
                disabled={!selected || submitting}
                type="button"
                style={{
                  appearance: "none",
                  background: selected && !submitting ? "#111827" : "#9ca3af",
                  border: "none",
                  borderRadius: "12px",
                  color: "#ffffff",
                  cursor: selected && !submitting ? "pointer" : "default",
                  flex: 1,
                  fontSize: "14px",
                  fontWeight: 600,
                  padding: "12px",
                }}
              >
                {submitting ? "신고 중..." : "신고하기"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

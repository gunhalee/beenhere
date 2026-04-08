"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { generateNicknameCandidates } from "@/lib/nickname/generate";
import { formatNicknameForDisplay } from "@/lib/nickname/format";
import { fetchApi } from "@/lib/api/client";

export default function OnboardingPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCandidates(generateNicknameCandidates(3));
  }, []);

  function refreshCandidates() {
    setCandidates(generateNicknameCandidates(3));
    setSelected(null);
    setError(null);
  }

  async function handleSubmit() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError(null);

    const result = await fetchApi<{ nickname: string }>("/api/profiles/me", {
      method: "POST",
      body: { nickname: selected },
    });

    if (!result.ok) {
      setError(result.error ?? "닉네임을 저장하지 못했어요. 다시 시도해 주세요.");
      setSubmitting(false);
      return;
    }

    router.replace("/");
  }

  return (
    <main
      style={{
        alignItems: "center",
        background: "#f9fafb",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        minHeight: "100dvh",
        padding: "24px 24px calc(env(safe-area-inset-bottom, 0px) + 40px)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "32px",
          maxWidth: "360px",
          width: "100%",
        }}
      >
        {/* 헤더 */}
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              color: "#6b7280",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.06em",
              margin: "0 0 10px",
              textTransform: "uppercase",
            }}
          >
            beenhere
          </p>
          <h1
            style={{
              color: "#111827",
              fontSize: "22px",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.3,
              margin: "0 0 8px",
            }}
          >
            닉네임을 골라보세요
          </h1>
          <p
            style={{
              color: "#9ca3af",
              fontSize: "13px",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            beenhere에서 사용할 이름이에요.
            <br />
            나중에 7일마다 바꿀 수 있어요.
          </p>
        </div>

        {/* 닉네임 후보 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {candidates.map((nick) => {
            const isSelected = selected === nick;
            return (
              <button
                key={nick}
                aria-pressed={isSelected}
                onClick={() => {
                  setSelected(nick);
                  setError(null);
                }}
                type="button"
                style={{
                  alignItems: "center",
                  appearance: "none",
                  background: isSelected ? "#111827" : "#ffffff",
                  border: `2px solid ${isSelected ? "#111827" : "#e5e7eb"}`,
                  borderRadius: "16px",
                  boxShadow: isSelected
                    ? "0 4px 12px rgba(17, 24, 39, 0.2)"
                    : "0 2px 6px rgba(17, 24, 39, 0.04)",
                  color: isSelected ? "#ffffff" : "#374151",
                  cursor: "pointer",
                  display: "flex",
                  fontSize: "17px",
                  fontWeight: 700,
                  justifyContent: "space-between",
                  letterSpacing: "-0.01em",
                  padding: "16px 20px",
                  transition: "all 0.12s",
                  width: "100%",
                }}
              >
                <span>{formatNicknameForDisplay(nick)}</span>
                {isSelected ? (
                  <span style={{ fontSize: "18px" }}>✓</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* 다시 생성 */}
        <button
          onClick={refreshCandidates}
          type="button"
          style={{
            alignItems: "center",
            appearance: "none",
            background: "none",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            color: "#6b7280",
            cursor: "pointer",
            display: "flex",
            fontSize: "13px",
            fontWeight: 500,
            gap: "6px",
            justifyContent: "center",
            padding: "10px",
            width: "100%",
          }}
        >
          <span style={{ fontSize: "15px" }}>↻</span>
          다른 닉네임 보기
        </button>

        {/* 에러 메시지 */}
        {error ? (
          <p
            role="alert"
            style={{
              color: "#ef4444",
              fontSize: "13px",
              margin: 0,
              textAlign: "center",
            }}
          >
            {error}
          </p>
        ) : null}

        {/* 시작 버튼 */}
        <button
          disabled={!selected || submitting}
          onClick={handleSubmit}
          type="button"
          style={{
            appearance: "none",
            background: selected && !submitting ? "#111827" : "#9ca3af",
            border: "none",
            borderRadius: "16px",
            boxShadow:
              selected && !submitting
                ? "0 4px 16px rgba(17, 24, 39, 0.24)"
                : "none",
            color: "#ffffff",
            cursor: selected && !submitting ? "pointer" : "default",
            fontSize: "16px",
            fontWeight: 700,
            padding: "16px",
            transition: "all 0.15s",
            width: "100%",
          }}
        >
          {submitting ? "저장 중…" : "beenhere 시작하기"}
        </button>
      </div>
    </main>
  );
}

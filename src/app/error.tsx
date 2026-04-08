"use client";

import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: Props) {
  useEffect(() => {
    // 프로덕션에서는 Sentry 등 에러 수집 도구로 전송
    console.error(error);
  }, [error]);

  return (
    <main
      style={{
        alignItems: "center",
        background: "#f9fafb",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        minHeight: "100dvh",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          maxWidth: "320px",
          width: "100%",
        }}
      >
        <div>
          <p
            style={{
              color: "#d1d5db",
              fontSize: "40px",
              lineHeight: 1,
              margin: "0 0 16px",
            }}
          >
            ⚠
          </p>
          <h1
            style={{
              color: "#111827",
              fontSize: "18px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              margin: "0 0 8px",
            }}
          >
            문제가 생겼어요
          </h1>
          <p
            style={{
              color: "#9ca3af",
              fontSize: "14px",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            일시적인 오류가 발생했어요.
            <br />
            잠시 후 다시 시도해 주세요.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            onClick={reset}
            type="button"
            style={{
              appearance: "none",
              background: "#111827",
              border: "none",
              borderRadius: "14px",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: 600,
              padding: "14px",
              width: "100%",
            }}
          >
            다시 시도
          </button>
          <a
            href="/"
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "14px",
              color: "#374151",
              display: "block",
              fontSize: "15px",
              fontWeight: 500,
              padding: "14px",
              textDecoration: "none",
            }}
          >
            피드로 돌아가기
          </a>
        </div>
      </div>
    </main>
  );
}

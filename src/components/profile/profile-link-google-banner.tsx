"use client";

type Props = {
  loading: boolean;
  errorMessage: string | null;
  onClick: () => void;
};

export function ProfileLinkGoogleBanner({
  loading,
  errorMessage,
  onClick,
}: Props) {
  return (
    <section
      style={{
        background: "#eff6ff",
        borderBottom: "1px solid #bfdbfe",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        padding: "14px 20px",
      }}
    >
      <p
        style={{
          color: "#1e3a8a",
          fontSize: "13px",
          fontWeight: 600,
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        게스트 계정을 Google 계정과 연동하면 기기 변경 후에도 데이터가 유지됩니다.
      </p>
      <button
        disabled={loading}
        onClick={onClick}
        type="button"
        style={{
          appearance: "none",
          background: loading ? "#93c5fd" : "#2563eb",
          border: "none",
          borderRadius: "10px",
          color: "#ffffff",
          cursor: loading ? "default" : "pointer",
          fontSize: "13px",
          fontWeight: 700,
          padding: "10px 12px",
          width: "fit-content",
        }}
      >
        {loading ? "연동 준비 중..." : "Google 계정 연동"}
      </button>

      {errorMessage ? (
        <p
          role="alert"
          style={{
            color: "#b91c1c",
            fontSize: "12px",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}

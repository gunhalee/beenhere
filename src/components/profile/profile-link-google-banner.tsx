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
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: "10px",
          justifyContent: "space-between",
        }}
      >
        <p
          style={{
            color: "#1e3a8a",
            flex: 1,
            fontSize: "13px",
            fontWeight: 600,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          Google 계정 연동으로 데이터를 유지하세요.
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
            flexShrink: 0,
            fontSize: "13px",
            fontWeight: 700,
            padding: "10px 12px",
          }}
        >
          {loading ? "연동 준비 중..." : "Google 계정 연동"}
        </button>
      </div>

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

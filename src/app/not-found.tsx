import Link from "next/link";

export default function NotFoundPage() {
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
              fontSize: "48px",
              fontWeight: 800,
              letterSpacing: "-0.05em",
              lineHeight: 1,
              margin: "0 0 16px",
            }}
          >
            404
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
            페이지를 찾을 수 없어요
          </h1>
          <p
            style={{
              color: "#9ca3af",
              fontSize: "14px",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            주소가 잘못되었거나
            <br />
            삭제된 페이지일 수 있어요.
          </p>
        </div>

        <Link
          href="/"
          style={{
            background: "#111827",
            borderRadius: "14px",
            color: "#ffffff",
            display: "block",
            fontSize: "15px",
            fontWeight: 600,
            padding: "14px",
            textDecoration: "none",
          }}
        >
          피드로 돌아가기
        </Link>
      </div>
    </main>
  );
}

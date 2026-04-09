import Link from "next/link";

type Props = {
  currentUserId?: string | null;
  currentNickname?: string | null;
  isAuthenticated?: boolean;
};

export function FeedHeader({
  currentUserId,
  currentNickname,
  isAuthenticated = false,
}: Props) {
  return (
    <header
      style={{
        backdropFilter: "blur(10px)",
        background: "rgba(255, 255, 255, 0.95)",
        borderBottom: "1px solid rgba(17, 24, 39, 0.06)",
        padding: "calc(env(safe-area-inset-top, 0px) + 14px) 20px 14px",
        position: "relative",
        zIndex: 4,
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: "8px",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: "8px",
            minWidth: 0,
          }}
        >
          <h1
            style={{
              color: "#111827",
              flexShrink: 0,
              fontSize: "20px",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              margin: 0,
            }}
          >
            beenhere
          </h1>
        </div>

        {currentUserId ? (
          <Link
            href={`/profile/${currentUserId}`}
            style={{
              alignItems: "center",
              background: "#f3f4f6",
              border: "1px solid #e5e7eb",
              borderRadius: "9999px",
              color: "#374151",
              display: "flex",
              flexShrink: 0,
              fontSize: "12px",
              fontWeight: 600,
              maxWidth: "120px",
              overflow: "hidden",
              padding: "5px 10px",
              textDecoration: "none",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {currentNickname ?? "프로필"}
            </span>
          </Link>
        ) : isAuthenticated ? (
          <span
            style={{
              alignItems: "center",
              background: "#f3f4f6",
              border: "1px solid #e5e7eb",
              borderRadius: "9999px",
              color: "#374151",
              display: "flex",
              flexShrink: 0,
              fontSize: "12px",
              fontWeight: 600,
              maxWidth: "120px",
              overflow: "hidden",
              padding: "5px 10px",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {currentNickname ?? "게스트"}
            </span>
          </span>
        ) : (
          <Link
            href="/auth/login"
            style={{
              background: "#111827",
              borderRadius: "9999px",
              color: "#ffffff",
              flexShrink: 0,
              fontSize: "12px",
              fontWeight: 600,
              padding: "5px 12px",
              textDecoration: "none",
            }}
          >
            로그인
          </Link>
        )}
      </div>
    </header>
  );
}


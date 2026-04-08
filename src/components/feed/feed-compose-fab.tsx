type Props = {
  loading?: boolean;
  onClick: () => void;
};

export function FeedComposeFab({ loading = false, onClick }: Props) {
  return (
    <button
      aria-label="글 남기기"
      disabled={loading}
      onClick={onClick}
      type="button"
      style={{
        alignItems: "center",
        appearance: "none",
        background: loading ? "#374151" : "#111827",
        border: "none",
        borderRadius: "9999px",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
        boxShadow: "0 4px 16px rgba(17, 24, 39, 0.28)",
        color: "#ffffff",
        cursor: loading ? "default" : "pointer",
        display: "flex",
        fontSize: "15px",
        fontWeight: 700,
        gap: "6px",
        opacity: loading ? 0.7 : 1,
        padding: "14px 22px",
        position: "fixed",
        right: "20px",
        transition: "opacity 0.15s",
        zIndex: 5,
      }}
    >
      <span style={{ fontSize: "18px", lineHeight: 1 }}>✏</span>
      {loading ? "위치 확인 중" : "글 남기기"}
    </button>
  );
}

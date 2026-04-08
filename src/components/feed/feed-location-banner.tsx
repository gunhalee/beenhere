type Props = {
  onRequestPermission: () => void;
};

export function FeedLocationBanner({ onRequestPermission }: Props) {
  return (
    <div
      role="alert"
      style={{
        alignItems: "center",
        background: "#fffbeb",
        borderBottom: "1px solid #fde68a",
        display: "flex",
        gap: "10px",
        justifyContent: "space-between",
        padding: "12px 20px",
        position: "relative",
        zIndex: 3,
      }}
    >
      <p
        style={{
          color: "#92400e",
          fontSize: "13px",
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        위치 권한이 없어 피드를 볼 수 없어요.
      </p>
      <button
        onClick={onRequestPermission}
        type="button"
        style={{
          appearance: "none",
          background: "#92400e",
          border: "none",
          borderRadius: "9999px",
          color: "#ffffff",
          cursor: "pointer",
          flexShrink: 0,
          fontSize: "12px",
          fontWeight: 600,
          padding: "6px 14px",
          whiteSpace: "nowrap",
        }}
      >
        권한 허용
      </button>
    </div>
  );
}

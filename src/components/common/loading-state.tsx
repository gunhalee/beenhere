type Props = {
  label?: string;
};

export function LoadingState({ label = "불러오는 중" }: Props) {
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        justifyContent: "center",
        padding: "40px 20px",
        color: "#9ca3af",
      }}
    >
      <div
        style={{
          width: "20px",
          height: "20px",
          border: "2px solid #e5e7eb",
          borderTopColor: "#6b7280",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <span style={{ fontSize: "13px" }}>{label}</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

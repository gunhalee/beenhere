type Props = {
  message: string;
  onRetry?: () => void;
};

export function ErrorState({ message, onRetry }: Props) {
  return (
    <div
      style={{
        padding: "40px 24px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <p style={{ color: "#6b7280", fontSize: "14px", lineHeight: 1.6, margin: 0 }}>
        {message}
      </p>
      {onRetry ? (
        <button
          onClick={onRetry}
          type="button"
          style={{
            appearance: "none",
            background: "none",
            border: "1px solid #d1d5db",
            borderRadius: "9999px",
            color: "#374151",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 500,
            padding: "8px 20px",
          }}
        >
          다시 시도
        </button>
      ) : null}
    </div>
  );
}

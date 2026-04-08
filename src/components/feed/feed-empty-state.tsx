type Props = {
  onCompose?: () => void;
};

export function FeedEmptyState({ onCompose }: Props) {
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "60px 24px",
        textAlign: "center",
      }}
    >
      <p
        style={{
          color: "#111827",
          fontSize: "16px",
          fontWeight: 600,
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        이 지역의 첫 번째
        <br />
        이야기를 남겨보세요
      </p>
      <p
        style={{
          color: "#9ca3af",
          fontSize: "13px",
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        10km 안에 아직 글이 없어요.
        <br />
        이곳에서 첫 흔적을 남겨보세요.
      </p>
      {onCompose ? (
        <button
          onClick={onCompose}
          type="button"
          style={{
            appearance: "none",
            background: "#111827",
            border: "none",
            borderRadius: "9999px",
            color: "#ffffff",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 600,
            padding: "12px 28px",
          }}
        >
          글 남기기
        </button>
      ) : null}
    </div>
  );
}

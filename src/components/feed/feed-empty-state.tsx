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
        ??吏??쓽 泥?踰덉㎏
        <br />
        ?댁빞湲곕? ?④꺼蹂댁꽭??
      </p>
      <p
        style={{
          color: "#9ca3af",
          fontSize: "13px",
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        주변 ?덉뿉 ?꾩쭅 湲???놁뼱??
        <br />
        ?닿납?먯꽌 泥??붿쟻???④꺼蹂댁꽭??
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
          湲 ?④린湲?
        </button>
      ) : null}
    </div>
  );
}


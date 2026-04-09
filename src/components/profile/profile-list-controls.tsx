"use client";

type EmptyStateProps = {
  message: string;
};

export function ProfileTabEmptyState({ message }: EmptyStateProps) {
  return (
    <p
      style={{
        color: "#9ca3af",
        fontSize: "14px",
        padding: "40px 0",
        textAlign: "center",
      }}
    >
      {message}
    </p>
  );
}

type LoadMoreButtonProps = {
  onClick: () => void;
  label: string;
};

export function ProfileLoadMoreButton({
  onClick,
  label,
}: LoadMoreButtonProps) {
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        appearance: "none",
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "9999px",
        color: "#374151",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: 600,
        padding: "12px",
        width: "100%",
      }}
    >
      {label}
    </button>
  );
}

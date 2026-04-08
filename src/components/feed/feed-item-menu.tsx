"use client";

type Props = {
  isAuthor: boolean;
  onReport: () => void;
  onDelete: () => void;
  onClose: () => void;
};

export function FeedItemMenu({ isAuthor, onReport, onDelete, onClose }: Props) {
  return (
    <>
      {/* 메뉴 바깥 클릭 시 닫기 */}
      <button
        aria-label="메뉴 닫기"
        onClick={onClose}
        type="button"
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          cursor: "default",
          inset: 0,
          padding: 0,
          position: "fixed",
          zIndex: 10,
        }}
      />

      {/* 메뉴 패널 */}
      <div
        role="menu"
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          boxShadow: "0 8px 24px rgba(17, 24, 39, 0.12)",
          minWidth: "140px",
          overflow: "hidden",
          position: "absolute",
          right: 0,
          top: "28px",
          zIndex: 11,
        }}
      >
        {isAuthor ? (
          <button
            role="menuitem"
            onClick={() => {
              onClose();
              onDelete();
            }}
            type="button"
            style={{
              appearance: "none",
              background: "none",
              border: "none",
              borderBottom: "1px solid #f3f4f6",
              color: "#ef4444",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 500,
              padding: "12px 16px",
              textAlign: "left",
              width: "100%",
            }}
          >
            삭제하기
          </button>
        ) : null}
        <button
          role="menuitem"
          onClick={() => {
            onClose();
            onReport();
          }}
          type="button"
          style={{
            appearance: "none",
            background: "none",
            border: "none",
            color: "#374151",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 500,
            padding: "12px 16px",
            textAlign: "left",
            width: "100%",
          }}
        >
          신고하기
        </button>
      </div>
    </>
  );
}

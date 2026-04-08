"use client";

import { useState } from "react";
import type { ProfileLikeItem } from "@/types/domain";
import { PostCardMetaRow } from "@/components/feed/post-card-meta-row";

type Props = {
  item: ProfileLikeItem;
  likerId: string;
  likerNickname: string;
  onReport: (postId: string) => void;
  onLike?: (item: ProfileLikeItem) => void;
};

export function ProfileLikeItem({
  item,
  likerId,
  likerNickname,
  onReport,
  onLike,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const {
    postId,
    content,
    authorId,
    authorNickname,
    placeLabel,
    relativeTime,
    likeCount,
    myLike,
  } = item;

  const isSameSharer = authorId === likerId;

  return (
    <article
      style={{
        background: "#ffffff",
        border: "1px solid rgba(17, 24, 39, 0.08)",
        borderRadius: "20px",
        boxShadow: "0 2px 8px rgba(17, 24, 39, 0.04)",
        padding: "16px 18px",
        position: "relative",
      }}
    >
      <div
        style={{
          alignItems: "flex-start",
          display: "flex",
          gap: "8px",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <PostCardMetaRow
            nickname={authorNickname}
            profileId={authorId}
            placeLabel={placeLabel}
            relativeTime={relativeTime}
          />
        </div>

        <div style={{ position: "relative" }}>
          <button
            aria-label="메뉴"
            onClick={() => setMenuOpen((v) => !v)}
            type="button"
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              color: "#9ca3af",
              cursor: "pointer",
              fontSize: "18px",
              lineHeight: 1,
              padding: "0 2px",
            }}
          >
            ⋯
          </button>

          {menuOpen ? (
            <>
              <button
                aria-label="메뉴 닫기"
                onClick={() => setMenuOpen(false)}
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
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  boxShadow: "0 8px 24px rgba(17, 24, 39, 0.12)",
                  minWidth: "130px",
                  overflow: "hidden",
                  position: "absolute",
                  right: 0,
                  top: "28px",
                  zIndex: 11,
                }}
              >
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onReport(postId);
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
          ) : null}
        </div>
      </div>

      <p
        style={{
          color: "#111827",
          fontSize: "15px",
          fontWeight: 500,
          lineHeight: 1.6,
          margin: "0 0 14px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {content}
      </p>

      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: "8px",
          justifyContent: "space-between",
        }}
      >
        <div style={{ flex: 1, marginRight: "8px", minWidth: 0 }}>
          {!isSameSharer ? (
            <PostCardMetaRow
              leadIn="Liked by "
              nickname={likerNickname}
              profileId={likerId}
              placeLabel={placeLabel}
              relativeTime={relativeTime}
            />
          ) : null}
        </div>

        <button
          aria-label={myLike ? "이미 라이크함" : "라이크"}
          aria-pressed={myLike}
          disabled={myLike}
          onClick={() => !myLike && onLike?.(item)}
          type="button"
          style={{
            alignItems: "center",
            appearance: "none",
            background: myLike ? "#fef2f2" : "#f9fafb",
            border: `1px solid ${myLike ? "#fca5a5" : "#e5e7eb"}`,
            borderRadius: "9999px",
            color: myLike ? "#ef4444" : "#6b7280",
            cursor: myLike ? "default" : "pointer",
            display: "inline-flex",
            flexShrink: 0,
            fontSize: "12px",
            fontWeight: 600,
            gap: "4px",
            padding: "4px 10px",
          }}
        >
          <span style={{ fontSize: "13px" }}>{myLike ? "♥" : "♡"}</span>
          <span>{likeCount}</span>
        </button>
      </div>
    </article>
  );
}

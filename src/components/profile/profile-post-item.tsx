"use client";

import { useState } from "react";
import type { ProfilePostItem, PostLikerItem } from "@/types/domain";
import { LikersList } from "./likers-list";

type LikersState = {
  items: PostLikerItem[];
  nextCursor: string | null;
  loading: boolean;
};

type Props = {
  item: ProfilePostItem;
  isMyProfile: boolean;
  currentUserId: string | null;
  expandedLikersId: string | null;
  likersMap: Record<string, LikersState | undefined>;
  onLikeCountClick: (postId: string) => void;
  onDelete: (postId: string) => void;
  onReport: (postId: string) => void;
};

export function ProfilePostItem({
  item,
  isMyProfile,
  expandedLikersId,
  likersMap,
  onLikeCountClick,
  onDelete,
  onReport,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const { postId, content, placeLabel, relativeTime, likeCount } = item;
  const isLikersExpanded = expandedLikersId === postId;
  const likersState = likersMap[postId];

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
      {/* 메타 + 메뉴 */}
      <div
        style={{
          alignItems: "flex-start",
          display: "flex",
          gap: "8px",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <p
          style={{
            color: "#9ca3af",
            flex: 1,
            fontSize: "11px",
            margin: 0,
          }}
        >
          {placeLabel ? (
            <span style={{ color: "#111827", fontWeight: 500 }}>
              {placeLabel}
              {" · "}
            </span>
          ) : null}
          {relativeTime}
        </p>

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
                {isMyProfile ? (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(postId);
                    }}
                    type="button"
                    style={{
                      appearance: "none",
                      background: "none",
                      border: "none",
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
                ) : (
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
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* 본문 */}
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

      {/* 라이크 수 (내 프로필이면 클릭 가능) */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          aria-label={
            isMyProfile ? "라이커 목록 펼치기" : `라이크 ${likeCount}개`
          }
          aria-expanded={isLikersExpanded}
          disabled={!isMyProfile}
          onClick={() => isMyProfile && onLikeCountClick(postId)}
          type="button"
          style={{
            alignItems: "center",
            appearance: "none",
            background: isLikersExpanded ? "#f3f4f6" : "#f9fafb",
            border: `1px solid ${isLikersExpanded ? "#d1d5db" : "#e5e7eb"}`,
            borderRadius: "9999px",
            color: "#6b7280",
            cursor: isMyProfile ? "pointer" : "default",
            display: "inline-flex",
            fontSize: "12px",
            fontWeight: 600,
            gap: "4px",
            padding: "4px 10px",
          }}
        >
          <span style={{ fontSize: "13px" }}>♡</span>
          <span>{likeCount}</span>
          {isMyProfile ? (
            <span style={{ fontSize: "10px" }}>{isLikersExpanded ? "▲" : "▼"}</span>
          ) : null}
        </button>
      </div>

      {/* 인라인 라이커 목록 */}
      {isLikersExpanded && likersState ? (
        <div
          style={{
            borderTop: "1px solid #f3f4f6",
            marginTop: "12px",
          }}
        >
          <LikersList loading={likersState.loading} items={likersState.items} />
        </div>
      ) : null}
    </article>
  );
}

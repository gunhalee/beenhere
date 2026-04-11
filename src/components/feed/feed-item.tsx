"use client";

import Link from "next/link";
import { useState } from "react";
import type { FeedItem } from "@/types/domain";
import { FeedItemMenu } from "./feed-item-menu";
import { PostCardMetaRow } from "./post-card-meta-row";

type Props = {
  item: FeedItem;
  currentUserId: string | null;
  locationAvailable: boolean;
  onLike: (item: FeedItem) => void;
  onDelete: (postId: string) => void;
  onReport: (postId: string) => void;
};

export function FeedItemCard({
  item,
  currentUserId,
  locationAvailable,
  onLike,
  onDelete,
  onReport,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const {
    postId,
    content,
    authorId,
    authorNickname,
    lastSharerId,
    lastSharerNickname,
    likerUserIds,
    likerNicknames,
    placeLabel,
    distanceMeters,
    relativeTime,
    originalPlaceLabel,
    originalDistanceMeters,
    originalRelativeTime,
    likeCount,
    myLike,
  } = item;

  const isAuthor = currentUserId === authorId;
  const isSameSharer = lastSharerId === authorId;
  const authorPlaceLabel = originalPlaceLabel ?? placeLabel;
  const authorDistanceMeters = originalDistanceMeters ?? distanceMeters;
  const authorRelativeTime = originalRelativeTime ?? relativeTime;
  const likerEntries =
    likerNicknames.length > 0
      ? likerNicknames.map((nickname, index) => ({
          nickname,
          userId: likerUserIds[index] ?? null,
        }))
      : !isSameSharer
        ? [{ nickname: lastSharerNickname, userId: lastSharerId }]
        : [];

  return (
    <article
      data-post-id={postId}
      style={{
        position: "relative",
        zIndex: menuOpen ? 2 : undefined,
      }}
    >
      <div
        style={{
          background: "#ffffff",
          border: "1px solid rgba(17, 24, 39, 0.08)",
          borderRadius: "20px",
          boxShadow: "0 2px 8px rgba(17, 24, 39, 0.04)",
          padding: "16px 18px",
        }}
      >
        {/* 상단: 원작자 메타 + 메뉴 */}
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
              placeLabel={authorPlaceLabel}
              distanceMeters={authorDistanceMeters}
              relativeTime={authorRelativeTime}
            />
          </div>

          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              aria-label="메뉴 열기"
              aria-expanded={menuOpen}
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
              <FeedItemMenu
                isAuthor={isAuthor}
                onReport={() => onReport(postId)}
                onDelete={() => onDelete(postId)}
                onClose={() => setMenuOpen(false)}
              />
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

        {/* 하단: Liked by + 라이크 */}
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: "8px",
            justifyContent: "space-between",
          }}
        >
          <div style={{ flex: 1, marginRight: "8px", minWidth: 0 }}>
            {likerEntries.length > 0 ? (
              <p
                style={{
                  color: "#6b7280",
                  fontSize: "11px",
                  lineHeight: 1.45,
                  margin: 0,
                  wordBreak: "break-word",
                }}
              >
                <span style={{ color: "#6b7280", fontWeight: 400 }}>
                  Liked by{" "}
                </span>
                {likerEntries.map((liker, index) => (
                  <span key={`${liker.userId ?? liker.nickname}-${index}`}>
                    {index > 0 ? ", " : null}
                    {liker.userId ? (
                      <Link
                        href={`/profile/${liker.userId}`}
                        onClick={(event) => event.stopPropagation()}
                        style={{
                          color: "#111827",
                          fontWeight: 500,
                          textDecoration: "none",
                        }}
                      >
                        {liker.nickname}
                      </Link>
                    ) : (
                      <span style={{ color: "#111827", fontWeight: 500 }}>
                        {liker.nickname}
                      </span>
                    )}
                  </span>
                ))}
              </p>
            ) : null}
          </div>

          <button
            aria-label={myLike ? "라이크 취소" : "라이크"}
            aria-pressed={myLike}
            disabled={!locationAvailable && !myLike}
            onClick={() => onLike(item)}
            type="button"
            title={
              !locationAvailable && !myLike
                ? "위치 권한이 있어야 라이크할 수 있어요"
                : undefined
            }
            style={{
              alignItems: "center",
              appearance: "none",
              background: myLike ? "#fef2f2" : "#f9fafb",
              border: `1px solid ${myLike ? "#fca5a5" : "#e5e7eb"}`,
              borderRadius: "9999px",
              color: myLike ? "#ef4444" : "#6b7280",
              cursor: !locationAvailable && !myLike ? "default" : "pointer",
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
      </div>
    </article>
  );
}

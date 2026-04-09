"use client";

import type { ProfileLikeItem } from "@/types/domain";
import { PostCardMetaRow } from "@/components/feed/post-card-meta-row";
import { ProfileCard } from "./profile-card";
import { ProfileItemMenu } from "./profile-item-menu";

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
  const {
    postId,
    content,
    authorId,
    authorNickname,
    placeLabel,
    distanceMeters,
    relativeTime,
    likeCount,
    myLike,
  } = item;

  const isSameSharer = authorId === likerId;

  return (
    <ProfileCard>
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
            disableProfileLink={authorId === likerId}
            placeLabel={placeLabel}
            distanceMeters={distanceMeters}
            relativeTime={relativeTime}
          />
        </div>

        <ProfileItemMenu
          actions={[
            {
              key: "report",
              label: "신고하기",
              onSelect: () => onReport(postId),
              tone: "default",
            },
          ]}
        />
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
              disableProfileLink
              placeLabel={placeLabel}
              distanceMeters={distanceMeters}
              relativeTime={relativeTime}
            />
          ) : null}
        </div>

        <button
          aria-label={myLike ? "이미 좋아요함" : "좋아요"}
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
    </ProfileCard>
  );
}

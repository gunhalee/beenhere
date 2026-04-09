"use client";

import type { ProfilePostItem, PostLikerItem } from "@/types/domain";
import { formatDistance } from "@/lib/geo/format-distance";
import { LikersList } from "./likers-list";
import { ProfileCard } from "./profile-card";
import { ProfileItemMenu } from "./profile-item-menu";

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
  const { postId, content, placeLabel, distanceMeters, relativeTime, likeCount } = item;
  const isLikersExpanded = expandedLikersId === postId;
  const likersState = likersMap[postId];
  const hasDistance =
    distanceMeters != null && Number.isFinite(distanceMeters) && distanceMeters >= 0;

  const menuActions = isMyProfile
    ? [
        {
          key: "delete",
          label: "삭제하기",
          onSelect: () => onDelete(postId),
          tone: "danger" as const,
        },
      ]
    : [
        {
          key: "report",
          label: "신고하기",
          onSelect: () => onReport(postId),
          tone: "default" as const,
        },
      ];

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
        <p
          style={{
            color: "#9ca3af",
            flex: 1,
            fontSize: "11px",
            margin: 0,
          }}
        >
          {placeLabel ? <span style={{ color: "#111827", fontWeight: 500 }}>{placeLabel}</span> : null}
          {hasDistance ? (
            <span>
              {placeLabel ? " / " : null}
              {formatDistance(distanceMeters as number)}
            </span>
          ) : null}
          {placeLabel || hasDistance ? " / " : null}
          {relativeTime}
        </p>

        <ProfileItemMenu actions={menuActions} />
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

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          aria-label={isMyProfile ? "좋아요 목록 펼치기" : `좋아요 ${likeCount}개`}
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
          <span style={{ fontSize: "13px" }}>좋아요</span>
          <span>{likeCount}</span>
          {isMyProfile ? (
            <span style={{ fontSize: "10px" }}>
              {isLikersExpanded ? "접기" : "보기"}
            </span>
          ) : null}
        </button>
      </div>

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
    </ProfileCard>
  );
}

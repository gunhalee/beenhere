"use client";

import type { FeedItem } from "@/types/domain";
import type { FeedHookState } from "@/lib/hooks/use-feed";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { FeedItemCard } from "./feed-item";
import { FeedEmptyState } from "./feed-empty-state";

type Props = {
  state: FeedHookState;
  currentUserId: string | null;
  locationAvailable: boolean;
  onLike: (item: FeedItem) => void;
  onDelete: (postId: string) => void;
  onReport: (postId: string) => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onCompose: () => void;
};

export function FeedList({
  state,
  currentUserId,
  locationAvailable,
  onLike,
  onDelete,
  onReport,
  onLoadMore,
  onRetry,
  onCompose,
}: Props) {
  const { status, items, nextCursor, loadingMore, errorMessage } = state;

  if (status === "locating" || status === "loading") {
    return <LoadingState label="근처 글을 불러오는 중" />;
  }

  if (status === "error" && errorMessage) {
    return <ErrorState message={errorMessage} onRetry={onRetry} />;
  }

  if (status === "success" && items.length === 0) {
    return <FeedEmptyState onCompose={onCompose} />;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {items.map((item) => (
        <FeedItemCard
          key={item.postId}
          item={item}
          currentUserId={currentUserId}
          locationAvailable={locationAvailable}
          onLike={onLike}
          onDelete={onDelete}
          onReport={onReport}
        />
      ))}

      {nextCursor && !loadingMore ? (
        <button
          onClick={onLoadMore}
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
          더 보기
        </button>
      ) : null}

      {loadingMore ? <LoadingState label="더 불러오는 중" /> : null}

      {/* 하단 안전 영역 */}
      <div style={{ height: "24px" }} />
    </div>
  );
}

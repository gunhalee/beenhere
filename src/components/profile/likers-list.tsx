import Link from "next/link";
import type { PostLikerItem } from "@/types/domain";
import { LoadingState } from "@/components/common/loading-state";

type Props = {
  loading: boolean;
  items: PostLikerItem[];
};

export function LikersList({ loading, items }: Props) {
  if (loading) {
    return (
      <div style={{ padding: "12px 0" }}>
        <LoadingState label="수집한 사람 목록 불러오는 중" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p
        style={{
          color: "#9ca3af",
          fontSize: "13px",
          margin: 0,
          padding: "12px 0",
          textAlign: "center",
        }}
      >
        아직 수집한 사람이 없어요.
      </p>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "12px 0 4px",
      }}
    >
      {items.map((liker) => (
        <Link
          key={liker.userId}
          href={`/profile/${liker.userId}`}
          style={{
            alignItems: "center",
            background: "#f9fafb",
            borderRadius: "12px",
            display: "flex",
            gap: "10px",
            justifyContent: "space-between",
            padding: "10px 14px",
            textDecoration: "none",
          }}
        >
          <div>
            <p
              style={{
                color: "#111827",
                fontSize: "13px",
                fontWeight: 600,
                margin: "0 0 2px",
              }}
            >
              {liker.nickname}
            </p>
            <p style={{ color: "#9ca3af", fontSize: "11px", margin: 0 }}>
              {liker.likePlaceLabel} · {liker.likedAtRelative}
            </p>
          </div>
          <span style={{ color: "#d1d5db", fontSize: "16px" }}>→</span>
        </Link>
      ))}
    </div>
  );
}

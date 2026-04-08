import Link from "next/link";
import { formatDistance } from "@/lib/geo/format-distance";

type Props = {
  prefix?: string;
  /** 닉네임 앞 일반 텍스트 (예: "Liked by ") */
  leadIn?: string;
  nickname: string;
  profileId: string;
  placeLabel: string;
  relativeTime: string;
  /** 없으면 거리 구간을 생략한다 (프로필 라이크 목록 등). */
  distanceMeters?: number | null;
};

export function PostCardMetaRow({
  prefix,
  leadIn,
  nickname,
  profileId,
  placeLabel,
  relativeTime,
  distanceMeters,
}: Props) {
  const hasDistance =
    distanceMeters != null && Number.isFinite(distanceMeters) && distanceMeters >= 0;

  return (
    <p
      style={{
        color: "#6b7280",
        fontSize: "11px",
        lineHeight: 1.45,
        margin: 0,
        wordBreak: "break-word",
      }}
    >
      {prefix ? (
        <span style={{ color: "#9ca3af", userSelect: "none" }}>{prefix}</span>
      ) : null}
      {leadIn ? (
        <span style={{ color: "#6b7280", fontWeight: 400 }}>{leadIn}</span>
      ) : null}
      <Link
        href={`/profile/${profileId}`}
        onClick={(e) => e.stopPropagation()}
        style={{ color: "#111827", fontWeight: 500, textDecoration: "none" }}
      >
        {nickname}
      </Link>
      <span style={{ color: "#6b7280", fontWeight: 400 }}>
        {" · "}
        {placeLabel}
        {hasDistance ? (
          <>
            {" · "}
            {formatDistance(distanceMeters)}
          </>
        ) : null}
        {" · "}
        {relativeTime}
      </span>
    </p>
  );
}

import Link from "next/link";
import { formatDistance } from "@/lib/geo/format-distance";

type Props = {
  prefix?: string;
  leadIn?: string;
  nickname: string;
  profileId: string;
  disableProfileLink?: boolean;
  placeLabel?: string | null;
  relativeTime: string;
  distanceMeters?: number | null;
};

export function PostCardMetaRow({
  prefix,
  leadIn,
  nickname,
  profileId,
  disableProfileLink = false,
  placeLabel,
  relativeTime,
  distanceMeters,
}: Props) {
  const normalizedPlaceLabel = placeLabel?.trim() || null;
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

      {disableProfileLink ? (
        <span style={{ color: "#111827", fontWeight: 500, textDecoration: "none" }}>
          {nickname}
        </span>
      ) : (
        <Link
          href={`/profile/${profileId}`}
          onClick={(event) => event.stopPropagation()}
          style={{ color: "#111827", fontWeight: 500, textDecoration: "none" }}
        >
          {nickname}
        </Link>
      )}

      <span style={{ color: "#6b7280", fontWeight: 400 }}>
        {" \u00B7 "}
        {normalizedPlaceLabel ? `${normalizedPlaceLabel} \u00B7 ` : null}
        {hasDistance ? `${formatDistance(distanceMeters)} \u00B7 ` : null}
        {relativeTime}
      </span>
    </p>
  );
}

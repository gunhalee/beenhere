"use client";

type InlineBannerTone = "error" | "success" | "info";

type Props = {
  message: string;
  tone: InlineBannerTone;
  stickyTop?: string;
  centered?: boolean;
  rounded?: boolean;
  padding?: string;
  zIndex?: number;
};

const TONE_STYLES: Record<
  InlineBannerTone,
  { background: string; borderColor: string; color: string }
> = {
  error: {
    background: "#fef2f2",
    borderColor: "#fecaca",
    color: "#b91c1c",
  },
  success: {
    background: "#ecfdf3",
    borderColor: "#bbf7d0",
    color: "#166534",
  },
  info: {
    background: "#eff6ff",
    borderColor: "#bfdbfe",
    color: "#1e3a8a",
  },
};

export function InlineBanner({
  message,
  tone,
  stickyTop,
  centered = false,
  rounded = false,
  padding = "10px 20px",
  zIndex = 1,
}: Props) {
  const toneStyle = TONE_STYLES[tone];

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        background: toneStyle.background,
        border: rounded ? `1px solid ${toneStyle.borderColor}` : undefined,
        borderBottom: rounded ? undefined : `1px solid ${toneStyle.borderColor}`,
        borderRadius: rounded ? "14px" : undefined,
        color: toneStyle.color,
        fontSize: "13px",
        fontWeight: centered ? 600 : undefined,
        lineHeight: 1.5,
        padding,
        position: stickyTop ? "sticky" : "relative",
        textAlign: centered ? "center" : undefined,
        top: stickyTop,
        zIndex,
      }}
    >
      {message}
    </div>
  );
}

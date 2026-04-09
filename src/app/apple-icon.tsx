import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#111827",
          borderRadius: "56px",
          color: "#ffffff",
          display: "flex",
          fontSize: 108,
          fontWeight: 800,
          height: "100%",
          justifyContent: "center",
          letterSpacing: "-0.05em",
          width: "100%",
        }}
      >
        b
      </div>
    ),
    {
      ...size,
    },
  );
}


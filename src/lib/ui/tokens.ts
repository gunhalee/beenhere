export const uiColors = {
  textStrong: "#111827",
  textMuted: "#8f96a3",
  textBody: "#374151",
  textInverse: "#ffffff",
  textAccent: "#5b57d6",
  border: "#e5e7eb",
  surface: "#ffffff",
  surfaceMuted: "#f7f4ec",
  surfaceError: "#fef2f2",
  surfaceLoading: "#f9fafb",
  surfaceSheet: "#ffffff",
  surfaceAccent: "#ebe8ff",
  backdrop: "rgba(17, 24, 39, 0.18)",
  danger: "#dc2626",
  dangerSoft: "#fee2e2",
  buttonPrimary: "#111827",
} as const;

export const uiSpacing = {
  xs: "8px",
  sm: "10px",
  md: "12px",
  lg: "14px",
  xl: "16px",
  xxl: "20px",
  xxxl: "24px",
  pageX: "16px",
  pageY: "20px",
} as const;

export const uiRadius = {
  md: "14px",
  lg: "18px",
  xl: "26px",
  pill: "999px",
} as const;

export const uiTypography = {
  label: { fontSize: "11px", fontWeight: 600 },
  body:  { fontSize: "13px", fontWeight: 500 },
  title: { fontSize: "15px", fontWeight: 700, lineHeight: 1.3 },
  meta:  { fontSize: "12px", fontWeight: 500 },
} as const;

export const uiShadow = {
  sheet:    "0 -18px 48px rgba(17, 24, 39, 0.16)",
  floating: "0 14px 32px rgba(17, 24, 39, 0.2)",
} as const;

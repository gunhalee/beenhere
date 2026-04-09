"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function ProfileCard({ children }: Props) {
  return (
    <article
      style={{
        background: "#ffffff",
        border: "1px solid rgba(17, 24, 39, 0.08)",
        borderRadius: "20px",
        boxShadow: "0 2px 8px rgba(17, 24, 39, 0.04)",
        padding: "16px 18px",
        position: "relative",
      }}
    >
      {children}
    </article>
  );
}

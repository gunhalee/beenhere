"use client";

import { useState } from "react";

type MenuAction = {
  key: string;
  label: string;
  onSelect: () => void;
  tone?: "default" | "danger";
};

type Props = {
  triggerLabel?: string;
  closeLabel?: string;
  actions: MenuAction[];
};

export function ProfileItemMenu({
  triggerLabel = "메뉴",
  closeLabel = "메뉴 닫기",
  actions,
}: Props) {
  const [open, setOpen] = useState(false);

  if (actions.length === 0) return null;

  return (
    <div style={{ position: "relative" }}>
      <button
        aria-label={triggerLabel}
        onClick={() => setOpen((v) => !v)}
        type="button"
        style={{
          appearance: "none",
          background: "transparent",
          border: "none",
          color: "#9ca3af",
          cursor: "pointer",
          fontSize: "18px",
          lineHeight: 1,
          padding: "0 2px",
        }}
      >
        ...
      </button>

      {open ? (
        <>
          <button
            aria-label={closeLabel}
            onClick={() => setOpen(false)}
            type="button"
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              cursor: "default",
              inset: 0,
              padding: 0,
              position: "fixed",
              zIndex: 10,
            }}
          />
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              boxShadow: "0 8px 24px rgba(17, 24, 39, 0.12)",
              minWidth: "130px",
              overflow: "hidden",
              position: "absolute",
              right: 0,
              top: "28px",
              zIndex: 11,
            }}
          >
            {actions.map((action) => (
              <button
                key={action.key}
                onClick={() => {
                  setOpen(false);
                  action.onSelect();
                }}
                type="button"
                style={{
                  appearance: "none",
                  background: "none",
                  border: "none",
                  color: action.tone === "danger" ? "#ef4444" : "#374151",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 500,
                  padding: "12px 16px",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

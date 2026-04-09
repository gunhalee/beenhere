"use client";

import { useState } from "react";
import { API_ERROR_CODE } from "@/lib/api/common-errors";
import { blockUserClient, unblockUserClient } from "@/lib/api/profile-client";

type Props = {
  targetNickname: string;
  targetUserId: string;
  onBlocked: () => void;
  onUnblocked?: () => void;
  onClose: () => void;
  onAuthRequired?: () => void;
};

export function ProfileBlockDialog({
  targetNickname,
  targetUserId,
  onBlocked,
  onUnblocked,
  onClose,
  onAuthRequired,
}: Props) {
  const [blockLoading, setBlockLoading] = useState(false);
  const [unblockLoading, setUnblockLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loading = blockLoading || unblockLoading;

  async function handleBlock() {
    if (loading) return;
    setBlockLoading(true);
    setError(null);

    const result = await blockUserClient(targetUserId);

    if (!result.ok) {
      setBlockLoading(false);
      if (result.code === API_ERROR_CODE.UNAUTHORIZED) {
        onAuthRequired?.();
        return;
      }
      setError(result.error ?? "Could not block user. Please try again.");
      return;
    }

    onBlocked();
  }

  async function handleUnblock() {
    if (loading) return;
    setUnblockLoading(true);
    setError(null);

    const result = await unblockUserClient(targetUserId);

    if (!result.ok) {
      setUnblockLoading(false);
      if (result.code === API_ERROR_CODE.UNAUTHORIZED) {
        onAuthRequired?.();
        return;
      }
      setError(result.error ?? "Could not unblock user. Please try again.");
      return;
    }

    onUnblocked?.();
    onClose();
  }

  return (
    <>
      <button
        aria-label="Close dialog"
        onClick={onClose}
        type="button"
        style={{
          appearance: "none",
          background: "rgba(17, 24, 39, 0.4)",
          border: "none",
          cursor: "default",
          inset: 0,
          padding: 0,
          position: "fixed",
          zIndex: 20,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Block user confirmation"
        style={{
          background: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 16px 48px rgba(17, 24, 39, 0.2)",
          left: "50%",
          maxWidth: "340px",
          padding: "24px",
          position: "fixed",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "calc(100% - 40px)",
          zIndex: 21,
        }}
      >
        <p
          style={{
            color: "#111827",
            fontSize: "16px",
            fontWeight: 700,
            margin: "0 0 8px",
            textAlign: "center",
          }}
        >
          Block {targetNickname}?
        </p>
        <p
          style={{
            color: "#6b7280",
            fontSize: "13px",
            lineHeight: 1.6,
            margin: "0 0 24px",
            textAlign: "center",
          }}
        >
          You will not see each other&apos;s posts and profiles.
          <br />
          You can unblock later.
        </p>

        {error ? (
          <p
            style={{
              color: "#ef4444",
              fontSize: "12px",
              margin: "0 0 12px",
              textAlign: "center",
            }}
          >
            {error}
          </p>
        ) : null}

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            disabled={loading}
            onClick={onClose}
            type="button"
            style={{
              appearance: "none",
              background: "#f3f4f6",
              border: "none",
              borderRadius: "12px",
              color: "#374151",
              cursor: "pointer",
              flex: 1,
              fontSize: "14px",
              fontWeight: 600,
              padding: "12px",
            }}
          >
            Cancel
          </button>
          <button
            disabled={loading}
            onClick={handleBlock}
            type="button"
            style={{
              appearance: "none",
              background: loading ? "#9ca3af" : "#ef4444",
              border: "none",
              borderRadius: "12px",
              color: "#ffffff",
              cursor: loading ? "default" : "pointer",
              flex: 1,
              fontSize: "14px",
              fontWeight: 600,
              padding: "12px",
            }}
          >
            {blockLoading ? "Blocking..." : "Block"}
          </button>
        </div>
        <button
          disabled={loading}
          onClick={handleUnblock}
          type="button"
          style={{
            appearance: "none",
            background: "none",
            border: "none",
            color: loading ? "#9ca3af" : "#2563eb",
            cursor: loading ? "default" : "pointer",
            fontSize: "13px",
            fontWeight: 500,
            marginTop: "12px",
            textAlign: "center",
            width: "100%",
          }}
        >
          {unblockLoading ? "Unblocking..." : "Unblock"}
        </button>
      </div>
    </>
  );
}


"use client";

type Props = {
  open: boolean;
  guestLoading: boolean;
  googleLoading: boolean;
  errorMessage: string | null;
  onGuestContinue: () => void;
  onGoogleContinue: () => void;
  onClose: () => void;
};

export function AccountChoiceDialog({
  open,
  guestLoading,
  googleLoading,
  errorMessage,
  onGuestContinue,
  onGoogleContinue,
  onClose,
}: Props) {
  if (!open) return null;

  const loading = guestLoading || googleLoading;

  return (
    <>
      <button
        aria-label="Close dialog"
        onClick={onClose}
        type="button"
        style={{
          appearance: "none",
          background: "rgba(17, 24, 39, 0.45)",
          border: "none",
          cursor: loading ? "default" : "pointer",
          inset: 0,
          padding: 0,
          position: "fixed",
          zIndex: 30,
        }}
      />

      <div
        aria-label="Choose account type"
        aria-modal="true"
        role="dialog"
        style={{
          background: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 18px 50px rgba(17, 24, 39, 0.2)",
          left: "50%",
          maxWidth: "360px",
          padding: "24px",
          position: "fixed",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "calc(100% - 32px)",
          zIndex: 31,
        }}
      >
        <h2
          style={{
            color: "#111827",
            fontSize: "18px",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            margin: "0 0 10px",
          }}
        >
          Continue to write
        </h2>
        <p
          style={{
            color: "#4b5563",
            fontSize: "13px",
            lineHeight: 1.6,
            margin: "0 0 18px",
          }}
        >
          This action requires an account. You can continue with a guest account or
          sign up with Google.
        </p>

        {errorMessage ? (
          <p
            role="alert"
            style={{
              color: "#b91c1c",
              fontSize: "12px",
              lineHeight: 1.5,
              margin: "0 0 12px",
            }}
          >
            {errorMessage}
          </p>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            disabled={loading}
            onClick={onGuestContinue}
            type="button"
            style={{
              appearance: "none",
              background: guestLoading ? "#9ca3af" : "#111827",
              border: "none",
              borderRadius: "12px",
              color: "#ffffff",
              cursor: loading ? "default" : "pointer",
              fontSize: "14px",
              fontWeight: 700,
              padding: "12px 14px",
              textAlign: "center",
            }}
          >
            {guestLoading ? "Preparing guest account..." : "Continue as Guest"}
          </button>

          <button
            disabled={loading}
            onClick={onGoogleContinue}
            type="button"
            style={{
              appearance: "none",
              background: "#ffffff",
              border: "1px solid #d1d5db",
              borderRadius: "12px",
              color: "#111827",
              cursor: loading ? "default" : "pointer",
              fontSize: "14px",
              fontWeight: 600,
              padding: "12px 14px",
              textAlign: "center",
            }}
          >
            {googleLoading ? "Redirecting to Google..." : "Sign up with Google"}
          </button>

          <button
            disabled={loading}
            onClick={onClose}
            type="button"
            style={{
              appearance: "none",
              background: "none",
              border: "none",
              color: "#6b7280",
              cursor: loading ? "default" : "pointer",
              fontSize: "13px",
              fontWeight: 500,
              padding: "6px 0 0",
              textAlign: "center",
            }}
          >
            Not now
          </button>
        </div>
      </div>
    </>
  );
}

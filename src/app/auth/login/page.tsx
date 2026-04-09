"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ensureGuestSession } from "@/lib/auth/guest-session";
import { startGoogleOAuth } from "@/lib/auth/google-oauth";

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: "The login code is missing or invalid. Please try again.",
  exchange_failed: "We could not complete the login flow. Please try again.",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const errorKey = searchParams.get("error");
  const queryErrorMessage = errorKey
    ? (ERROR_MESSAGES[errorKey] ?? "Login failed. Please try again.")
    : null;

  const [googleLoading, setGoogleLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [runtimeErrorMessage, setRuntimeErrorMessage] = useState<string | null>(
    null,
  );
  const displayErrorMessage = runtimeErrorMessage ?? queryErrorMessage;

  async function handleGoogleLogin() {
    if (googleLoading || guestLoading) return;
    setGoogleLoading(true);
    setRuntimeErrorMessage(null);

    const result = await startGoogleOAuth({
      intent: "login",
      nextPath: "/",
    });

    if (!result.ok) {
      setGoogleLoading(false);
      setRuntimeErrorMessage(result.error || "Login failed. Please try again.");
    }
  }

  async function handleGuestLogin() {
    if (googleLoading || guestLoading) return;
    setGuestLoading(true);
    setRuntimeErrorMessage(null);

    const result = await ensureGuestSession();
    if (!result.ok) {
      setGuestLoading(false);
      setRuntimeErrorMessage(result.error);
      return;
    }

    window.location.href = "/";
  }

  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        width: "100%",
      }}
    >
      {displayErrorMessage ? (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "12px",
            color: "#b91c1c",
            fontSize: "13px",
            lineHeight: 1.5,
            padding: "12px 16px",
            textAlign: "center",
            width: "100%",
          }}
        >
          {displayErrorMessage}
        </div>
      ) : null}

      <button
        disabled={googleLoading || guestLoading}
        onClick={handleGoogleLogin}
        type="button"
        style={{
          alignItems: "center",
          appearance: "none",
          background: googleLoading ? "#f3f4f6" : "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "14px",
          boxShadow: "0 2px 8px rgba(17, 24, 39, 0.08)",
          color: "#111827",
          cursor: googleLoading || guestLoading ? "default" : "pointer",
          display: "flex",
          fontSize: "15px",
          fontWeight: 600,
          gap: "10px",
          justifyContent: "center",
          opacity: googleLoading || guestLoading ? 0.7 : 1,
          padding: "14px 24px",
          transition: "opacity 0.15s",
          width: "100%",
        }}
      >
        {googleLoading ? "Signing in..." : "Continue with Google"}
      </button>

      <button
        disabled={googleLoading || guestLoading}
        onClick={handleGuestLogin}
        type="button"
        style={{
          appearance: "none",
          background: guestLoading ? "#9ca3af" : "#111827",
          border: "none",
          borderRadius: "14px",
          color: "#ffffff",
          cursor: googleLoading || guestLoading ? "default" : "pointer",
          fontSize: "15px",
          fontWeight: 600,
          opacity: googleLoading || guestLoading ? 0.85 : 1,
          padding: "14px 24px",
          transition: "opacity 0.15s",
          width: "100%",
        }}
      >
        {guestLoading ? "Preparing guest account..." : "Continue as Guest"}
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main
      style={{
        alignItems: "center",
        background: "#f9fafb",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        minHeight: "100dvh",
        padding: "24px 24px calc(env(safe-area-inset-bottom, 0px) + 40px)",
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: "30px",
          maxWidth: "360px",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              alignItems: "center",
              background: "#111827",
              borderRadius: "20px",
              display: "flex",
              height: "64px",
              justifyContent: "center",
              width: "64px",
            }}
          >
            <span
              style={{
                color: "#ffffff",
                fontSize: "28px",
                fontWeight: 800,
                letterSpacing: "-0.05em",
              }}
            >
              b
            </span>
          </div>

          <div>
            <h1
              style={{
                color: "#111827",
                fontSize: "28px",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                margin: "0 0 8px",
              }}
            >
              beenhere
            </h1>
            <p
              style={{
                color: "#6b7280",
                fontSize: "15px",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Leave words in places.
              <br />
              Discover people by following stories.
            </p>
          </div>
        </div>

        <Suspense
          fallback={
            <button
              disabled
              type="button"
              style={{
                appearance: "none",
                background: "#f3f4f6",
                border: "1px solid #e5e7eb",
                borderRadius: "14px",
                color: "#9ca3af",
                cursor: "default",
                fontSize: "15px",
                fontWeight: 600,
                padding: "14px 24px",
                width: "100%",
              }}
            >
              Continue
            </button>
          }
        >
          <LoginForm />
        </Suspense>

        <p
          style={{
            color: "#9ca3af",
            fontSize: "12px",
            lineHeight: 1.6,
            margin: 0,
            textAlign: "center",
          }}
        >
          Guest account can be linked to Google later from your profile.
        </p>
      </div>
    </main>
  );
}


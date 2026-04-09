"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
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

  const [loading, setLoading] = useState(false);
  const [runtimeErrorMessage, setRuntimeErrorMessage] = useState<string | null>(
    null,
  );
  const displayErrorMessage = runtimeErrorMessage ?? queryErrorMessage;

  async function handleGoogleLogin() {
    if (loading) return;
    setLoading(true);
    setRuntimeErrorMessage(null);

    const result = await startGoogleOAuth({
      intent: "login",
      nextPath: "/",
    });

    if (!result.ok) {
      setLoading(false);
      setRuntimeErrorMessage(result.error || "Login failed. Please try again.");
    }
  }

  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
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
        disabled={loading}
        onClick={handleGoogleLogin}
        type="button"
        style={{
          alignItems: "center",
          appearance: "none",
          background: loading ? "#f3f4f6" : "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "14px",
          boxShadow: "0 2px 8px rgba(17, 24, 39, 0.08)",
          color: "#111827",
          cursor: loading ? "default" : "pointer",
          display: "flex",
          fontSize: "15px",
          fontWeight: 600,
          gap: "10px",
          justifyContent: "center",
          opacity: loading ? 0.7 : 1,
          padding: "14px 24px",
          transition: "opacity 0.15s",
          width: "100%",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"
          />
          <path
            fill="#34A853"
            d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"
          />
          <path
            fill="#FBBC05"
            d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"
          />
          <path
            fill="#EA4335"
            d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"
          />
        </svg>
        {loading ? "Signing in..." : "Continue with Google"}
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
          gap: "40px",
          maxWidth: "360px",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
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

          <div
            style={{
              background: "#ffffff",
              border: "1px solid rgba(17, 24, 39, 0.08)",
              borderRadius: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              padding: "16px",
              textAlign: "left",
              width: "100%",
            }}
          >
            {[
              { icon: "•", text: "Nearby-first feed based on your location" },
              { icon: "•", text: "Likes are shared with place context" },
              { icon: "•", text: "Explore people through local posts" },
            ].map(({ icon, text }) => (
              <div
                key={text}
                style={{
                  alignItems: "center",
                  display: "flex",
                  gap: "10px",
                }}
              >
                <span style={{ fontSize: "16px", flexShrink: 0 }}>{icon}</span>
                <span
                  style={{
                    color: "#374151",
                    fontSize: "13px",
                    lineHeight: 1.4,
                  }}
                >
                  {text}
                </span>
              </div>
            ))}
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
              Continue with Google
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
          Login enables posting, liking, and profile features.
        </p>
      </div>
    </main>
  );
}

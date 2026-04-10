"use client";

import { useEffect, useRef, useState } from "react";
import type { Coordinates } from "@/lib/geo/browser-location";
import { resolvePlaceLabelWithCache } from "@/lib/geo/place-label-cache";
import { API_ERROR_CODE } from "@/lib/api/common-errors";
import { createPostClient, submitRateLimitConsentClient } from "@/lib/api/feed-client";
import type { FeedItem } from "@/types/domain";
import { useMountedRef } from "@/lib/hooks/use-mounted-ref";

const MAX_CHARS = 300;

type ComposeStatus =
  | "ready"
  | "submitting"
  | "error";

type RateLimitDetails = {
  consentRequired: boolean;
  retryAfterSeconds: number | null;
  limit: number | null;
  windowSeconds: number | null;
};

type Props = {
  coords: Coordinates;
  currentUserId: string | null;
  currentNickname: string | null;
  onSuccess: (item: FeedItem) => void;
  onDismiss: () => void;
};

export function ComposeSheet({
  coords,
  currentUserId,
  currentNickname,
  onSuccess,
  onDismiss,
}: Props) {
  const [status, setStatus] = useState<ComposeStatus>("ready");
  const [placeLabel, setPlaceLabel] = useState<string>("현재 위치");
  const [content, setContent] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rateLimitDetails, setRateLimitDetails] = useState<RateLimitDetails | null>(null);
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const [consentSubmitting, setConsentSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mountedRef = useMountedRef();

  function parseRateLimitDetails(details: unknown): RateLimitDetails {
    if (!details || typeof details !== "object" || Array.isArray(details)) {
      return {
        consentRequired: false,
        retryAfterSeconds: null,
        limit: null,
        windowSeconds: null,
      };
    }

    const record = details as Record<string, unknown>;
    return {
      consentRequired: record.consentRequired === true,
      retryAfterSeconds:
        typeof record.retryAfterSeconds === "number" && Number.isFinite(record.retryAfterSeconds)
          ? Math.max(Math.floor(record.retryAfterSeconds), 0)
          : null,
      limit:
        typeof record.limit === "number" && Number.isFinite(record.limit)
          ? record.limit
          : null,
      windowSeconds:
        typeof record.windowSeconds === "number" && Number.isFinite(record.windowSeconds)
          ? record.windowSeconds
          : null,
    };
  }

  function formatRetryAfter(seconds: number | null) {
    if (seconds === null) {
      return "잠시 후 다시 시도해 주세요.";
    }
    if (seconds <= 0) {
      return "지금 다시 시도해 주세요.";
    }
    if (seconds < 60) {
      return `${seconds}초 후 다시 시도해 주세요.`;
    }

    const minutes = Math.ceil(seconds / 60);
    return `약 ${minutes}분 후 다시 시도해 주세요.`;
  }

  // 시트는 즉시 편집 가능하게 열고, 장소 라벨은 백그라운드로 갱신한다.
  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 100);

    resolvePlaceLabelWithCache(coords, {
      onRevalidated: (latestLabel) => {
        if (!mountedRef.current) return;
        setPlaceLabel(latestLabel);
      },
    })
      .then((label) => {
        if (!mountedRef.current) return;
        setPlaceLabel(label);
      })
      .catch(() => {
        // fallback("현재 위치")로 계속 작성 가능
      });
  }, [coords, mountedRef]);

  async function submitPost(trimmedContent: string) {
    setStatus("submitting");
    setErrorMessage(null);
    setRateLimitDetails(null);

    const result = await createPostClient({
      content: trimmedContent,
      latitude: coords.latitude,
      longitude: coords.longitude,
      placeLabel,
    });

    if (!mountedRef.current) return;

    if (!result.ok) {
      if (result.code === API_ERROR_CODE.RATE_LIMITED) {
        const details = parseRateLimitDetails(result.details);
        setRateLimitDetails(details);
        setStatus("error");

        if (details.consentRequired) {
          setConsentDialogOpen(true);
          setErrorMessage("작성이 일시적으로 제한되었어요. 계속하려면 안내에 동의해 주세요.");
          return;
        }

        setErrorMessage(`작성 제한에 도달했어요. ${formatRetryAfter(details.retryAfterSeconds)}`);
        return;
      }

      setStatus("error");
      setErrorMessage(result.error ?? "글을 올리지 못했어요. 다시 시도해 주세요.");
      return;
    }

    const newItem: FeedItem = {
      postId: result.data.postId,
      content: trimmedContent,
      authorId: currentUserId ?? "unknown",
      authorNickname: currentNickname ?? "나",
      lastSharerId: currentUserId ?? "unknown",
      lastSharerNickname: currentNickname ?? "나",
      likerUserIds: [],
      likerNicknames: [],
      placeLabel,
      distanceMeters: 0,
      relativeTime: "방금 전",
      likeCount: 0,
      myLike: false,
    };

    onSuccess(newItem);
  }

  async function handleSubmit() {
    const trimmed = content.trim();
    if (!trimmed || status !== "ready") return;

    await submitPost(trimmed);
  }

  async function handleConsentAgree() {
    if (consentSubmitting) return;

    setConsentSubmitting(true);
    const consentResult = await submitRateLimitConsentClient();
    if (!mountedRef.current) return;

    if (!consentResult.ok) {
      setConsentSubmitting(false);
      setErrorMessage(consentResult.error ?? "동의 처리에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setConsentDialogOpen(false);
    setConsentSubmitting(false);
    setStatus("ready");

    const trimmed = content.trim();
    if (trimmed) {
      await submitPost(trimmed);
    }
  }

  const remaining = MAX_CHARS - content.length;
  const isOverLimit = content.length > MAX_CHARS;
  const canSubmit = content.trim().length > 0 && !isOverLimit && status === "ready";

  return (
    <>
      <div
        className="compose-sheet-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) onDismiss();
        }}
      >
        <button
          aria-label="닫기"
          className="compose-sheet-overlay__backdrop"
          onClick={onDismiss}
          type="button"
        />

        <div
          className="compose-sheet-panel"
          style={{
            background: "#ffffff",
            borderRadius: "24px 24px 0 0",
            padding: "20px 20px calc(env(safe-area-inset-bottom, 0px) + 20px)",
            position: "relative",
            width: "100%",
            maxWidth: "640px",
            zIndex: 13,
          }}
        >
          <div
            style={{
              background: "#e5e7eb",
              borderRadius: "9999px",
              height: "4px",
              margin: "0 auto 20px",
              width: "40px",
            }}
          />

          <div
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <div>
              <p
                style={{
                  color: "#111827",
                  fontSize: "15px",
                  fontWeight: 700,
                  lineHeight: "32px",
                  margin: "0",
                }}
              >
                이 장소에 글 남기기 · {placeLabel}
              </p>
            </div>
            <button
              aria-label="닫기"
              onClick={onDismiss}
              type="button"
              style={{
                alignItems: "center",
                appearance: "none",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                flexShrink: 0,
                height: "32px",
                justifyContent: "center",
                padding: 0,
                width: "32px",
              }}
            >
              <img
                src="/images/close-button.png"
                alt=""
                width={24}
                height={24}
                style={{ display: "block" }}
              />
            </button>
          </div>

          <textarea
            ref={textareaRef}
            disabled={status === "submitting"}
            maxLength={MAX_CHARS + 10}
            onChange={(e) => {
              setContent(e.target.value);
              if (consentDialogOpen) {
                setConsentDialogOpen(false);
              }
              if (status === "error") setStatus("ready");
            }}
            placeholder="지금 이 장소에서 떠오르는 이야기를 남겨보세요"
            rows={5}
            value={content}
            style={{
              background: "#f9fafb",
              border: `1px solid ${isOverLimit ? "#ef4444" : "#e5e7eb"}`,
              borderRadius: "16px",
              color: "#111827",
              fontSize: "15px",
              lineHeight: 1.6,
              marginBottom: "8px",
              outline: "none",
              padding: "14px 16px",
              resize: "none",
              width: "100%",
            }}
          />

          <div
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <span style={{ color: "#ef4444", fontSize: "12px" }}>
              {errorMessage ?? ""}
            </span>
            <span
              style={{
                color: isOverLimit ? "#ef4444" : "#9ca3af",
                fontSize: "12px",
                fontWeight: isOverLimit ? 600 : 400,
              }}
            >
              {remaining < 0 ? remaining : `${content.length} / ${MAX_CHARS}`}
            </span>
          </div>

          <button
            disabled={!canSubmit}
            onClick={handleSubmit}
            type="button"
            style={{
              appearance: "none",
              background: canSubmit ? "#111827" : "#9ca3af",
              border: "none",
              borderRadius: "14px",
              color: "#ffffff",
              cursor: canSubmit ? "pointer" : "default",
              fontSize: "15px",
              fontWeight: 700,
              padding: "14px",
              transition: "background 0.15s",
              width: "100%",
            }}
          >
            {status === "submitting" ? "올리는 중…" : "글 남기기"}
          </button>
        </div>
      </div>

      {consentDialogOpen ? (
        <>
          <button
            aria-label="닫기"
            onClick={() => {
              if (consentSubmitting) return;
              setConsentDialogOpen(false);
            }}
            type="button"
            style={{
              appearance: "none",
              background: "rgba(17, 24, 39, 0.45)",
              border: "none",
              cursor: consentSubmitting ? "default" : "pointer",
              inset: 0,
              padding: 0,
              position: "fixed",
              zIndex: 30,
            }}
          />
          <div
            aria-label="작성 제한 안내"
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
                textAlign: "center",
              }}
            >
              작성 제한 안내
            </h2>
            <p
              style={{
                color: "#4b5563",
                fontSize: "13px",
                lineHeight: 1.6,
                margin: "0 0 14px",
              }}
            >
              과도한 도배를 막기 위해 작성 빈도를 제한하고 있어요.
              동의하면 제한 시간이 지나자마자 다시 작성할 수 있어요.
            </p>
            <p
              style={{
                color: "#6b7280",
                fontSize: "12px",
                lineHeight: 1.5,
                margin: "0 0 16px",
              }}
            >
              {rateLimitDetails?.limit && rateLimitDetails.windowSeconds
                ? `${rateLimitDetails.windowSeconds}초 동안 최대 ${rateLimitDetails.limit}회 작성할 수 있어요.`
                : "잠시 후 다시 시도해 주세요."}
              {" "}
              {formatRetryAfter(rateLimitDetails?.retryAfterSeconds ?? null)}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                disabled={consentSubmitting}
                onClick={() => {
                  void handleConsentAgree();
                }}
                type="button"
                style={{
                  appearance: "none",
                  background: consentSubmitting ? "#9ca3af" : "#111827",
                  border: "none",
                  borderRadius: "12px",
                  color: "#ffffff",
                  cursor: consentSubmitting ? "default" : "pointer",
                  fontSize: "14px",
                  fontWeight: 700,
                  padding: "12px 14px",
                  textAlign: "center",
                }}
              >
                {consentSubmitting ? "동의 처리 중..." : "동의하고 다시 시도"}
              </button>
              <button
                disabled={consentSubmitting}
                onClick={() => {
                  setConsentDialogOpen(false);
                }}
                type="button"
                style={{
                  appearance: "none",
                  background: "none",
                  border: "none",
                  color: "#6b7280",
                  cursor: consentSubmitting ? "default" : "pointer",
                  fontSize: "13px",
                  fontWeight: 500,
                  padding: "6px 0 0",
                  textAlign: "center",
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { Coordinates } from "@/lib/geo/browser-location";
import { resolvePlaceLabel } from "@/lib/geo/reverse-geocode";
import { createPostClient } from "@/lib/api/feed-client";
import type { FeedItem } from "@/types/domain";

const MAX_CHARS = 300;

type ComposeStatus =
  | "resolving"   // placeLabel 역지오코딩 중
  | "ready"       // 작성 가능
  | "submitting"  // 제출 중
  | "error";      // 에러

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
  const [status, setStatus] = useState<ComposeStatus>("resolving");
  const [placeLabel, setPlaceLabel] = useState<string>("");
  const [content, setContent] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 마운트 시 역지오코딩 실행
  useEffect(() => {
    resolvePlaceLabel(coords)
      .then((label) => {
        if (!mountedRef.current) return;
        setPlaceLabel(label);
        setStatus("ready");
        // 포커스
        setTimeout(() => textareaRef.current?.focus(), 100);
      })
      .catch(() => {
        if (!mountedRef.current) return;
        // 역지오코딩 실패해도 작성은 가능하게 처리 (기본 라벨 사용)
        setPlaceLabel("현재 위치");
        setStatus("ready");
        setTimeout(() => textareaRef.current?.focus(), 100);
      });
  }, [coords]);

  async function handleSubmit() {
    const trimmed = content.trim();
    if (!trimmed || status !== "ready") return;

    setStatus("submitting");
    setErrorMessage(null);

    const result = await createPostClient({
      content: trimmed,
      latitude: coords.latitude,
      longitude: coords.longitude,
      placeLabel,
    });

    if (!mountedRef.current) return;

    if (!result.ok) {
      setStatus("error");
      setErrorMessage(result.error ?? "글을 올리지 못했어요. 다시 시도해 주세요.");
      return;
    }

    // 낙관적 피드 아이템 구성
    const newItem: FeedItem = {
      postId: result.data.postId,
      content: trimmed,
      authorId: currentUserId ?? "unknown",
      authorNickname: currentNickname ?? "나",
      lastSharerId: currentUserId ?? "unknown",
      lastSharerNickname: currentNickname ?? "나",
      placeLabel,
      distanceMeters: 0,
      relativeTime: "방금 전",
      likeCount: 0,
      myLike: false,
    };

    onSuccess(newItem);
  }

  const remaining = MAX_CHARS - content.length;
  const isOverLimit = content.length > MAX_CHARS;
  const canSubmit = content.trim().length > 0 && !isOverLimit && status === "ready";

  return (
    <>
      {/* 오버레이 */}
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

        {/* 시트 패널 */}
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
          {/* 핸들 */}
          <div
            style={{
              background: "#e5e7eb",
              borderRadius: "9999px",
              height: "4px",
              margin: "0 auto 20px",
              width: "40px",
            }}
          />

          {/* 헤더 */}
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
                  margin: "0 0 2px",
                }}
              >
                이 장소에 글 남기기
              </p>
              <p style={{ color: "#9ca3af", fontSize: "12px", margin: 0 }}>
                {status === "resolving" ? "위치 확인 중…" : placeLabel}
              </p>
            </div>
            <button
              aria-label="닫기"
              onClick={onDismiss}
              type="button"
              style={{
                appearance: "none",
                background: "#f3f4f6",
                border: "none",
                borderRadius: "9999px",
                color: "#6b7280",
                cursor: "pointer",
                fontSize: "18px",
                height: "32px",
                lineHeight: "32px",
                padding: 0,
                textAlign: "center",
                width: "32px",
              }}
            >
              ×
            </button>
          </div>

          {/* 텍스트 영역 */}
          <textarea
            ref={textareaRef}
            disabled={status === "resolving" || status === "submitting"}
            maxLength={MAX_CHARS + 10}
            onChange={(e) => {
              setContent(e.target.value);
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

          {/* 글자 수 + 에러 */}
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

          {/* 제출 버튼 */}
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
    </>
  );
}

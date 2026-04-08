"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ProfileLikeItem,
  ProfilePostItem as ProfilePostItemType,
} from "@/types/domain";
import type { Coordinates } from "@/lib/geo/browser-location";
import {
  getCurrentBrowserCoordinates,
  isGeoPermissionDenied,
} from "@/lib/geo/browser-location";
import { likePostClient, deletePostClient } from "@/lib/api/feed-client";
import { useProfile, type ProfileTab } from "@/lib/hooks/use-profile";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { FeedReportDialog } from "@/components/feed/feed-report-dialog";
import { reportPostClient } from "@/lib/api/feed-client";
import type { ReportState } from "@/lib/hooks/use-post-actions";
import { ProfileHeader } from "./profile-header";
import { ProfilePostItem } from "./profile-post-item";
import { ProfileLikeItem as ProfileLikeItemCard } from "./profile-like-item";
import { ProfileBlockDialog } from "./profile-block-dialog";

type Props = {
  userId: string;
  initialNickname: string;
  isMyProfile: boolean;
  currentUserId: string | null;
  nicknameChangedAt?: string | null;
};

const TAB_LABELS: Record<ProfileTab, string> = {
  posts: "작성한 글",
  likes: "라이크한 글",
};

export function ProfileScreen({
  userId,
  initialNickname,
  isMyProfile,
  currentUserId,
  nicknameChangedAt,
}: Props) {
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNickname);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [reportState, setReportState] = useState<ReportState>({
    postId: null,
    submitting: false,
    errorMessage: null,
    successMessage: null,
  });
  const [likeError, setLikeError] = useState<string | null>(null);
  const coordsRef = useRef<Coordinates | null>(null);
  const likePendingRef = useRef<Set<string>>(new Set());

  const {
    activeTab,
    setActiveTab,
    posts,
    likes,
    loadMorePosts,
    loadMoreLikes,
    expandedLikersId,
    likersMap,
    toggleLikers,
    updatePost,
    updateLike,
    removePost,
  } = useProfile(userId, isMyProfile);

  const hasLocationCoords = coordsRef.current !== null;

  // ---------------------------
  // 라이크 (위치 재요청)
  // ---------------------------

  async function ensureCoords(): Promise<Coordinates | null> {
    if (coordsRef.current) return coordsRef.current;
    setLikeError(null);

    try {
      const coords = await getCurrentBrowserCoordinates();
      coordsRef.current = coords;
      return coords;
    } catch (err) {
      if (isGeoPermissionDenied(err)) {
        setLikeError("위치 권한을 허용하면 라이크할 수 있어요.");
      } else {
        setLikeError("현재 위치를 확인하지 못했어요. 다시 시도해 주세요.");
      }
      return null;
    }
  }

  async function handleLikePost(item: ProfilePostItemType | ProfileLikeItem) {
    if (likePendingRef.current.has(item.postId)) return;

    const coords = await ensureCoords();
    if (!coords) return;

    const placeLabel =
      "placeLabel" in item && item.placeLabel ? item.placeLabel : "현재 위치";

    likePendingRef.current.add(item.postId);

    // 낙관적 업데이트
    const patch = { myLike: true as const, likeCount: item.likeCount + 1 };
    if (activeTab === "posts") {
      updatePost(item.postId, patch);
    } else {
      updateLike(item.postId, patch);
    }

    const result = await likePostClient(item.postId, {
      latitude: coords.latitude,
      longitude: coords.longitude,
      placeLabel,
    });

    likePendingRef.current.delete(item.postId);

    if (!result.ok) {
      const rollback = { myLike: false, likeCount: item.likeCount };
      if (activeTab === "posts") {
        updatePost(item.postId, rollback);
      } else {
        updateLike(item.postId, rollback);
      }
      setLikeError(result.error ?? "라이크에 실패했어요.");
    } else {
      const updated = { likeCount: result.data.likeCount };
      if (activeTab === "posts") {
        updatePost(item.postId, updated);
      } else {
        updateLike(item.postId, updated);
      }
    }
  }

  // ---------------------------
  // 삭제
  // ---------------------------

  async function handleDeletePost(postId: string) {
    removePost(postId);
    await deletePostClient(postId);
  }

  // ---------------------------
  // 신고
  // ---------------------------

  function openReport(postId: string) {
    setReportState({ postId, submitting: false, errorMessage: null, successMessage: null });
  }

  function closeReport() {
    setReportState((s) => ({ ...s, postId: null }));
  }

  async function handleReport(reasonCode: string) {
    const postId = reportState.postId;
    if (!postId) return;

    setReportState((s) => ({ ...s, submitting: true, errorMessage: null }));

    const result = await reportPostClient(postId, reasonCode);

    if (!result.ok) {
      setReportState((s) => ({
        ...s,
        submitting: false,
        errorMessage: "신고를 처리하지 못했어요.",
      }));
    } else {
      setReportState((s) => ({
        ...s,
        submitting: false,
        successMessage: "신고가 접수됐어요.",
      }));
    }
  }

  // ---------------------------
  // 차단 완료 후 뒤로 가기
  // ---------------------------

  function handleBlocked() {
    setBlockDialogOpen(false);
    router.back();
  }

  // ---------------------------
  // 렌더링
  // ---------------------------

  return (
    <div
      style={{
        background: "#f9fafb",
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
      }}
    >
      <ProfileHeader
        nickname={nickname}
        isMyProfile={isMyProfile}
        nicknameChangedAt={nicknameChangedAt}
        onBlockClick={() => setBlockDialogOpen(true)}
        onNicknameChange={setNickname}
      />

      {/* 닉네임 표시 영역 */}
      <div
        style={{
          background: "#ffffff",
          borderBottom: "1px solid rgba(17, 24, 39, 0.06)",
          padding: "20px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            color: "#111827",
            fontSize: "22px",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            margin: 0,
          }}
        >
          {nickname}
        </p>
      </div>

      {/* 탭 */}
      <div
        style={{
          background: "#ffffff",
          borderBottom: "1px solid rgba(17, 24, 39, 0.06)",
          display: "flex",
          position: "sticky",
          top: "57px",
          zIndex: 3,
        }}
      >
        {(["posts", "likes"] as ProfileTab[]).map((tab) => (
          <button
            key={tab}
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            type="button"
            style={{
              appearance: "none",
              background: "none",
              border: "none",
              borderBottom: `2px solid ${activeTab === tab ? "#111827" : "transparent"}`,
              color: activeTab === tab ? "#111827" : "#9ca3af",
              cursor: "pointer",
              flex: 1,
              fontSize: "13px",
              fontWeight: activeTab === tab ? 700 : 500,
              padding: "12px 0",
              transition: "color 0.15s",
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* 라이크 에러 메시지 */}
      {likeError ? (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            borderBottom: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: "13px",
            lineHeight: 1.5,
            padding: "10px 20px",
          }}
        >
          {likeError}
        </div>
      ) : null}

      {/* 탭 콘텐츠 */}
      <div style={{ flex: 1, padding: "16px" }}>
        {activeTab === "posts" ? (
          <PostsTabContent
            state={posts}
            isMyProfile={isMyProfile}
            currentUserId={currentUserId}
            locationAvailable={hasLocationCoords}
            expandedLikersId={expandedLikersId}
            likersMap={likersMap}
            onLikeCountClick={toggleLikers}
            onLike={handleLikePost}
            onDelete={handleDeletePost}
            onReport={openReport}
            onLoadMore={loadMorePosts}
          />
        ) : (
          <LikesTabContent
            state={likes}
            likerId={userId}
            likerNickname={nickname}
            locationAvailable={hasLocationCoords}
            onLike={handleLikePost}
            onReport={openReport}
            onLoadMore={loadMoreLikes}
          />
        )}
      </div>

      {/* 신고 다이얼로그 */}
      {reportState.postId ? (
        <FeedReportDialog
          reportState={reportState}
          onConfirm={handleReport}
          onClose={closeReport}
        />
      ) : null}

      {/* 차단 다이얼로그 */}
      {blockDialogOpen ? (
        <ProfileBlockDialog
          targetNickname={nickname}
          targetUserId={userId}
          onBlocked={handleBlocked}
          onClose={() => setBlockDialogOpen(false)}
        />
      ) : null}
    </div>
  );
}

// ---------------------------
// 작성한 글 탭
// ---------------------------

type PostLikersState = {
  items: import("@/types/domain").PostLikerItem[];
  nextCursor: string | null;
  loading: boolean;
};

type PostsTabProps = {
  state: ReturnType<typeof useProfile>["posts"];
  isMyProfile: boolean;
  currentUserId: string | null;
  locationAvailable: boolean;
  expandedLikersId: string | null;
  likersMap: Record<string, PostLikersState | undefined>;
  onLikeCountClick: (postId: string) => void;
  onLike: (item: ProfilePostItemType) => void;
  onDelete: (postId: string) => void;
  onReport: (postId: string) => void;
  onLoadMore: () => void;
};

function PostsTabContent({
  state,
  isMyProfile,
  currentUserId,
  expandedLikersId,
  likersMap,
  onLikeCountClick,
  onDelete,
  onReport,
  onLoadMore,
}: PostsTabProps) {
  if (state.loading) return <LoadingState label="작성한 글 불러오는 중" />;
  if (state.errorMessage)
    return <ErrorState message={state.errorMessage} />;
  if (state.items.length === 0)
    return (
      <p
        style={{
          color: "#9ca3af",
          fontSize: "14px",
          padding: "40px 0",
          textAlign: "center",
        }}
      >
        작성한 글이 없어요.
      </p>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {state.items.map((item) => (
        <ProfilePostItem
          key={item.postId}
          item={item}
          isMyProfile={isMyProfile}
          currentUserId={currentUserId}
          expandedLikersId={expandedLikersId}
          likersMap={likersMap}
          onLikeCountClick={onLikeCountClick}
          onDelete={onDelete}
          onReport={onReport}
        />
      ))}

      {state.nextCursor && !state.loadingMore ? (
        <button
          onClick={onLoadMore}
          type="button"
          style={{
            appearance: "none",
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: "9999px",
            color: "#374151",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            padding: "12px",
            width: "100%",
          }}
        >
          더 보기
        </button>
      ) : null}

      {state.loadingMore ? <LoadingState label="더 불러오는 중" /> : null}
    </div>
  );
}

// ---------------------------
// 라이크한 글 탭
// ---------------------------

type LikesTabProps = {
  state: ReturnType<typeof useProfile>["likes"];
  likerId: string;
  likerNickname: string;
  locationAvailable: boolean;
  onLike: (item: ProfileLikeItem) => void;
  onReport: (postId: string) => void;
  onLoadMore: () => void;
};

function LikesTabContent({
  state,
  likerId,
  likerNickname,
  locationAvailable,
  onLike,
  onReport,
  onLoadMore,
}: LikesTabProps) {
  if (state.loading) return <LoadingState label="라이크한 글 불러오는 중" />;
  if (state.errorMessage)
    return <ErrorState message={state.errorMessage} />;
  if (state.items.length === 0)
    return (
      <p
        style={{
          color: "#9ca3af",
          fontSize: "14px",
          padding: "40px 0",
          textAlign: "center",
        }}
      >
        라이크한 글이 없어요.
      </p>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {state.items.map((item) => (
        <ProfileLikeItemCard
          key={item.postId}
          item={item}
          likerId={likerId}
          likerNickname={likerNickname}
          locationAvailable={locationAvailable}
          onLike={onLike}
          onReport={onReport}
        />
      ))}

      {state.nextCursor && !state.loadingMore ? (
        <button
          onClick={onLoadMore}
          type="button"
          style={{
            appearance: "none",
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: "9999px",
            color: "#374151",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            padding: "12px",
            width: "100%",
          }}
        >
          더 보기
        </button>
      ) : null}

      {state.loadingMore ? <LoadingState label="더 불러오는 중" /> : null}
    </div>
  );
}

import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { API_ERROR_CODE, API_ERROR_MESSAGE } from "@/lib/api/common-errors";
import {
  createPostRepository,
  deletePostRepository,
  likePostRepository,
  unlikePostRepository,
  reportPostRepository,
} from "./repository/mutations";
import { emitFeedStateChanged, FEED_STATE_CHANGE_REASON } from "@/lib/feed-state/events";
import { validatePostContent } from "./validators";

// ---------------------------
// createPost
// ---------------------------

type CreatePostInput = {
  content: string;
  latitude: number;
  longitude: number;
  placeLabel: string;
  clientRequestId?: string;
};

type CreatePostResult =
  | { ok: true; postId: string }
  | { ok: false; code: string; message: string };

export async function createPost(input: CreatePostInput): Promise<CreatePostResult> {
  const validation = validatePostContent(input.content);

  if (!validation.valid) {
    return {
      ok: false,
      code: API_ERROR_CODE.VALIDATION_ERROR,
      message: validation.message ?? "내용을 다시 확인해 주세요.",
    };
  }

  if (!hasSupabaseBrowserConfig()) {
    return { ok: true, postId: "mock-post-id" };
  }

  const result = await createPostRepository(input);
  void emitFeedStateChanged(FEED_STATE_CHANGE_REASON.POST_CREATED);
  return { ok: true, postId: result.post_id };
}

// ---------------------------
// likePost
// ---------------------------

type LikePostInput = {
  postId: string;
  latitude: number;
  longitude: number;
  placeLabel: string;
};

type LikePostResult =
  | { ok: true; likeCount: number }
  | { ok: false; code: string; message: string };

// Supabase PostgreSQL 예외 코드 → API 에러 코드 매핑
const LIKE_RPC_ERROR_MAP: Record<string, { code: string; message: string; status: number }> = {
  P0001: { code: API_ERROR_CODE.UNAUTHORIZED,    message: API_ERROR_MESSAGE.AUTH_REQUIRED, status: 401 },
  P0002: { code: API_ERROR_CODE.ALREADY_LIKED,   message: "이미 수집한 글이에요.", status: 409 },
  P0003: { code: API_ERROR_CODE.POST_NOT_FOUND,  message: "글을 찾을 수 없어요.",  status: 404 },
  "23505": { code: API_ERROR_CODE.ALREADY_LIKED, message: "이미 수집한 글이에요.", status: 409 },
};

export async function likePost(input: LikePostInput): Promise<LikePostResult & { status?: number }> {
  if (!hasSupabaseBrowserConfig()) {
    return { ok: true, likeCount: 1 };
  }

  try {
    const result = await likePostRepository(input);
    void emitFeedStateChanged(FEED_STATE_CHANGE_REASON.POST_LIKED);
    return { ok: true, likeCount: Number(result.like_count) };
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    const mapped = LIKE_RPC_ERROR_MAP[code];
    if (mapped) {
      if (mapped.code === API_ERROR_CODE.ALREADY_LIKED) {
        const currentLikeCount = await readPostLikeCountRepository(input.postId);
        return {
          ok: true,
          likeCount: currentLikeCount,
        };
      }
      return { ok: false, ...mapped };
    }
    throw err;
  }
}

// ---------------------------
// unlikePost
// ---------------------------

type UnlikePostResult =
  | { ok: true; likeCount: number }
  | { ok: false; code: string; message: string };

const UNLIKE_RPC_ERROR_MAP: Record<
  string,
  { code: string; message: string; status: number }
> = {
  P0001: {
    code: API_ERROR_CODE.UNAUTHORIZED,
    message: API_ERROR_MESSAGE.AUTH_REQUIRED,
    status: 401,
  },
  P0003: {
    code: API_ERROR_CODE.POST_NOT_FOUND,
    message: "글을 찾을 수 없어요.",
    status: 404,
  },
};

export async function unlikePost(
  postId: string,
): Promise<UnlikePostResult & { status?: number }> {
  if (!hasSupabaseBrowserConfig()) {
    return { ok: true, likeCount: 0 };
  }

  try {
    const result = await unlikePostRepository(postId);
    void emitFeedStateChanged(FEED_STATE_CHANGE_REASON.POST_UNLIKED);
    return { ok: true, likeCount: Number(result.like_count) };
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    const mapped = UNLIKE_RPC_ERROR_MAP[code];
    if (mapped) return { ok: false, ...mapped };
    throw err;
  }
}

// ---------------------------
// deletePost
// ---------------------------

type DeletePostResult =
  | { ok: true }
  | { ok: false; code: string; message: string; status?: number };

export async function deletePost(postId: string): Promise<DeletePostResult> {
  if (!hasSupabaseBrowserConfig()) {
    return { ok: true };
  }

  try {
    await deletePostRepository(postId);
    void emitFeedStateChanged(FEED_STATE_CHANGE_REASON.POST_DELETED);
    return { ok: true };
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    if (code === "P0003") {
      return {
        ok: false,
        code: API_ERROR_CODE.POST_NOT_FOUND,
        message: "글을 찾을 수 없거나 이미 삭제되었어요.",
        status: 404,
      };
    }
    throw err;
  }
}

// ---------------------------
// reportPost
// ---------------------------

const VALID_REASON_CODES = new Set([
  "spam",
  "harassment",
  "misinformation",
  "other",
]);

type ReportPostInput = {
  postId: string;
  reasonCode: string;
};

type ReportPostResult =
  | { ok: true; alreadyReported: boolean }
  | { ok: false; code: string; message: string };

export async function reportPost(input: ReportPostInput): Promise<ReportPostResult> {
  if (!VALID_REASON_CODES.has(input.reasonCode)) {
    return {
      ok: false,
      code: API_ERROR_CODE.INVALID_REASON_CODE,
      message: "올바르지 않은 신고 사유예요.",
    };
  }

  if (!hasSupabaseBrowserConfig()) {
    return { ok: true, alreadyReported: false };
  }

  const result = await reportPostRepository(input);
  return { ok: true, alreadyReported: result.alreadyReported };
}

async function readPostLikeCountRepository(postId: string): Promise<number> {
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("posts")
    .select("like_count")
    .eq("id", postId)
    .maybeSingle();

  if (error) throw error;
  return Number(data?.like_count ?? 0);
}

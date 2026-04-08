import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import {
  createPostRepository,
  deletePostRepository,
  likePostRepository,
  reportPostRepository,
} from "./repository/mutations";
import { validatePostContent } from "./validators";

// ---------------------------
// createPost
// ---------------------------

type CreatePostInput = {
  content: string;
  latitude: number;
  longitude: number;
  placeLabel: string;
};

type CreatePostResult =
  | { ok: true; postId: string }
  | { ok: false; code: string; message: string };

export async function createPost(input: CreatePostInput): Promise<CreatePostResult> {
  const validation = validatePostContent(input.content);

  if (!validation.valid) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: validation.message ?? "내용을 다시 확인해 주세요.",
    };
  }

  if (!hasSupabaseBrowserConfig()) {
    return { ok: true, postId: "mock-post-id" };
  }

  const result = await createPostRepository(input);
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
  P0001: { code: "UNAUTHORIZED",      message: "로그인이 필요해요.",             status: 401 },
  P0002: { code: "ALREADY_LIKED",     message: "이미 라이크한 글이에요.",         status: 409 },
  P0003: { code: "POST_NOT_FOUND",    message: "글을 찾을 수 없어요.",            status: 404 },
  P0004: { code: "CANNOT_LIKE_OWN",   message: "내 글은 라이크할 수 없어요.",     status: 403 },
};

export async function likePost(input: LikePostInput): Promise<LikePostResult & { status?: number }> {
  if (!hasSupabaseBrowserConfig()) {
    return { ok: true, likeCount: 1 };
  }

  try {
    const result = await likePostRepository(input);
    return { ok: true, likeCount: Number(result.like_count) };
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    const mapped = LIKE_RPC_ERROR_MAP[code];
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
    return { ok: true };
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    if (code === "P0003") {
      return {
        ok: false,
        code: "POST_NOT_FOUND",
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
  | { ok: true }
  | { ok: false; code: string; message: string };

export async function reportPost(input: ReportPostInput): Promise<ReportPostResult> {
  if (!VALID_REASON_CODES.has(input.reasonCode)) {
    return {
      ok: false,
      code: "INVALID_REASON_CODE",
      message: "올바르지 않은 신고 사유예요.",
    };
  }

  if (!hasSupabaseBrowserConfig()) {
    return { ok: true };
  }

  await reportPostRepository(input);
  return { ok: true };
}

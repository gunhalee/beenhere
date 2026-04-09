import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { refreshFeedStateBestEffort } from "@/lib/posts/repository/feed-state";
import { API_ERROR_CODE } from "@/lib/api/common-errors";
import type { PostStatus } from "@/types/db";
import type { ModerationReportItem } from "@/types/api";

type ModerationReportRow = {
  id: string;
  post_id: string;
  reporter_id: string;
  reason_code: string;
  created_at: string;
};

type ModerationPostRow = {
  id: string;
  author_id: string;
  status: PostStatus;
  content: string;
};

type ModerationReporterRow = {
  id: string;
  nickname: string;
};

export async function listModerationReportsRepository(limit = 50) {
  const supabase = await createSupabaseAdminClient();

  const { data: reports, error: reportsError } = await supabase
    .from("reports")
    .select("id, post_id, reporter_id, reason_code, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (reportsError) throw reportsError;

  const rows = (reports ?? []) as ModerationReportRow[];
  if (rows.length === 0) return [];

  const postIds = [...new Set(rows.map((row) => row.post_id))];
  const reporterIds = [...new Set(rows.map((row) => row.reporter_id))];

  const [{ data: posts, error: postsError }, { data: reporters, error: reportersError }] =
    await Promise.all([
      supabase
        .from("posts")
        .select("id, author_id, status, content")
        .in("id", postIds),
      supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", reporterIds),
    ]);

  if (postsError) throw postsError;
  if (reportersError) throw reportersError;

  const postById = new Map(
    ((posts ?? []) as ModerationPostRow[]).map((post) => [post.id, post]),
  );
  const reporterById = new Map(
    ((reporters ?? []) as ModerationReporterRow[]).map((profile) => [
      profile.id,
      profile.nickname,
    ]),
  );

  return rows.map<ModerationReportItem>((row) => {
    const post = postById.get(row.post_id);

    return {
      reportId: row.id,
      postId: row.post_id,
      reporterId: row.reporter_id,
      reporterNickname: reporterById.get(row.reporter_id) ?? null,
      reasonCode: row.reason_code,
      reportedAt: row.created_at,
      postStatus: post?.status ?? null,
      postAuthorId: post?.author_id ?? null,
      postContent: post?.content ?? null,
    };
  });
}

export async function hidePostByReportRepository(reportId: string) {
  const supabase = await createSupabaseAdminClient();

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("id, post_id")
    .eq("id", reportId)
    .maybeSingle();

  if (reportError) throw reportError;
  if (!report) {
    throw Object.assign(new Error("Report not found"), {
      code: API_ERROR_CODE.REPORT_NOT_FOUND,
    });
  }

  const postId = String(report.post_id);
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id, status")
    .eq("id", postId)
    .maybeSingle();

  if (postError) throw postError;
  if (!post) {
    throw Object.assign(new Error("Post not found"), {
      code: API_ERROR_CODE.POST_NOT_FOUND,
    });
  }

  if (post.status === "hidden") {
    return { reportId, postId, hidden: false, alreadyHidden: true };
  }

  const { error: updateError } = await supabase
    .from("posts")
    .update({ status: "hidden" })
    .eq("id", postId);

  if (updateError) throw updateError;
  await refreshFeedStateBestEffort("moderation_hide_post");

  return { reportId, postId, hidden: true, alreadyHidden: false };
}

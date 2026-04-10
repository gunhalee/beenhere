import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type ConsumeQuotaInput = {
  supabase: SupabaseServerClient;
  userId: string;
  isAnonymous: boolean;
};

type ConsumeQuotaResult = {
  allowed: boolean;
  remaining: number;
  resetAt: string | null;
};

const ANONYMOUS_WRITE_LIMIT = 10;
const ANONYMOUS_WRITE_WINDOW_SECONDS = 60;

export async function consumeAnonymousWriteQuota({
  supabase,
  userId,
  isAnonymous,
}: ConsumeQuotaInput): Promise<ConsumeQuotaResult> {
  if (!isAnonymous) {
    return { allowed: true, remaining: Number.MAX_SAFE_INTEGER, resetAt: null };
  }

  const { data, error } = await supabase.rpc("consume_anonymous_write_quota", {
    p_user_id: userId,
    p_limit: ANONYMOUS_WRITE_LIMIT,
    p_window_seconds: ANONYMOUS_WRITE_WINDOW_SECONDS,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return { allowed: true, remaining: Number.MAX_SAFE_INTEGER, resetAt: null };
  }

  const allowed = Boolean((row as { allowed?: unknown }).allowed);
  const remainingRaw = (row as { remaining?: unknown }).remaining;
  const resetAtRaw = (row as { reset_at?: unknown }).reset_at;

  return {
    allowed,
    remaining:
      typeof remainingRaw === "number" && Number.isFinite(remainingRaw)
        ? remainingRaw
        : 0,
    resetAt: typeof resetAtRaw === "string" ? resetAtRaw : null,
  };
}

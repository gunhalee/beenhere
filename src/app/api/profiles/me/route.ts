import { ok, fail } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseBrowserConfig, hasSupabaseServerConfig } from "@/lib/supabase/config";
import { generateNickname } from "@/lib/nickname/generate";
import {
  getMyProfileRepository,
  regenerateNicknameRepository,
} from "@/lib/profiles/repository";

// GET /api/profiles/me — 본인 프로필 조회 (닉네임 쿨다운 정보 포함)
export async function GET() {
  if (!hasSupabaseBrowserConfig()) {
    return ok({
      id: "mock-user-id",
      nickname: generateNickname(),
      nicknameChangedAt: null,
    });
  }

  const profile = await getMyProfileRepository();

  if (!profile) {
    return fail("로그인이 필요해요.", 401, "UNAUTHORIZED");
  }

  return ok({
    id: profile.id,
    nickname: profile.nickname,
    nicknameChangedAt: profile.nicknameChangedAt,
  });
}

// PATCH /api/profiles/me — 닉네임 재생성
export async function PATCH() {
  if (!hasSupabaseBrowserConfig()) {
    return ok({ nickname: generateNickname() });
  }

  const profile = await getMyProfileRepository();

  if (!profile) {
    return fail("로그인이 필요해요.", 401, "UNAUTHORIZED");
  }

  const result = await regenerateNicknameRepository(
    profile.id,
    profile.nicknameChangedAt,
  );

  if (!result.ok) {
    const body: Record<string, unknown> = { error: result.message, code: result.code };
    if ("daysRemaining" in result) body.daysRemaining = result.daysRemaining;
    return fail(result.message, 429, result.code);
  }

  return ok({ nickname: result.nickname });
}

// POST /api/profiles/me — 온보딩: 프로필 생성 (최초 1회)
export async function POST(request: Request) {
  if (!hasSupabaseServerConfig()) {
    return ok({ nickname: generateNickname() });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("요청 형식이 올바르지 않습니다.", 400);
  }

  const nickname =
    body !== null &&
    typeof body === "object" &&
    "nickname" in body &&
    typeof (body as Record<string, unknown>).nickname === "string"
      ? ((body as Record<string, unknown>).nickname as string).trim()
      : null;

  if (!nickname || nickname.length < 2 || nickname.length > 30) {
    return fail("닉네임은 2~30자여야 합니다.", 400);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return fail("로그인이 필요합니다.", 401);
  }

  // 이미 프로필이 있으면 생성 불가
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (existing) {
    return fail("이미 프로필이 존재합니다.", 409);
  }

  const { error: insertError } = await supabase
    .from("profiles")
    .insert({ id: user.id, nickname });

  if (insertError) {
    if (insertError.code === "23505") {
      return fail("이미 사용 중인 닉네임입니다.", 409);
    }
    return fail("프로필 생성에 실패했습니다.", 500);
  }

  return ok({ nickname });
}

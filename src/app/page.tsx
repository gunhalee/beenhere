// 피드 홈 — 비로그인도 읽기 가능 (PRD 6.1, auth_required: read_only)
// 위치 권한 없으면 피드 제한, 자신의 프로필 열람만 가능 (PRD 7.1)

import { FeedScreen } from "@/components/feed/feed-screen";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  let currentUserId: string | null = null;
  let currentNickname: string | null = null;

  if (hasSupabaseBrowserConfig()) {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        currentUserId = user.id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("nickname")
          .eq("id", user.id)
          .single();
        currentNickname = profile?.nickname ?? null;
      }
    } catch {
      // Supabase 설정 없을 때 (로컬 개발) — mock 모드로 계속
    }
  }

  return (
    <FeedScreen
      currentUserId={currentUserId}
      currentNickname={currentNickname}
    />
  );
}

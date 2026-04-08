// 프로필 페이지 — 비로그인도 읽기 가능 (PRD 7.7)
// 차단 관계에 있으면 API 레벨에서 빈 결과 반환

import { notFound } from "next/navigation";
import { ProfileScreen } from "@/components/profile/profile-screen";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ userId: string }>;
};

export default async function ProfilePage({ params }: Props) {
  const { userId } = await params;

  let profileNickname = "beenhere 사용자";
  let currentUserId: string | null = null;
  let nicknameChangedAt: string | null = null;

  if (hasSupabaseBrowserConfig()) {
    try {
      const supabase = await createSupabaseServerClient();

      // 대상 프로필 조회
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", userId)
        .single();

      if (error || !profile) {
        notFound();
      }

      profileNickname = profile.nickname as string;

      // 현재 로그인 사용자 조회
      const {
        data: { user },
      } = await supabase.auth.getUser();
      currentUserId = user?.id ?? null;

      // 본인 프로필이면 쿨다운 정보도 조회
      if (currentUserId && currentUserId === userId) {
        const { data: myProfile } = await supabase
          .from("profiles")
          .select("nickname_changed_at")
          .eq("id", userId)
          .single();
        nicknameChangedAt =
          (myProfile?.nickname_changed_at as string | null) ?? null;
      }
    } catch {
      // Supabase 미설정(로컬 개발) — mock 닉네임으로 진행
    }
  }

  const isMyProfile = currentUserId === userId;

  return (
    <ProfileScreen
      userId={userId}
      initialNickname={profileNickname}
      isMyProfile={isMyProfile}
      currentUserId={currentUserId}
      nicknameChangedAt={nicknameChangedAt}
    />
  );
}

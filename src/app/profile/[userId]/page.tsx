// 프로필 페이지 — 비로그인도 읽기 가능 (PRD 7.7)
// 실제 프로필 데이터/접근 제어는 /api/profiles 계층에서 처리한다.

import { ProfileScreen } from "@/components/profile/profile-screen";

type Props = {
  params: Promise<{ userId: string }>;
};

export default async function ProfilePage({ params }: Props) {
  const { userId } = await params;

  return <ProfileScreen userId={userId} />;
}

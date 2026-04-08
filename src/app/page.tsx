// 피드 홈 — 비로그인도 읽기 가능 (PRD 6.1, auth_required: read_only)
// 위치 권한 없으면 피드 제한, 자신의 프로필 열람만 가능 (PRD 7.1)

import { FeedScreen } from "@/components/feed/feed-screen";

export default function HomePage() {
  return <FeedScreen />;
}

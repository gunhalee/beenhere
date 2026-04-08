import type { FeedItem } from "@/types/domain";

const MOCK_ITEMS: FeedItem[] = [
  {
    postId: "mock-post-1",
    content: "여기 골목에 고양이들이 많이 살아요. 오늘도 세 마리 봤어요.",
    authorId: "mock-user-1",
    authorNickname: "BraveOtter",
    lastSharerId: "mock-user-1",
    lastSharerNickname: "BraveOtter",
    placeLabel: "마포구",
    distanceMeters: 240,
    relativeTime: "5분 전",
    likeCount: 3,
    myLike: false,
  },
  {
    postId: "mock-post-2",
    content: "이 근처 새로 생긴 서점 진짜 좋다. 책 향기 나는 공간이 이제 얼마 없는데.",
    authorId: "mock-user-2",
    authorNickname: "CalmRaven",
    lastSharerId: "mock-user-3",
    lastSharerNickname: "QuickFox",
    placeLabel: "마포구",
    distanceMeters: 580,
    relativeTime: "2시간 전",
    likeCount: 12,
    myLike: false,
  },
  {
    postId: "mock-post-3",
    content: "공사 소음 진짜 너무 심하다. 아침 7시부터 시작하는 건 좀 아니지 않나요.",
    authorId: "mock-user-4",
    authorNickname: "SilentWolf",
    lastSharerId: "mock-user-4",
    lastSharerNickname: "SilentWolf",
    placeLabel: "서대문구",
    distanceMeters: 1200,
    relativeTime: "어제",
    likeCount: 7,
    myLike: false,
  },
];

export function getMockFeedItems(): FeedItem[] {
  return MOCK_ITEMS;
}

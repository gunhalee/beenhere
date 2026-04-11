import type { FeedItem } from "@/types/domain";

const MOCK_ITEMS: FeedItem[] = [
  {
    postId: "mock-post-1",
    content: "Cats gather in this alley every evening.",
    authorId: "mock-user-1",
    authorNickname: "BraveOtter",
    placeLabel: "Mapo-gu",
    distanceMeters: 240,
    relativeTime: "5분 전",
    likeCount: 3,
    myLike: false,
  },
  {
    postId: "mock-post-2",
    content: "This new cafe is unexpectedly great. Their tea is worth trying.",
    authorId: "mock-user-2",
    authorNickname: "CalmRaven",
    placeLabel: "Mapo-gu",
    distanceMeters: 580,
    relativeTime: "2시간 전",
    likeCount: 12,
    myLike: false,
  },
  {
    postId: "mock-post-3",
    content: "Roadwork starts at 7 AM again tomorrow, heads up.",
    authorId: "mock-user-4",
    authorNickname: "SilentWolf",
    placeLabel: "Seodaemun-gu",
    distanceMeters: 1200,
    relativeTime: "어제",
    likeCount: 7,
    myLike: false,
  },
];

export function getMockFeedItems(): FeedItem[] {
  return MOCK_ITEMS;
}

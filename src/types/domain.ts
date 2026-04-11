export type FeedItem = {
  postId: string;
  content: string;
  authorId: string;
  authorNickname: string;
  placeLabel: string;
  distanceMeters: number;
  relativeTime: string;
  likeCount: number;
  myLike: boolean;
};

export type FeedLikerPreview = {
  userId: string | null;
  nickname: string;
};

export type FeedCursor = {
  distanceMeters: number;
  lastActivityAt: string;
  postId: string;
  radiusMeters: number;
};

export type Profile = {
  id: string;
  nickname: string;
  createdAt: string;
};

export type MyProfile = Profile & {
  nicknameChangedAt: string | null;
  profileCreated: boolean;
  isAnonymous: boolean;
};

export type ProfilePostItem = {
  postId: string;
  content: string;
  placeLabel: string | null;
  distanceMeters: number | null;
  relativeTime: string;
  likeCount: number;
  myLike: boolean;
};

export type ProfileLikeItem = {
  postId: string;
  content: string;
  authorId: string;
  authorNickname: string;
  placeLabel: string | null;
  distanceMeters: number | null;
  relativeTime: string;
  likePlaceLabel?: string | null;
  likeDistanceMeters?: number | null;
  likeRelativeTime?: string;
  likeCount: number;
  myLike: boolean;
};

export type PostLikerItem = {
  userId: string;
  nickname: string;
  likedAt: string;
  likedAtRelative: string;
  likePlaceLabel: string;
};

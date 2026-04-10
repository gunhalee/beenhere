export type PostStatus = "active" | "deleted" | "hidden";

export type NearbyFeedRow = {
  post_id: string;
  content: string;
  author_id: string;
  author_nickname: string;
  last_sharer_id: string;
  last_sharer_nickname: string;
  place_label: string;
  distance_meters: number;
  last_activity_at: string;
  original_place_label: string | null;
  original_distance_meters: number | null;
  original_created_at: string;
  like_count: number;
  my_like: boolean;
};

export type ProfilePostRow = {
  post_id: string;
  content: string;
  place_label: string | null;
  distance_meters: number | null;
  last_activity_at: string;
  post_created_at: string;
  like_count: number;
  my_like: boolean;
};

export type ProfileLikeRow = {
  post_id: string;
  content: string;
  author_id: string;
  author_nickname: string;
  place_label: string | null;
  distance_meters: number | null;
  last_activity_at: string;
  like_id: string;
  like_created_at: string;
  like_place_label: string | null;
  like_distance_meters: number | null;
  like_count: number;
  my_like: boolean;
};

export type PostLikerRow = {
  user_id: string;
  nickname: string;
  liked_at: string;
  like_id: string;
  like_place_label: string;
};

export type CreatePostRpcResult = {
  post_id: string;
};

export type LikePostRpcResult = {
  like_count: number;
};

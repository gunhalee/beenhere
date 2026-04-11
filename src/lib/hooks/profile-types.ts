import type { PaginatedListState } from "./use-paginated-list";
import type { PostLikerItem } from "@/types/domain";

export type ProfileTab = "posts" | "likes";

export type ProfileListState<T> = PaginatedListState<T>;

export type ProfileLikersState = {
  items: PostLikerItem[];
  nextCursor: string | null;
  loading: boolean;
};

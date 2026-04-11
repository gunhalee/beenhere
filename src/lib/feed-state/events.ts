import { refreshFeedStateBestEffort } from "@/lib/posts/repository/feed-state";

export const FEED_STATE_CHANGE_REASON = {
  POST_CREATED: "post_created",
  POST_LIKED: "post_liked",
  POST_UNLIKED: "post_unliked",
  POST_DELETED: "post_deleted",
  POST_HIDDEN: "post_hidden",
} as const;

export type FeedStateChangeReason =
  (typeof FEED_STATE_CHANGE_REASON)[keyof typeof FEED_STATE_CHANGE_REASON];

export function emitFeedStateChanged(reason: FeedStateChangeReason) {
  return refreshFeedStateBestEffort(reason);
}

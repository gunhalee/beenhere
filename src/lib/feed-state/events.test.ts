import { describe, expect, it, vi } from "vitest";
import {
  emitFeedStateChanged,
  FEED_STATE_CHANGE_REASON,
} from "./events";
import { refreshFeedStateBestEffort } from "@/lib/posts/repository/feed-state";

vi.mock("@/lib/posts/repository/feed-state", () => ({
  refreshFeedStateBestEffort: vi.fn(),
}));

describe("feed-state events", () => {
  it("forwards standardized reason to best-effort refresh", () => {
    emitFeedStateChanged(FEED_STATE_CHANGE_REASON.POST_CREATED);

    expect(refreshFeedStateBestEffort).toHaveBeenCalledWith("post_created");
  });
});

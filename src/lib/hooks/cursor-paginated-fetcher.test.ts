import { describe, expect, it, vi } from "vitest";
import { createCursorPaginatedFetcher } from "./cursor-paginated-fetcher";

describe("createCursorPaginatedFetcher", () => {
  it("maps api success result to paginated success shape", async () => {
    const requestPage = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        items: [{ id: "item-1" }],
        nextCursor: "cursor-1",
      },
    });

    const fetchPage = createCursorPaginatedFetcher<{ id: string }>(requestPage);
    const result = await fetchPage("cursor-0");

    expect(requestPage).toHaveBeenCalledWith("cursor-0");
    expect(result).toEqual({
      ok: true,
      data: {
        items: [{ id: "item-1" }],
        nextCursor: "cursor-1",
      },
    });
  });

  it("maps api error result to paginated error shape", async () => {
    const requestPage = vi.fn().mockResolvedValue({
      ok: false,
      error: "request failed",
      code: "INTERNAL_ERROR",
    });

    const fetchPage = createCursorPaginatedFetcher<{ id: string }>(requestPage);
    const result = await fetchPage();

    expect(requestPage).toHaveBeenCalledWith(undefined);
    expect(result).toEqual({
      ok: false,
      error: "request failed",
    });
  });
});

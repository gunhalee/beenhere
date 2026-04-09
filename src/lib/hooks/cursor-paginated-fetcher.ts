import type { ApiResult } from "@/types/api";
import type { PaginatedFetchResult } from "./use-paginated-list";

type CursorPaginatedData<T> = {
  items: T[];
  nextCursor: string | null;
};

type CursorPaginatedApiResult<T> = ApiResult<CursorPaginatedData<T>>;

export function createCursorPaginatedFetcher<T>(
  requestPage: (cursor?: string) => Promise<CursorPaginatedApiResult<T>>,
): (cursor?: string) => Promise<PaginatedFetchResult<T>> {
  return async (cursor?: string): Promise<PaginatedFetchResult<T>> => {
    const result = await requestPage(cursor);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return { ok: true, data: result.data };
  };
}

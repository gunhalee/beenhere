"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMountedRef } from "./use-mounted-ref";

export type PaginatedListData<TItem> = {
  items: TItem[];
  nextCursor: string | null;
};

export type PaginatedFetchResult<TItem> =
  | { ok: true; data: PaginatedListData<TItem> }
  | { ok: false; error?: string };

export type PaginatedListState<TItem> = {
  items: TItem[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  errorMessage: string | null;
};

type UsePaginatedListParams<TItem> = {
  fetchPage: (cursor?: string) => Promise<PaginatedFetchResult<TItem>>;
  defaultErrorMessage: string;
  initialLoading?: boolean;
};

type UsePaginatedListReturn<TItem> = {
  state: PaginatedListState<TItem>;
  load: () => Promise<boolean>;
  loadMore: () => Promise<boolean>;
  mutateItems: (updater: (items: TItem[]) => TItem[]) => void;
  prependItem: (item: TItem) => void;
};

export function usePaginatedList<TItem>({
  fetchPage,
  defaultErrorMessage,
  initialLoading = true,
}: UsePaginatedListParams<TItem>): UsePaginatedListReturn<TItem> {
  const [state, setState] = useState<PaginatedListState<TItem>>({
    items: [],
    nextCursor: null,
    loading: initialLoading,
    loadingMore: false,
    errorMessage: null,
  });

  const mountedRef = useMountedRef();
  const loadingMoreRef = useRef(false);
  const nextCursorRef = useRef<string | null>(null);

  useEffect(() => {
    nextCursorRef.current = state.nextCursor;
  }, [state.nextCursor]);

  const load = useCallback(async () => {
    if (!mountedRef.current) return false;

    setState((s) => ({
      ...s,
      loading: true,
      errorMessage: null,
    }));

    const result = await fetchPage();

    if (!mountedRef.current) return false;

    if (!result.ok) {
      setState((s) => ({
        ...s,
        loading: false,
        loadingMore: false,
        errorMessage: result.error ?? defaultErrorMessage,
      }));
      return false;
    }

    setState({
      items: result.data.items,
      nextCursor: result.data.nextCursor,
      loading: false,
      loadingMore: false,
      errorMessage: null,
    });
    return true;
  }, [defaultErrorMessage, fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return false;
    const cursor = nextCursorRef.current;
    if (!cursor) return false;

    loadingMoreRef.current = true;
    setState((s) => ({ ...s, loadingMore: true, errorMessage: null }));

    const result = await fetchPage(cursor);
    loadingMoreRef.current = false;

    if (!mountedRef.current) return false;

    if (!result.ok) {
      setState((s) => ({
        ...s,
        loadingMore: false,
        errorMessage: result.error ?? defaultErrorMessage,
      }));
      return false;
    }

    setState((s) => ({
      ...s,
      items: [...s.items, ...result.data.items],
      nextCursor: result.data.nextCursor,
      loadingMore: false,
      errorMessage: null,
    }));
    return true;
  }, [defaultErrorMessage, fetchPage]);

  const mutateItems = useCallback((updater: (items: TItem[]) => TItem[]) => {
    setState((s) => ({
      ...s,
      items: updater(s.items),
    }));
  }, []);

  const prependItem = useCallback((item: TItem) => {
    setState((s) => ({
      ...s,
      items: [item, ...s.items],
    }));
  }, []);

  return {
    state,
    load,
    loadMore,
    mutateItems,
    prependItem,
  };
}

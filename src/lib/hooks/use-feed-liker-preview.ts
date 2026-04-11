"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FeedLikerPreview, FeedItem } from "@/types/domain";
import {
  fetchFeedLikersPreview,
  mapFeedLikerPreviewByPostId,
} from "@/lib/api/feed-client";

type Coordinates = {
  latitude: number;
  longitude: number;
};

const PREVIEW_BATCH_SIZE = 12;

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function useFeedLikerPreview(input: {
  items: FeedItem[];
  coordsRef: { current: Coordinates | null };
}) {
  const [previewMap, setPreviewMap] = useState<Record<string, FeedLikerPreview[]>>({});
  const loadedPostIdsRef = useRef<Set<string>>(new Set());
  const lastCoordsKeyRef = useRef<string | null>(null);

  const previewPostIds = useMemo(
    () => input.items.filter((item) => item.likeCount > 0).map((item) => item.postId),
    [input.items],
  );

  const loadPreview = useCallback(async () => {
    const coords = input.coordsRef.current;
    if (!coords || previewPostIds.length === 0) {
      setPreviewMap({});
      loadedPostIdsRef.current = new Set();
      lastCoordsKeyRef.current = null;
      return;
    }

    const coordsKey = `${coords.latitude}|${coords.longitude}`;
    if (lastCoordsKeyRef.current !== coordsKey) {
      loadedPostIdsRef.current = new Set();
      setPreviewMap({});
      lastCoordsKeyRef.current = coordsKey;
    }

    const pendingPostIds = previewPostIds.filter(
      (postId) => !loadedPostIdsRef.current.has(postId),
    );
    if (pendingPostIds.length === 0) {
      return;
    }

    const batches = chunk(pendingPostIds, PREVIEW_BATCH_SIZE);

    for (const postIds of batches) {
      const result = await fetchFeedLikersPreview({
        latitude: coords.latitude,
        longitude: coords.longitude,
        postIds,
      });

      if (!result.ok) {
        continue;
      }

      for (const postId of postIds) {
        loadedPostIdsRef.current.add(postId);
      }

      setPreviewMap((prev) => ({
        ...prev,
        ...mapFeedLikerPreviewByPostId(result.data.items),
      }));
    }
  }, [input.coordsRef, previewPostIds]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  return {
    previewMap,
  };
}

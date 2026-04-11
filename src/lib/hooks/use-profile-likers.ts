"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPostLikersClient } from "@/lib/api/profile-client";
import { useMountedRef } from "./use-mounted-ref";
import type { ProfileLikersState } from "./profile-types";

export function useProfileLikers(isMyProfile: boolean, userId: string) {
  const [likersMap, setLikersMap] = useState<
    Record<string, ProfileLikersState | undefined>
  >({});
  const [expandedLikersId, setExpandedLikersId] = useState<string | null>(null);

  const mountedRef = useMountedRef();
  const inFlightLikersRef = useRef<Set<string>>(new Set());
  const likersMapRef = useRef(likersMap);

  useEffect(() => {
    likersMapRef.current = likersMap;
  }, [likersMap]);

  useEffect(() => {
    setExpandedLikersId(null);
    setLikersMap({});
  }, [userId]);

  const toggleLikers = useCallback(
    async (postId: string) => {
      if (!isMyProfile) return;

      if (expandedLikersId === postId) {
        setExpandedLikersId(null);
        return;
      }

      setExpandedLikersId(postId);

      if (likersMapRef.current[postId] || inFlightLikersRef.current.has(postId)) {
        return;
      }

      inFlightLikersRef.current.add(postId);
      setLikersMap((prev) => ({
        ...prev,
        [postId]: { items: [], nextCursor: null, loading: true },
      }));

      const result = await fetchPostLikersClient(postId);
      inFlightLikersRef.current.delete(postId);

      if (!mountedRef.current) return;

      if (!result.ok) {
        setLikersMap((prev) => ({
          ...prev,
          [postId]: { items: [], nextCursor: null, loading: false },
        }));
        return;
      }

      setLikersMap((prev) => ({
        ...prev,
        [postId]: {
          items: result.data.items,
          nextCursor: result.data.nextCursor,
          loading: false,
        },
      }));
    },
    [expandedLikersId, isMyProfile, mountedRef],
  );

  return {
    expandedLikersId,
    likersMap,
    toggleLikers,
    resetLikers: () => {
      setExpandedLikersId(null);
      setLikersMap({});
    },
  };
}

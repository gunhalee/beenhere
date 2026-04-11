"use client";

import { useEffect, useState } from "react";
import { fetchMyProfileClient } from "@/lib/api/profile-client";
import { API_ERROR_CODE } from "@/lib/api/common-errors";
import { useMountedRef } from "./use-mounted-ref";

type Params = {
  currentUserId?: string | null;
  currentNickname?: string | null;
  onAuthRequired: () => void;
};

export function useCurrentProfile({
  currentUserId,
  currentNickname,
  onAuthRequired,
}: Params) {
  const [resolvedCurrentUserId, setResolvedCurrentUserId] = useState(currentUserId ?? null);
  const [resolvedCurrentNickname, setResolvedCurrentNickname] = useState(
    currentNickname ?? null,
  );
  const mountedRef = useMountedRef();

  useEffect(() => {
    if (resolvedCurrentUserId && resolvedCurrentNickname) {
      return;
    }

    async function resolveCurrentProfile() {
      const result = await fetchMyProfileClient();
      if (!mountedRef.current) return;

      if (!result.ok) {
        if (result.code === API_ERROR_CODE.UNAUTHORIZED) {
          onAuthRequired();
        }
        return;
      }

      setResolvedCurrentUserId(result.data.id);
      setResolvedCurrentNickname(result.data.nickname);
    }

    void resolveCurrentProfile();
  }, [mountedRef, onAuthRequired, resolvedCurrentNickname, resolvedCurrentUserId]);

  return {
    resolvedCurrentUserId,
    resolvedCurrentNickname,
  };
}

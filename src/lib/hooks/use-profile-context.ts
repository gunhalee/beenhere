"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchMyProfileClient,
  fetchProfileClient,
} from "@/lib/api/profile-client";
import { useMountedRef } from "./use-mounted-ref";

export type ProfileContextLoadState = "loading" | "ready" | "error";

export function useProfileContext(userId: string) {
  const [profileLoadState, setProfileLoadState] =
    useState<ProfileContextLoadState>("loading");
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(
    null,
  );
  const [nickname, setNickname] = useState("프로필 불러오는 중…");
  const [isMyProfile, setIsMyProfile] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [nicknameChangedAt, setNicknameChangedAt] = useState<string | null>(
    null,
  );
  const mountedRef = useMountedRef();
  const requestTokenRef = useRef(0);

  useEffect(() => {
    requestTokenRef.current += 1;
    const requestToken = requestTokenRef.current;

    async function loadProfileContext() {
      setProfileLoadState("loading");
      setProfileErrorMessage(null);
      setCurrentUserId(null);
      setNicknameChangedAt(null);
      setIsMyProfile(false);

      const profileResult = await fetchProfileClient(userId);
      if (!mountedRef.current || requestTokenRef.current !== requestToken) return;

      if (!profileResult.ok) {
        setProfileLoadState("error");
        setProfileErrorMessage(
          profileResult.error ?? "프로필을 불러오지 못했어요.",
        );
        return;
      }

      setNickname(profileResult.data.nickname);
      setProfileLoadState("ready");
    }

    async function loadViewerContext() {
      const myProfileResult = await fetchMyProfileClient({ force: true });
      if (!mountedRef.current || requestTokenRef.current !== requestToken) return;

      if (myProfileResult.ok) {
        setCurrentUserId(myProfileResult.data.id);
        setNicknameChangedAt(myProfileResult.data.nicknameChangedAt);
        setIsMyProfile(myProfileResult.data.id === userId);
      }
    }

    void loadProfileContext();
    void loadViewerContext();
  }, [mountedRef, userId]);

  return {
    profileLoadState,
    profileErrorMessage,
    nickname,
    setNickname,
    setNicknameChangedAt,
    isMyProfile,
    currentUserId,
    nicknameChangedAt,
  };
}

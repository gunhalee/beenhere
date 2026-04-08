"use client";

import { useEffect, useState } from "react";
import {
  fetchMyProfileClient,
  fetchProfileClient,
} from "@/lib/api/profile-client";

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

  useEffect(() => {
    let cancelled = false;

    async function loadProfileContext() {
      setProfileLoadState("loading");
      setProfileErrorMessage(null);

      const [profileResult, myProfileResult] = await Promise.all([
        fetchProfileClient(userId),
        fetchMyProfileClient(),
      ]);

      if (cancelled) return;

      if (!profileResult.ok) {
        setProfileLoadState("error");
        setProfileErrorMessage(
          profileResult.error ?? "프로필을 불러오지 못했어요.",
        );
        return;
      }

      setNickname(profileResult.data.nickname);
      setProfileLoadState("ready");

      if (myProfileResult.ok) {
        setCurrentUserId(myProfileResult.data.id);
        setNicknameChangedAt(myProfileResult.data.nicknameChangedAt);
        setIsMyProfile(myProfileResult.data.id === userId);
      } else {
        setCurrentUserId(null);
        setNicknameChangedAt(null);
        setIsMyProfile(false);
      }
    }

    void loadProfileContext();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {
    profileLoadState,
    profileErrorMessage,
    nickname,
    setNickname,
    isMyProfile,
    currentUserId,
    nicknameChangedAt,
  };
}

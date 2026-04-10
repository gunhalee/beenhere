"use client";

import { useEffect } from "react";
import { bootstrapGuestSession } from "@/lib/auth/guest-session";

export function GuestSessionBootstrap() {
  useEffect(() => {
    void bootstrapGuestSession();
  }, []);

  return null;
}

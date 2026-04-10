"use client";

import { useEffect } from "react";
import { bootstrapGuestSession } from "@/lib/auth/guest-session";

export function GuestSessionBootstrap() {
  useEffect(() => {
    void bootstrapGuestSession({
      maxAttempts: 3,
      initialDelayMs: 300,
      backoffFactor: 3,
      jitterMs: 120,
    });
  }, []);

  return null;
}

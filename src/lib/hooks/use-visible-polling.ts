"use client";

import { useEffect } from "react";
import { useLatestRef } from "./use-latest-ref";

type VisibilityAwarePollingCallback = (
  isCancelled: () => boolean,
) => void | boolean | Promise<void | boolean>;

type UseVisiblePollingParams = {
  enabled: boolean;
  intervalMs: number;
  label?: string;
  maxIntervalMs?: number;
  onTick: VisibilityAwarePollingCallback;
  runImmediately?: boolean;
};

const DEFAULT_BACKOFF_MULTIPLIER = 2;

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unknown polling error.";
}

export function useVisiblePolling({
  enabled,
  intervalMs,
  label,
  maxIntervalMs = intervalMs,
  onTick,
  runImmediately = true,
}: UseVisiblePollingParams) {
  const onTickRef = useLatestRef(onTick);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    let cancelled = false;
    let inFlight = false;
    let timeoutId: number | null = null;
    let consecutiveFailureCount = 0;

    const clearScheduledRun = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const getNextDelay = () => {
      if (consecutiveFailureCount === 0) {
        return intervalMs;
      }

      return Math.min(
        maxIntervalMs,
        intervalMs *
          Math.pow(DEFAULT_BACKOFF_MULTIPLIER, consecutiveFailureCount),
      );
    };

    const scheduleNextRun = (delayMs: number) => {
      clearScheduledRun();

      timeoutId = window.setTimeout(() => {
        void run();
      }, delayMs);
    };

    const run = async () => {
      if (cancelled || inFlight) {
        return;
      }

      if (document.hidden) {
        scheduleNextRun(intervalMs);
        return;
      }

      inFlight = true;
      clearScheduledRun();

      try {
        const tickResult = await onTickRef.current(() => cancelled);
        const hasFailed = tickResult === false;

        if (hasFailed) {
          consecutiveFailureCount += 1;

          if (label) {
            console.warn(`[visible-polling] ${label}_failed`, {
              consecutiveFailureCount,
              message: "Polling tick returned failure signal.",
            });
          }
        } else {
          consecutiveFailureCount = 0;
        }
      } catch (error) {
        consecutiveFailureCount += 1;

        if (label) {
          console.warn(`[visible-polling] ${label}_failed`, {
            consecutiveFailureCount,
            message: getErrorMessage(error),
          });
        }
      } finally {
        inFlight = false;

        if (!cancelled) {
          scheduleNextRun(getNextDelay());
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearScheduledRun();
        return;
      }

      void run();
    };

    if (runImmediately) {
      void run();
    } else {
      scheduleNextRun(intervalMs);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      clearScheduledRun();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, intervalMs, label, maxIntervalMs, onTickRef, runImmediately]);
}

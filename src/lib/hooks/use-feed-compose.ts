"use client";

import { useCallback, useState } from "react";
import type { Coordinates } from "@/lib/geo/browser-location";
import {
  getCachedBrowserCoordinates,
  getCurrentBrowserCoordinates,
  getGeoErrorMessage,
} from "@/lib/geo/browser-location";

type ComposeState =
  | { open: false }
  | { open: true; coords: Coordinates };

type Params = {
  coordsRef: { current: Coordinates | null };
};

export function useFeedCompose({ coordsRef }: Params) {
  const [composeState, setComposeState] = useState<ComposeState>({ open: false });
  const [composeLocating, setComposeLocating] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  const openComposeSheet = useCallback(async () => {
    if (composeLocating) return false;

    setComposeError(null);

    if (coordsRef.current) {
      setComposeState({ open: true, coords: coordsRef.current });
      return true;
    }

    const cachedCoords = getCachedBrowserCoordinates();
    if (cachedCoords) {
      coordsRef.current = cachedCoords;
      setComposeState({ open: true, coords: cachedCoords });
      return true;
    }

    setComposeLocating(true);

    try {
      const coords = await getCurrentBrowserCoordinates({ context: "compose" });
      coordsRef.current = coords;
      setComposeState({ open: true, coords });
      return true;
    } catch (err) {
      setComposeError(getGeoErrorMessage(err, "compose"));
      return false;
    } finally {
      setComposeLocating(false);
    }
  }, [composeLocating, coordsRef]);

  return {
    composeState,
    composeLocating,
    composeError,
    setComposeError,
    openComposeSheet,
    closeComposeSheet: () => setComposeState({ open: false }),
    handleComposeSuccess: () => setComposeState({ open: false }),
  };
}

"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

export function useMountedRef(): MutableRefObject<boolean> {
  const ref = useRef(true);

  useEffect(() => {
    return () => {
      ref.current = false;
    };
  }, []);

  return ref;
}

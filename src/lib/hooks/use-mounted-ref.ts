"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

export function useMountedRef(): MutableRefObject<boolean> {
  const ref = useRef(true);

  useEffect(() => {
    ref.current = true;

    return () => {
      ref.current = false;
    };
  }, []);

  return ref;
}

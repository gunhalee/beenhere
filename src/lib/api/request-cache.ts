import type { ApiResult } from "@/types/api";

type CachedValue<T> = {
  data: T;
  expiresAt: number;
};

type InFlightValue<T> = {
  requestId: number;
  promise: Promise<ApiResult<T>>;
};

type ReadOptions<T> = {
  force?: boolean;
  ttlMs?: number;
  load: () => Promise<ApiResult<T>>;
  shouldCache?: (result: ApiResult<T>) => boolean;
  onResult?: (result: ApiResult<T>) => void;
};

function isFresh<T>(cached: CachedValue<T> | null) {
  return cached != null && cached.expiresAt > Date.now();
}

export function createSingleValueCache<T>() {
  let cached: CachedValue<T> | null = null;
  let inFlight: InFlightValue<T> | null = null;
  let latestRequestId = 0;

  function set(data: T, ttlMs: number) {
    cached = {
      data,
      expiresAt: Date.now() + ttlMs,
    };
  }

  function clear() {
    cached = null;
    inFlight = null;
    latestRequestId += 1;
  }

  async function read({
    force = false,
    ttlMs = 0,
    load,
    shouldCache = (result) => result.ok,
    onResult,
  }: ReadOptions<T>) {
    if (!force && isFresh(cached) && cached) {
      return { ok: true, data: cached.data } as const;
    }

    if (!force && inFlight) {
      return inFlight.promise;
    }

    const requestId = latestRequestId + 1;
    latestRequestId = requestId;

    const promise = load()
      .then((result) => {
        onResult?.(result);
        if (
          ttlMs > 0 &&
          shouldCache(result) &&
          latestRequestId === requestId &&
          result.ok
        ) {
          set(result.data, ttlMs);
        }
        return result;
      })
      .finally(() => {
        if (inFlight?.requestId === requestId) {
          inFlight = null;
        }
      });

    inFlight = { requestId, promise };
    return promise;
  }

  return {
    read,
    set,
    clear,
    getCached: () => cached?.data ?? null,
  };
}

export function createKeyedValueCache<T>() {
  const cached = new Map<string, CachedValue<T>>();
  const inFlight = new Map<string, InFlightValue<T>>();
  const latestRequestIds = new Map<string, number>();

  function set(key: string, data: T, ttlMs: number) {
    cached.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  function getFresh(key: string) {
    const value = cached.get(key);
    if (!value) return null;
    if (value.expiresAt <= Date.now()) {
      cached.delete(key);
      return null;
    }
    return value.data;
  }

  function clear(key?: string) {
    if (key) {
      cached.delete(key);
      inFlight.delete(key);
      latestRequestIds.delete(key);
      return;
    }

    cached.clear();
    inFlight.clear();
    latestRequestIds.clear();
  }

  function clearByPrefix(prefix: string) {
    for (const key of [...cached.keys()]) {
      if (key.startsWith(prefix)) {
        cached.delete(key);
      }
    }

    for (const key of [...inFlight.keys()]) {
      if (key.startsWith(prefix)) {
        inFlight.delete(key);
      }
    }

    for (const key of [...latestRequestIds.keys()]) {
      if (key.startsWith(prefix)) {
        latestRequestIds.delete(key);
      }
    }
  }

  async function read(
    key: string,
    {
      force = false,
      ttlMs = 0,
      load,
      shouldCache = (result) => result.ok,
      onResult,
    }: ReadOptions<T>,
  ) {
    if (!force) {
      const fresh = getFresh(key);
      if (fresh) {
        return { ok: true, data: fresh } as const;
      }

      const pending = inFlight.get(key);
      if (pending) {
        return pending.promise;
      }
    }

    const requestId = (latestRequestIds.get(key) ?? 0) + 1;
    latestRequestIds.set(key, requestId);

    const promise = load()
      .then((result) => {
        onResult?.(result);
        if (
          ttlMs > 0 &&
          shouldCache(result) &&
          latestRequestIds.get(key) === requestId &&
          result.ok
        ) {
          set(key, result.data, ttlMs);
        }
        return result;
      })
      .finally(() => {
        if (inFlight.get(key)?.requestId === requestId) {
          inFlight.delete(key);
        }
      });

    inFlight.set(key, { requestId, promise });
    return promise;
  }

  return {
    read,
    set,
    clear,
    clearByPrefix,
    getFresh,
  };
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchApi } from "./client";
import {
  clearProfileCache,
  clearMyProfileCache,
  fetchProfileClient,
  fetchMyProfileClient,
  updateMyProfileCacheNickname,
} from "./profile-client";

vi.mock("./client", () => ({
  fetchApi: vi.fn(),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("profile-client my-profile cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMyProfileCache();
    clearProfileCache();
  });

  it("returns cached response on repeated calls", async () => {
    vi.mocked(fetchApi).mockResolvedValue({
      ok: true,
      data: {
        id: "user-1",
        nickname: "Nick One",
        nicknameChangedAt: null,
      },
    });

    const first = await fetchMyProfileClient();
    const second = await fetchMyProfileClient();

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(fetchApi).toHaveBeenCalledTimes(1);
  });

  it("dedupes in-flight requests", async () => {
    const deferred = createDeferred<{
      ok: true;
      data: {
        id: string;
        nickname: string;
        nicknameChangedAt: string | null;
      };
    }>();
    vi.mocked(fetchApi).mockReturnValue(deferred.promise);

    const firstPromise = fetchMyProfileClient();
    const secondPromise = fetchMyProfileClient();

    expect(fetchApi).toHaveBeenCalledTimes(1);

    deferred.resolve({
      ok: true,
      data: {
        id: "user-1",
        nickname: "Nick One",
        nicknameChangedAt: null,
      },
    });

    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(first).toEqual(second);
  });

  it("does not let stale in-flight response overwrite newer forced cache", async () => {
    const staleDeferred = createDeferred<{
      ok: true;
      data: {
        id: string;
        nickname: string;
        nicknameChangedAt: string | null;
      };
    }>();
    const latestDeferred = createDeferred<{
      ok: true;
      data: {
        id: string;
        nickname: string;
        nicknameChangedAt: string | null;
      };
    }>();

    vi.mocked(fetchApi)
      .mockReturnValueOnce(staleDeferred.promise)
      .mockReturnValueOnce(latestDeferred.promise);

    const stalePromise = fetchMyProfileClient();
    const latestPromise = fetchMyProfileClient({ force: true });

    latestDeferred.resolve({
      ok: true,
      data: {
        id: "user-1",
        nickname: "Nick Latest",
        nicknameChangedAt: "2026-04-09T01:00:00.000Z",
      },
    });
    await latestPromise;

    staleDeferred.resolve({
      ok: true,
      data: {
        id: "user-1",
        nickname: "Nick Stale",
        nicknameChangedAt: null,
      },
    });
    await stalePromise;

    const cached = await fetchMyProfileClient();

    expect(fetchApi).toHaveBeenCalledTimes(2);
    expect(cached.ok).toBe(true);
    if (cached.ok) {
      expect(cached.data.nickname).toBe("Nick Latest");
      expect(cached.data.nicknameChangedAt).toBe("2026-04-09T01:00:00.000Z");
    }
  });

  it("bypasses cache when force option is used", async () => {
    vi.mocked(fetchApi)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          id: "user-1",
          nickname: "Nick One",
          nicknameChangedAt: null,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          id: "user-1",
          nickname: "Nick Two",
          nicknameChangedAt: "2026-04-09T00:00:00.000Z",
        },
      });

    await fetchMyProfileClient();
    const forced = await fetchMyProfileClient({ force: true });

    expect(fetchApi).toHaveBeenCalledTimes(2);
    expect(forced.ok && forced.data.nickname).toBe("Nick Two");
  });

  it("updates cached nickname when nickname changes locally", async () => {
    vi.mocked(fetchApi).mockResolvedValue({
      ok: true,
      data: {
        id: "user-1",
        nickname: "Nick One",
        nicknameChangedAt: null,
      },
    });

    await fetchMyProfileClient();

    updateMyProfileCacheNickname({
      nickname: "Nick Updated",
      nicknameChangedAt: "2026-04-09T00:00:00.000Z",
    });

    const cached = await fetchMyProfileClient();

    expect(fetchApi).toHaveBeenCalledTimes(1);
    expect(cached.ok).toBe(true);
    if (cached.ok) {
      expect(cached.data.nickname).toBe("Nick Updated");
      expect(cached.data.nicknameChangedAt).toBe("2026-04-09T00:00:00.000Z");
    }
  });

  it("clears caches when my-profile responds with unauthorized", async () => {
    vi.mocked(fetchApi)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          id: "user-1",
          nickname: "Nick One",
          nicknameChangedAt: null,
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: "unauthorized",
        code: "UNAUTHORIZED",
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          id: "user-2",
          nickname: "Nick Two",
          nicknameChangedAt: null,
        },
      });

    await fetchMyProfileClient();
    await fetchMyProfileClient({ force: true });
    const afterUnauthorized = await fetchMyProfileClient();

    expect(fetchApi).toHaveBeenCalledTimes(3);
    expect(afterUnauthorized.ok).toBe(true);
    if (afterUnauthorized.ok) {
      expect(afterUnauthorized.data.id).toBe("user-2");
    }
  });

  it("ignores in-flight response after cache clear", async () => {
    const staleDeferred = createDeferred<{
      ok: true;
      data: {
        id: string;
        nickname: string;
        nicknameChangedAt: string | null;
      };
    }>();

    vi.mocked(fetchApi)
      .mockReturnValueOnce(staleDeferred.promise)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          id: "user-2",
          nickname: "Nick Fresh",
          nicknameChangedAt: null,
        },
      });

    const stalePromise = fetchMyProfileClient();
    clearMyProfileCache();

    staleDeferred.resolve({
      ok: true,
      data: {
        id: "user-1",
        nickname: "Nick Stale",
        nicknameChangedAt: null,
      },
    });
    await stalePromise;

    const afterClear = await fetchMyProfileClient();

    expect(fetchApi).toHaveBeenCalledTimes(2);
    expect(afterClear.ok).toBe(true);
    if (afterClear.ok) {
      expect(afterClear.data.id).toBe("user-2");
      expect(afterClear.data.nickname).toBe("Nick Fresh");
    }
  });
});

describe("profile-client public-profile cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearProfileCache();
  });

  it("caches repeated fetchProfileClient calls for same user", async () => {
    vi.mocked(fetchApi).mockResolvedValue({
      ok: true,
      data: {
        id: "user-1",
        nickname: "User One",
      },
    });

    const first = await fetchProfileClient("user-1");
    const second = await fetchProfileClient("user-1");

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(fetchApi).toHaveBeenCalledTimes(1);
  });

  it("does not share cache across different users", async () => {
    vi.mocked(fetchApi)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          id: "user-1",
          nickname: "User One",
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          id: "user-2",
          nickname: "User Two",
        },
      });

    await fetchProfileClient("user-1");
    await fetchProfileClient("user-2");

    expect(fetchApi).toHaveBeenCalledTimes(2);
  });

  it("dedupes in-flight fetchProfileClient for same user", async () => {
    const deferred = createDeferred<{
      ok: true;
      data: {
        id: string;
        nickname: string;
      };
    }>();
    vi.mocked(fetchApi).mockReturnValue(deferred.promise);

    const firstPromise = fetchProfileClient("user-1");
    const secondPromise = fetchProfileClient("user-1");

    expect(fetchApi).toHaveBeenCalledTimes(1);

    deferred.resolve({
      ok: true,
      data: {
        id: "user-1",
        nickname: "User One",
      },
    });

    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first).toEqual(second);
  });

  it("does not let stale forced response overwrite newer forced cache for same user", async () => {
    const staleDeferred = createDeferred<{
      ok: true;
      data: {
        id: string;
        nickname: string;
      };
    }>();
    const latestDeferred = createDeferred<{
      ok: true;
      data: {
        id: string;
        nickname: string;
      };
    }>();

    vi.mocked(fetchApi)
      .mockReturnValueOnce(staleDeferred.promise)
      .mockReturnValueOnce(latestDeferred.promise);

    const stalePromise = fetchProfileClient("user-1", { force: true });
    const latestPromise = fetchProfileClient("user-1", { force: true });

    latestDeferred.resolve({
      ok: true,
      data: {
        id: "user-1",
        nickname: "User Latest",
      },
    });
    await latestPromise;

    staleDeferred.resolve({
      ok: true,
      data: {
        id: "user-1",
        nickname: "User Stale",
      },
    });
    await stalePromise;

    const cached = await fetchProfileClient("user-1");

    expect(fetchApi).toHaveBeenCalledTimes(2);
    expect(cached.ok).toBe(true);
    if (cached.ok) {
      expect(cached.data.nickname).toBe("User Latest");
    }
  });

  it("ignores in-flight profile response after user cache clear", async () => {
    const staleDeferred = createDeferred<{
      ok: true;
      data: {
        id: string;
        nickname: string;
      };
    }>();

    vi.mocked(fetchApi)
      .mockReturnValueOnce(staleDeferred.promise)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          id: "user-1",
          nickname: "User Fresh",
        },
      });

    const stalePromise = fetchProfileClient("user-1");
    clearProfileCache("user-1");

    staleDeferred.resolve({
      ok: true,
      data: {
        id: "user-1",
        nickname: "User Stale",
      },
    });
    await stalePromise;

    const afterClear = await fetchProfileClient("user-1");

    expect(fetchApi).toHaveBeenCalledTimes(2);
    expect(afterClear.ok).toBe(true);
    if (afterClear.ok) {
      expect(afterClear.data.nickname).toBe("User Fresh");
    }
  });
});

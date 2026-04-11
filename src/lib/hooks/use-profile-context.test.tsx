import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProfileContext } from "./use-profile-context";
import {
  fetchMyProfileClient,
  fetchProfileClient,
} from "@/lib/api/profile-client";

vi.mock("@/lib/api/profile-client", () => ({
  fetchProfileClient: vi.fn(),
  fetchMyProfileClient: vi.fn(),
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

describe("useProfileContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets public profile to ready without waiting for viewer profile", async () => {
    const myProfileDeferred = createDeferred<{
      ok: true;
      data: {
        id: string;
        nickname: string;
        nicknameChangedAt: string | null;
        profileCreated: boolean;
        isAnonymous: boolean;
      };
    }>();

    vi.mocked(fetchProfileClient).mockResolvedValue({
      ok: true,
      data: { id: "user-1", nickname: "Tester" },
    });
    vi.mocked(fetchMyProfileClient).mockReturnValue(myProfileDeferred.promise);

    const { result } = renderHook(() => useProfileContext("user-1"));

    await waitFor(() => {
      expect(result.current.profileLoadState).toBe("ready");
    });
    expect(fetchMyProfileClient).toHaveBeenCalledWith();

    expect(result.current.nickname).toBe("Tester");
    expect(result.current.currentUserId).toBeNull();
    expect(result.current.isMyProfile).toBe(false);

    await act(async () => {
      myProfileDeferred.resolve({
        ok: true,
        data: {
          id: "user-1",
          nickname: "Tester",
          nicknameChangedAt: null,
          profileCreated: true,
          isAnonymous: false,
        },
      });
    });
  });

  it("updates viewer state after my profile resolves", async () => {
    const myProfileDeferred = createDeferred<{
      ok: true;
      data: {
        id: string;
        nickname: string;
        nicknameChangedAt: string | null;
        profileCreated: boolean;
        isAnonymous: boolean;
      };
    }>();

    vi.mocked(fetchProfileClient).mockResolvedValue({
      ok: true,
      data: { id: "user-1", nickname: "Tester" },
    });
    vi.mocked(fetchMyProfileClient).mockReturnValue(myProfileDeferred.promise);

    const { result } = renderHook(() => useProfileContext("user-1"));

    await waitFor(() => {
      expect(result.current.profileLoadState).toBe("ready");
    });

    await act(async () => {
      myProfileDeferred.resolve({
        ok: true,
        data: {
          id: "user-1",
          nickname: "Tester",
          nicknameChangedAt: "2026-04-01T00:00:00.000Z",
          profileCreated: true,
          isAnonymous: true,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.currentUserId).toBe("user-1");
      expect(result.current.isMyProfile).toBe(true);
      expect(result.current.nicknameChangedAt).toBe("2026-04-01T00:00:00.000Z");
      expect(result.current.viewerIsAnonymous).toBe(true);
    });
  });
});

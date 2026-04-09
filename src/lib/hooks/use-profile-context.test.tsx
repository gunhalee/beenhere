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

  it("공개 프로필이 준비되면 내 프로필 응답을 기다리지 않고 ready로 전환한다", async () => {
    const myProfileDeferred = createDeferred<{
      ok: true;
      data: { id: string; nickname: string; nicknameChangedAt: string | null };
    }>();

    vi.mocked(fetchProfileClient).mockResolvedValue({
      ok: true,
      data: { id: "user-1", nickname: "테스터" },
    });
    vi.mocked(fetchMyProfileClient).mockReturnValue(myProfileDeferred.promise);

    const { result } = renderHook(() => useProfileContext("user-1"));

    await waitFor(() => {
      expect(result.current.profileLoadState).toBe("ready");
    });
    expect(fetchMyProfileClient).toHaveBeenCalledWith({ force: true });

    expect(result.current.nickname).toBe("테스터");
    expect(result.current.currentUserId).toBeNull();
    expect(result.current.isMyProfile).toBe(false);

    await act(async () => {
      myProfileDeferred.resolve({
        ok: true,
        data: { id: "user-1", nickname: "테스터", nicknameChangedAt: null },
      });
    });
  });

  it("내 프로필 응답이 오면 currentUserId/isMyProfile를 후행 업데이트한다", async () => {
    const myProfileDeferred = createDeferred<{
      ok: true;
      data: { id: string; nickname: string; nicknameChangedAt: string | null };
    }>();

    vi.mocked(fetchProfileClient).mockResolvedValue({
      ok: true,
      data: { id: "user-1", nickname: "테스터" },
    });
    vi.mocked(fetchMyProfileClient).mockReturnValue(myProfileDeferred.promise);

    const { result } = renderHook(() => useProfileContext("user-1"));

    await waitFor(() => {
      expect(result.current.profileLoadState).toBe("ready");
    });
    expect(fetchMyProfileClient).toHaveBeenCalledWith({ force: true });

    await act(async () => {
      myProfileDeferred.resolve({
        ok: true,
        data: {
          id: "user-1",
          nickname: "테스터",
          nicknameChangedAt: "2026-04-01T00:00:00.000Z",
        },
      });
    });

    await waitFor(() => {
      expect(result.current.currentUserId).toBe("user-1");
      expect(result.current.isMyProfile).toBe(true);
      expect(result.current.nicknameChangedAt).toBe("2026-04-01T00:00:00.000Z");
    });
  });
});

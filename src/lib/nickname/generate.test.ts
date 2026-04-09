import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NICKNAME_COOLDOWN_DAYS,
  canRegenerateNickname,
  daysUntilNicknameRegen,
} from "./generate";

describe("nickname cooldown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-09T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows regeneration when no previous change timestamp exists", () => {
    expect(canRegenerateNickname(null)).toBe(true);
    expect(daysUntilNicknameRegen(null)).toBe(0);
  });

  it("blocks regeneration during cooldown window", () => {
    const changedAt = "2026-04-07T00:00:00.000Z";
    expect(canRegenerateNickname(changedAt)).toBe(false);
    expect(daysUntilNicknameRegen(changedAt)).toBe(NICKNAME_COOLDOWN_DAYS - 2);
  });

  it("allows regeneration after cooldown window passes", () => {
    const changedAt = "2026-04-01T00:00:00.000Z";
    expect(canRegenerateNickname(changedAt)).toBe(true);
    expect(daysUntilNicknameRegen(changedAt)).toBe(0);
  });
});


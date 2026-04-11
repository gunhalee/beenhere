import { describe, expect, it } from "vitest";
import { buildLoginPathWithNext } from "./login-redirect";

describe("buildLoginPathWithNext", () => {
  it("keeps next path and encodes query string", () => {
    const path = buildLoginPathWithNext("/profile/user-1?tab=likes");

    expect(path).toBe("/auth/login?next=%2Fprofile%2Fuser-1%3Ftab%3Dlikes");
  });

  it("adds forceLanding flag when requested", () => {
    const path = buildLoginPathWithNext("/profile/user-1", {
      forceLanding: true,
    });

    expect(path).toBe("/auth/login?next=%2Fprofile%2Fuser-1&forceLanding=1");
  });
});

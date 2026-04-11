import { expect, test } from "@playwright/test";

test.describe("beenhere smoke", () => {
  test("unauthenticated user is redirected to login from home", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/auth\/login\?next=%2F$/);
    await expect(page.locator("h1", { hasText: "beenhere" })).toBeVisible();
  });

  test("protected profile path preserves next query on login redirect", async ({ page }) => {
    await page.goto("/profile/abc");
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fprofile%2Fabc$/);
    await expect(page.locator("h1", { hasText: "beenhere" })).toBeVisible();
  });
});

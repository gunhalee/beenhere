import { expect, test } from "@playwright/test";

test.describe("beenhere smoke", () => {
  test("home renders and unauthenticated user can navigate to login", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/beenhere/i);
    await expect(page.locator("h1", { hasText: "beenhere" })).toBeVisible();
    await expect(page.locator('a[href="/auth/login"]')).toBeVisible();

    await page.locator('a[href="/auth/login"]').click();
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.locator("h1", { hasText: "beenhere" })).toBeVisible();
  });

  test("compose entry follows auth state (login redirect or compose sheet open)", async ({
    page,
  }) => {
    await page.goto("/");

    const composeButton = page.locator('button[aria-label]').first();
    await expect(composeButton).toBeVisible();
    await composeButton.click();

    const redirectedToLogin = /\/auth\/login$/.test(page.url());
    if (redirectedToLogin) {
      await expect(page).toHaveURL(/\/auth\/login$/);
      await expect(page.locator("h1", { hasText: "beenhere" })).toBeVisible();
      return;
    }

    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(".compose-sheet-overlay")).toBeVisible();
  });
});

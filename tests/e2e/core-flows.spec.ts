import { expect, test } from "@playwright/test";

import {
  createInviteCode,
  createTestPair,
  expectNoPageErrors,
  joinTestPair,
  readLegacyCompatCookie,
  readCachedPairId,
  readSessionCookie,
  readStorageDump,
  readStoredLegacyToken,
  TABS,
} from "./helpers";

test.describe("onboarding + core flows", () => {
  test("creates a pair, keeps the session over a reload and shows the dashboard", async ({ page }) => {
    const errors = expectNoPageErrors(page);
    const pair = await createTestPair(page);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const cookie = await readSessionCookie(page);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(cookie?.path).toBe("/");
    expect(cookie?.value).toMatch(/^ps1\./);
    expect(await readStoredLegacyToken(page)).toBeNull();
    expect(await readStorageDump(page)).not.toContain("ps1.");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /Vytvořit náš prostor/ })).toHaveCount(0);
    expect(await readCachedPairId(page)).toBe(pair.pairId);
    expect(await readStoredLegacyToken(page)).toBeNull();
    expect(pair.ownerName.startsWith("E2E")).toBe(true);

    expect(errors.get()).toEqual([]);
  });

  test("sends a message and renders it in the thread", async ({ page }) => {
    const errors = expectNoPageErrors(page);
    await createTestPair(page);

    await page.getByRole("link", { name: "Vzkazy" }).click();
    const body = `e2e-vzkaz ${Date.now()}`;
    const composer = page.getByPlaceholder(/Co chceš dnes říct/);
    await composer.fill(body);
    await page.getByRole("button", { name: "Poslat vzkaz" }).click();

    await expect(page.getByText(body)).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(body)).toBeVisible();

    expect(errors.get()).toEqual([]);
  });

  test("navigates through every tab without a page error", async ({ page }) => {
    const errors = expectNoPageErrors(page);
    await createTestPair(page);

    for (const tab of TABS) {
      await page.getByRole("link", { name: tab.label }).click();
      await expect(page).toHaveURL(new RegExp(`${tab.path}$`));
      await expect(page.locator("main, body")).toBeVisible();
      await expect(page.getByText(/Něco se nepovedlo|Application error/i)).toHaveCount(0);
    }

    expect(errors.get()).toEqual([]);
  });

  test("leaving on this device ends the session across a reload", async ({ page }) => {
    await createTestPair(page);

    await page.getByRole("link", { name: "Prostor" }).click();
    const logout = page.waitForResponse(
      (response) => response.request().method() === "POST" && response.status() < 400,
    );
    await page.getByRole("button", { name: /Odhlásit toto zařízení/ }).click();
    await logout;

    await expect(page.getByRole("button", { name: /Vytvořit náš prostor/ })).toBeVisible({ timeout: 20_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /Vytvořit náš prostor/ })).toBeVisible({ timeout: 20_000 });
    expect(await readSessionCookie(page)).toBeNull();
    expect(await readLegacyCompatCookie(page)).toBeNull();
  });

  test("a partner joins with the real code and gets its own session", async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const pair = await createTestPair(ownerPage);
    const inviteCode = await createInviteCode(ownerPage);
    await ownerContext.close();

    const partnerContext = await browser.newContext();
    const partnerPage = await partnerContext.newPage();
    const errors = expectNoPageErrors(partnerPage);

    await joinTestPair(partnerPage, inviteCode, "E2E-Joiner");
    expect(await readCachedPairId(partnerPage)).toBe(pair.pairId);

    const cookie = await readSessionCookie(partnerPage);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(cookie?.value).toMatch(/^ps1\./);
    expect(await readStoredLegacyToken(partnerPage)).toBeNull();
    expect(await readStorageDump(partnerPage)).not.toContain("ps1.");
    expect(await readLegacyCompatCookie(partnerPage)).toBeNull();

    await partnerPage.reload({ waitUntil: "domcontentloaded" });
    await expect(partnerPage.getByRole("button", { name: /Vytvořit náš prostor/ })).toHaveCount(0);
    expect(await readCachedPairId(partnerPage)).toBe(pair.pairId);

    expect(errors.get()).toEqual([]);
    await partnerContext.close();
  });
});

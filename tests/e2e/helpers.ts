import { expect, type Page } from "@playwright/test";

export const TABS = [
  { label: "Nás", path: "/" },
  { label: "Vzkazy", path: "/vzkazy" },
  { label: "Kalendář", path: "/kalendar" },
  { label: "Vzpomínky", path: "/galerie" },
  { label: "Prostor", path: "/nastaveni" },
] as const;

export type TestPair = {
  ownerName: string;
  partnerName: string;
  pairId: string;
  code: string;
};

export const TEST_PREFIX = "E2E";

function unique(suffix: string) {
  return `${TEST_PREFIX}-${suffix}-${Date.now().toString(36)}`;
}

export function expectNoPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return { get: () => errors };
}

export async function readStoredLegacyToken(page: Page): Promise<string | null> {
  return page.evaluate(() => window.localStorage.getItem("protebe.token"));
}

export async function readStorageDump(page: Page): Promise<string> {
  return page.evaluate(() => JSON.stringify(window.localStorage));
}

export async function readCachedPairCode(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem("protebe.pair");
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as { code?: string }).code ?? null;
    } catch {
      return null;
    }
  });
}

export async function readLegacyCompatCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === "protebe_legacy_session") ?? null;
}

export async function readCachedPairId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem("protebe.pair");
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as { id?: string }).id ?? null;
    } catch {
      return null;
    }
  });
}

export async function readSessionCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === "protebe_session") ?? null;
}

export async function createTestPair(page: Page): Promise<TestPair> {
  const ownerName = unique("Owner");
  const partnerName = unique("Partner");

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Vytvořit náš prostor/ }).click();
  await page.getByPlaceholder("Tvé jméno").fill(ownerName);
  await page.getByPlaceholder("Její jméno").fill(partnerName);
  await page.locator('input[type="date"]').fill("2024-01-01");
  await page.getByRole("button", { name: /Založit náš prostor/ }).click();

  await expect(page.getByRole("button", { name: /Vytvořit náš prostor/ })).toHaveCount(0, { timeout: 20_000 });
  await expect.poll(() => readCachedPairId(page), { timeout: 20_000 }).toMatch(/^[0-9a-f-]{36}$/);

  const pairId = (await readCachedPairId(page))!;
  const code = (await readCachedPairCode(page))!;
  return { ownerName, partnerName, pairId, code };
}

export async function joinTestPair(page: Page, code: string, name: string): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Připojit se k páru/ }).click();
  await page.getByPlaceholder("ABCDE-FGHJK").fill(code);
  await page.getByPlaceholder("Tvé jméno").fill(name);
  await page.getByRole("button", { name: /Vstoupit/ }).click();
  await expect(page.getByRole("button", { name: /Vytvořit náš prostor/ })).toHaveCount(0, { timeout: 20_000 });
  await expect.poll(() => readCachedPairId(page), { timeout: 20_000 }).toMatch(/^[0-9a-f-]{36}$/);
}

export async function createInviteCode(page: Page): Promise<string> {
  await page.goto("/nastaveni", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Vygenerovat nový kód/ }).first().click();
  const code = page.locator("span.font-display").first();
  await expect(code).toHaveText(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/, { timeout: 20_000 });
  return (await code.innerText()).trim();
}

export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

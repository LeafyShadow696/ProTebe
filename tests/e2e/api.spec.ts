import { expect, test } from "@playwright/test";

import { createTestPair, readSessionCookie, TINY_PNG } from "./helpers";

const MALFORMED_TOKENS = [
  "",
  "' or 1=1--",
  "owner_token.eq.x,partner_token.eq.y",
  "a".repeat(47),
  "A".repeat(48),
];

test.describe("upload endpoint", () => {
  test("accepts a small image for a signed-in session cookie", async ({ page }) => {
    await createTestPair(page);
    await expect.poll(() => readSessionCookie(page), { timeout: 20_000 }).not.toBeNull();

    const result = await page.evaluate(async (base64: string) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const response = await fetch("/api/public/upload", {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        credentials: "same-origin",
        body: bytes,
      });
      return { status: response.status, text: await response.text() };
    }, TINY_PNG.toString("base64"));

    expect(result.status, result.text).toBe(200);
    expect(result.text).not.toMatch(/service_role|postgres|policy|sb_secret/i);
  });

  test("rejects requests with no session (and ignores x-pair-token) with 401", async ({
    request,
    baseURL,
  }) => {
    for (const token of MALFORMED_TOKENS) {
      const response = await request.post(`${baseURL}/api/public/upload`, {
        headers: { "content-type": "image/png", "x-pair-token": token },
        data: TINY_PNG,
      });

      expect(response.status(), `token: ${token}`).toBe(401);
      const text = await response.text();
      expect(text).not.toMatch(
        /postgres|postgrest|supabase|row-level|policy|relation|pairs\.|column|sb_secret|service_role|stack/i,
      );
    }
  });

  test("does not advertise wildcard CORS", async ({ request, baseURL }) => {
    const response = await request.post(`${baseURL}/api/public/upload`, {
      headers: { "content-type": "image/png", "x-pair-token": "x" },
      data: TINY_PNG,
    });

    const headers = response.headers();
    expect(headers["access-control-allow-origin"]).toBeUndefined();
    expect(headers["access-control-allow-credentials"]).toBeUndefined();
  });
});

test.describe("calendar feed", () => {
  test("serves an .ics feed for the created pair and 404s on a bad key", async ({
    page,
    request,
    baseURL,
  }) => {
    await createTestPair(page);

    await page.getByRole("link", { name: "Kalendář" }).click();
    const feedLink = page.locator('a[download="pro-tebe.ics"]');
    await expect(feedLink).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(() => feedLink.getAttribute("href"), { timeout: 20_000 })
      .toContain("/api/public/calendar/");
    const href = (await feedLink.getAttribute("href"))!;
    const path = new URL(href, baseURL).pathname;
    expect(path).toMatch(/^\/api\/public\/calendar\/[0-9a-f-]{36}\.[0-9a-f]{32}\.ics$/);

    const feed = await request.get(`${baseURL}${path}`);
    expect(feed.status()).toBe(200);
    expect(feed.headers()["content-type"]).toContain("text/calendar");
    const body = await feed.text();
    expect(body.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(body.trimEnd().endsWith("END:VCALENDAR")).toBe(true);

    const bad = await request.get(
      `${baseURL}/api/public/calendar/${"0".repeat(8)}-0000-0000-0000-000000000000.${"0".repeat(32)}.ics`,
    );
    expect(bad.status()).toBe(404);
  });
});

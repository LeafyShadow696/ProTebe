import { existsSync, readdirSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:8080";

function findChromium(): string | undefined {
  const fromEnv = process.env["E2E_CHROMIUM_PATH"];
  if (fromEnv) return fromEnv;
  const root = process.env["PLAYWRIGHT_BROWSERS_PATH"];
  if (!root || !existsSync(root)) return undefined;
  const candidates = readdirSync(root)
    .filter((entry) => entry.startsWith("chromium-"))
    .sort()
    .reverse()
    .map((entry) => `${root}/${entry}/chrome-linux/chrome`)
    .filter((candidate) => existsSync(candidate));
  return candidates[0];
}

const executablePath = findChromium();

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    viewport: { width: 430, height: 900 },
    trace: "off",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(executablePath ? { channel: undefined, launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: process.env["E2E_NO_SERVER"]
    ? undefined
    : {
        command: "vite dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
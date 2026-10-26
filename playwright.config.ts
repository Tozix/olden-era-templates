import { defineConfig, devices } from "@playwright/test";

const PORT = 5230;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e/specs",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // vite preview раздаёт production-сборку (сначала `npm run build`).
    command: "npm run preview",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

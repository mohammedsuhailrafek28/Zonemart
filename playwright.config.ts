import { defineConfig } from "@playwright/test";

const baseURL = "http://localhost:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    launchOptions: {
      args: ["--no-sandbox", "--no-proxy-server", "--proxy-bypass-list=<-loopback>"],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mobile", use: { viewport: { width: 375, height: 812 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: {
    command: "npm run start -- -p 3100",
    url: `${baseURL}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

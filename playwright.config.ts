import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Playwright 配置文件
 * 用于 E2E 测试 Electron 应用
 */
export default defineConfig({
  testDir: "./e2e",

  /* 每个测试的超时时间 */
  timeout: 10 * 1000,

  /* 全局 expect 超时 */
  expect: {
    timeout: 2000,
  },

  /* 并发测试数量 */
  fullyParallel: false,

  /* 失败时重试次数 */
  retries: process.env.CI ? 2 : 0,

  /* 并发 workers */
  workers: 4,

  /* 报告器 */
  reporter: "list",

  /* 共享配置 */
  use: {
    /* 跟踪 */
    trace: "on-first-retry",
    /* 截图 */
    screenshot: "only-on-failure",
  },

  /* 项目配置 */
  projects: [
    {
      name: "electron",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],

  /* 全局设置 */
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
});

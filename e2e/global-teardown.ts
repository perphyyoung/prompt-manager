import { e2eLog } from "./e2e-logger.ts";

/**
 * 全局清理
 * 在测试结束后执行
 */
async function globalTeardown() {
  e2eLog("info", "E2E teardown", "测试结束");
}

export default globalTeardown;

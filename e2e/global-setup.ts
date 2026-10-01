import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { e2eLog } from "./e2e-logger.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 全局设置
 * 在测试开始前执行
 */
async function globalSetup() {
  e2eLog("info", "E2E setup", "开始构建应用...");

  // 构建应用
  try {
    execSync("pnpm build", {
      cwd: join(__dirname, ".."),
      stdio: "inherit",
    });
    e2eLog("info", "E2E setup", "构建完成");
  } catch (error) {
    e2eLog("error", "E2E setup", `构建失败: ${String(error)}`);
    throw error;
  }
}

export default globalSetup;

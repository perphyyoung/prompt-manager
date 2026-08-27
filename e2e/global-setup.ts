import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 全局设置
 * 在测试开始前执行
 */
async function globalSetup() {
  console.log("Building Electron app for E2E tests...");

  // 构建应用
  try {
    execSync("pnpm build", {
      cwd: join(__dirname, ".."),
      stdio: "inherit",
    });
    console.log("Build completed successfully");
  } catch (error) {
    console.error("Build failed:", error);
    throw error;
  }
}

export default globalSetup;

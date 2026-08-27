/**
 * 清理测试产生的标签组
 * 用于删除 E2E 测试创建的以 "e2e_" 开头的标签组
 *
 * 使用方法:
 * npx tsx e2e/cleanup-test-tag-groups.ts
 */

import { _electron as electron } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prefix = "测试组_"; // e2e_

/**
 * 启动 Electron 应用并获取 API
 */
async function launchApp() {
  const electronPath = join(__dirname, "../node_modules/.bin/electron.cmd");
  const mainPath = join(__dirname, "../out/main/index.js");

  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [mainPath],
    env: {
      ...process.env,
      NODE_ENV: "test",
    },
  });

  const page = await electronApp.firstWindow();
  await page.waitForLoadState("domcontentloaded");

  return { electronApp, page };
}

/**
 * 清理图像标签组
 */
async function cleanupImageTagGroups(page: any): Promise<number> {
  const groups = await page.evaluate(async () => {
    return await window.electronAPI.getImageTagGroups();
  });

  const testGroups = groups.filter((g: { name: string }) => g.name.startsWith(prefix));
  console.log(`发现 ${testGroups.length} 个图像测试标签组`);

  for (const group of testGroups) {
    try {
      await page.evaluate(async (groupId: number) => {
        await window.electronAPI.deleteImageTagGroup(groupId);
      }, group.id);
      console.log(`  ✓ 删除图像标签组: ${group.name} (ID: ${group.id})`);
    } catch (error) {
      console.error(`  ✗ 删除失败: ${group.name} (ID: ${group.id})`, error);
    }
  }

  return testGroups.length;
}

/**
 * 清理提示词标签组
 */
async function cleanupPromptTagGroups(page: any): Promise<number> {
  const groups = await page.evaluate(async () => {
    return await window.electronAPI.getPromptTagGroups();
  });

  const testGroups = groups.filter((g: { name: string }) => g.name.startsWith(prefix));
  console.log(`发现 ${testGroups.length} 个提示词测试标签组`);

  for (const group of testGroups) {
    try {
      await page.evaluate(async (groupId: number) => {
        await window.electronAPI.deletePromptTagGroup(groupId);
      }, group.id);
      console.log(`  ✓ 删除提示词标签组: ${group.name} (ID: ${group.id})`);
    } catch (error) {
      console.error(`  ✗ 删除失败: ${group.name} (ID: ${group.id})`, error);
    }
  }

  return testGroups.length;
}

/**
 * 主函数
 */
async function main() {
  console.log("========================================");
  console.log("开始清理测试标签组");
  console.log("========================================\n");

  let electronApp;
  try {
    console.log("正在启动应用...");
    const { electronApp: app, page } = await launchApp();
    electronApp = app;
    console.log("应用启动成功\n");

    // 清理图像标签组
    console.log("--- 清理图像标签组 ---");
    const imageCount = await cleanupImageTagGroups(page);
    console.log("");

    // 清理提示词标签组
    console.log("--- 清理提示词标签组 ---");
    const promptCount = await cleanupPromptTagGroups(page);
    console.log("");

    // 汇总
    console.log("========================================");
    console.log("清理完成:");
    console.log(`  - 图像标签组: ${imageCount} 个`);
    console.log(`  - 提示词标签组: ${promptCount} 个`);
    console.log(`  - 总计: ${imageCount + promptCount} 个`);
    console.log("========================================");
  } catch (error) {
    console.error("清理过程出错:", error);
    process.exit(1);
  } finally {
    if (electronApp) {
      console.log("\n正在关闭应用...");
      await electronApp.close();
    }
  }
}

// 运行主函数
main();

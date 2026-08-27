import { expect } from "@playwright/test";
import { test } from "./electron-test.ts";
import { Constants } from "../src/constants.ts";

/**
 * Shift 范围选择功能 E2E 测试
 *
 * 前置条件：
 * - 数据库中至少有 5 张图像
 * - 数据库中至少有 5 个提示词
 */
test.describe("Shift 范围选择", () => {
  // ========== 初始化 ==========
  test.beforeAll(async ({ electronTest }) => {
    // 创建测试数据：5个图像和5个提示词（用于Shift范围选择测试）
    const factory = electronTest.getApiFactory();
    await factory.createImageFactory().createBatch(5, "shift_select");
    await factory.createPromptFactory().createBatch(5, "shift_select");

    // 刷新界面以显示新数据
    await electronTest.refreshData();
  });

  test.describe("图像网格视图", () => {
    test("Shift+ 点击范围选择", async ({ electronTest, page }) => {
      await electronTest.logTestStart();

      // 使用快捷键切换到图像面板并进入网格视图
      await page.keyboard.press("Control+i");
      await page.waitForSelector(`#${Constants.Ids.IMAGE_PANEL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.waitForSelector(`#${Constants.Ids.IMAGE_GRID}`, {
        state: "visible",
        timeout: 1000,
      });

      // 先清除所有选择（按 Escape 退出批量模式）
      await page.keyboard.press("Escape");
      const batchToolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
      await batchToolbar.waitFor({ state: "hidden", timeout: 1000 }).catch(async () => {
        await electronTest.logError(page, "批量工具栏隐藏失败");
      });

      // 点击第一个复选框选中（建立 lastSelectedIndex）
      // 网格视图复选框默认隐藏，需先 hover 卡片使其可见
      const firstCard = page.locator(".image-card").first();
      const firstCheckbox = firstCard.locator(".card-checkbox");
      await firstCard.hover();
      await firstCheckbox.click();
      await expect(firstCheckbox).toBeChecked({ timeout: 1000 });

      // 验证选择计数为 1（只检查图像网格中的复选框）
      const checkedCount = await page.evaluate((gridId: string) => {
        return document.querySelectorAll(`#${gridId} .card-checkbox:checked`).length;
      }, Constants.Ids.IMAGE_GRID);
      expect(checkedCount).toBe(1);

      // Shift+ 点击第三个卡片进行范围选择
      const thirdCard = page.locator(".image-card").nth(2);
      await page.keyboard.down("Shift");
      await thirdCard.click();
      await page.keyboard.up("Shift");

      // 验证选择计数为 3（只检查图像网格中的复选框）
      const finalCheckedCount = await page.evaluate((gridId: string) => {
        return document.querySelectorAll(`#${gridId} .card-checkbox:checked`).length;
      }, Constants.Ids.IMAGE_GRID);
      expect(finalCheckedCount).toBe(3);

      // 验证每张卡片的选中状态
      for (let i = 0; i <= 2; i++) {
        const checkbox = page.locator(".image-card").nth(i).locator(".card-checkbox");
        await expect(checkbox).toBeChecked();
      }

      // 清理：退出批量模式
      await page.keyboard.press("Escape");
      await batchToolbar.waitFor({ state: "hidden", timeout: 1000 });
    });
  });

  test.describe("提示词网格视图", () => {
    test("Shift+ 点击范围选择", async ({ electronTest, page }) => {
      await electronTest.logTestStart();

      // 使用快捷键切换到提示词面板并进入网格视图
      await page.keyboard.press("Control+p");
      await page.waitForSelector(`#${Constants.Ids.PROMPT_PANEL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.waitForSelector(`#${Constants.Ids.PROMPT_GRID}`, {
        state: "visible",
        timeout: 1000,
      });

      // 先清除所有选择（按 Escape 退出批量模式）
      await page.keyboard.press("Escape");
      const batchToolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
      await batchToolbar.waitFor({ state: "hidden", timeout: 1000 }).catch(async () => {
        await electronTest.logError(page, "批量工具栏隐藏失败");
      });

      // 点击第一个复选框选中（建立 lastSelectedIndex）
      // 网格视图复选框默认隐藏，需先 hover 卡片使其可见
      const firstCard = page.locator(".prompt-card").first();
      const firstCheckbox = firstCard.locator(".card-checkbox");
      await firstCard.hover();
      await firstCheckbox.click();
      await expect(firstCheckbox).toBeChecked({ timeout: 1000 });

      // 验证选择计数为 1
      const checkedCount = await page.evaluate((gridId: string) => {
        return document.querySelectorAll(`#${gridId} .card-checkbox:checked`).length;
      }, Constants.Ids.PROMPT_GRID);
      expect(checkedCount).toBe(1);

      // Shift+ 点击第三个卡片进行范围选择
      const thirdCard = page.locator(".prompt-card").nth(2);
      await page.keyboard.down("Shift");
      await thirdCard.click();
      await page.keyboard.up("Shift");

      // 验证选择计数为 3
      const finalCheckedCount = await page.evaluate((gridId: string) => {
        return document.querySelectorAll(`#${gridId} .card-checkbox:checked`).length;
      }, Constants.Ids.PROMPT_GRID);
      expect(finalCheckedCount).toBe(3);

      // 验证每张卡片的选中状态
      for (let i = 0; i <= 2; i++) {
        const checkbox = page.locator(".prompt-card").nth(i).locator(".card-checkbox");
        await expect(checkbox).toBeChecked();
      }

      // 清理：退出批量模式
      await page.keyboard.press("Escape");
      await batchToolbar.waitFor({ state: "hidden", timeout: 1000 });
    });
  });
});

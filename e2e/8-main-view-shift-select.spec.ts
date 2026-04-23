import { expect } from "@playwright/test";
import {
  test,
  enterImageListView,
  enterPromptListView,
} from "./electron-test.ts";
import type { IImage, IPrompt } from "../src/preload/index.ts";

/**
 * Shift 范围选择功能 E2E 测试
 *
 * 测试场景：
 * 1. 图像列表视图 - Shift+ 点击范围选择
 * 2. 提示词列表视图 - Shift+ 点击范围选择
 *
 * 前置条件：
 * - 数据库中至少有 5 张图像
 * - 数据库中至少有 5 个提示词
 */
test.describe("Shift 范围选择", () => {
  test("图像列表视图 - Shift+ 点击范围选择", async ({
    _electronTest,
    page,
  }) => {
    // 验证有图像数据
    const totalImages = await page.evaluate(async () => {
      const images = await window.electronAPI.getImages("createdAt", "desc");
      return images.filter((img: IImage) => !img.isDeleted).length;
    });

    if (totalImages < 5) {
      test.skip();
      return;
    }

    // 进入图像列表视图
    await enterImageListView(page);

    // 先清除所有选择（点击列表视图按钮刷新）
    await page.click("#imageListViewBtn");
    await page.waitForSelector("#imageList", {
      state: "visible",
      timeout: 1000,
    });

    // 点击第一个复选框选中（建立 lastSelectedIndex）
    const firstCheckbox = page
      .locator(".list-item--image")
      .first()
      .locator(".list-item__checkbox");
    await firstCheckbox.click();
    await expect(firstCheckbox).toBeChecked({ timeout: 1000 });

    // 验证选择计数为 1（只检查图像列表中的复选框）
    const checkedCount = await page.evaluate(() => {
      return document.querySelectorAll(
        "#imageList .list-item__checkbox:checked",
      ).length;
    });
    expect(checkedCount).toBe(1);

    // Shift+ 点击第三个行进行范围选择
    const thirdRow = page.locator(".list-item--image").nth(2);
    await page.keyboard.down("Shift");
    await thirdRow.click();
    await page.keyboard.up("Shift");

    // 验证选择计数为 3（只检查图像列表中的复选框）
    const finalCheckedCount = await page.evaluate(() => {
      return document.querySelectorAll(
        "#imageList .list-item__checkbox:checked",
      ).length;
    });
    expect(finalCheckedCount).toBe(3);

    // 验证每行的选中状态
    for (let i = 0; i <= 2; i++) {
      const checkbox = page
        .locator(".list-item--image")
        .nth(i)
        .locator(".list-item__checkbox");
      await expect(checkbox).toBeChecked();
    }
  });

  test("提示词列表视图 - Shift+ 点击范围选择", async ({
    _electronTest,
    page,
  }) => {
    // 验证有提示词数据
    const totalPrompts = await page.evaluate(async () => {
      const prompts = await window.electronAPI.getPrompts("createdAt", "desc");
      return prompts.filter((p: IPrompt) => !p.isDeleted).length;
    });

    if (totalPrompts < 5) {
      test.skip();
      return;
    }

    // 进入提示词列表视图
    await enterPromptListView(page);

    // 先清除所有选择（点击列表视图按钮刷新）
    await page.click("#promptListViewBtn");
    await page.waitForSelector("#promptList", {
      state: "visible",
      timeout: 1000,
    });

    // 点击第一个复选框选中（建立 lastSelectedIndex）
    const firstCheckbox = page
      .locator(".list-item--prompt")
      .first()
      .locator(".list-item__checkbox");
    await firstCheckbox.click();
    await expect(firstCheckbox).toBeChecked({ timeout: 1000 });

    // 验证选择计数为 1（只检查提示词列表中的复选框）
    const checkedCount = await page.evaluate(() => {
      return document.querySelectorAll(
        "#promptList .list-item__checkbox:checked",
      ).length;
    });
    expect(checkedCount).toBe(1);

    // Shift+ 点击第三个行进行范围选择
    const thirdRow = page.locator(".list-item--prompt").nth(2);
    await page.keyboard.down("Shift");
    await thirdRow.click();
    await page.keyboard.up("Shift");

    // 验证选择计数为 3（只检查提示词列表中的复选框）
    const finalCheckedCount = await page.evaluate(() => {
      return document.querySelectorAll(
        "#promptList .list-item__checkbox:checked",
      ).length;
    });
    expect(finalCheckedCount).toBe(3);

    // 验证每行的选中状态
    for (let i = 0; i <= 2; i++) {
      const checkbox = page
        .locator(".list-item--prompt")
        .nth(i)
        .locator(".list-item__checkbox");
      await expect(checkbox).toBeChecked();
    }
  });
});

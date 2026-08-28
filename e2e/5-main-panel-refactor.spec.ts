import { expect } from "@playwright/test";
import { Constants } from "../src/renderer/constants.ts";
import type { IImage, IPrompt } from "../src/preload/index.ts";
import { enterImageGridView, enterPromptGridView, test } from "./electron-test.ts";

/**
 * 主界面重构功能 E2E 测试
 */
test.describe("主界面重构功能", () => {
  // 存储测试用数据的 ID
  let testImageId: string = "";
  let testPromptId: string = "";

  // ========== 初始化 ==========
  test.beforeAll(async ({ electronTest, page }) => {
    // 创建测试数据：至少1个图像和1个提示词
    const factory = electronTest.getApiFactory();
    await factory.createImageFactory().createBatch(2, "main_panel");
    await factory.createPromptFactory().create({
      label: "main_panel",
      content: "e2e_test_prompt_main_panel",
    });

    // 刷新界面以显示新数据
    await electronTest.refreshData();

    // 获取测试数据ID（使用快捷键切换到对应面板）
    await page.keyboard.press("Control+i");
    await page.waitForSelector(`#${Constants.Ids.IMAGE_PANEL}`, {
      state: "visible",
      timeout: 1000,
    });
    const firstImageCard = page.locator(".image-card").first();
    await expect(firstImageCard).toBeVisible({ timeout: 1000 });
    testImageId = (await firstImageCard.getAttribute("data-id")) || "";

    await page.keyboard.press("Control+p");
    await page.waitForSelector(`#${Constants.Ids.PROMPT_PANEL}`, {
      state: "visible",
      timeout: 1000,
    });
    const firstPromptCard = page.locator(".prompt-card").first();
    await expect(firstPromptCard).toBeVisible({ timeout: 1000 });
    testPromptId = (await firstPromptCard.getAttribute("data-id")) || "";
  });

  test.describe("图像面板功能", () => {
    test("图像卡片收藏按钮功能", async ({ electronTest, page }) => {
      await electronTest.logTestStart();

      await enterImageGridView(page);

      const targetCard = page.locator(`.image-card[data-id="${testImageId}"]`);
      await expect(targetCard).toBeVisible({ timeout: 1000 });

      const originalFavoriteStatus = await page.evaluate(
        async (params: { id: string }) => {
          const image = await window.electronAPI.getImageById(params.id);
          return !!(image as IImage)?.isFavorite;
        },
        { id: testImageId },
      );

      await targetCard.hover();
      const favoriteBtn = targetCard.locator(".favorite-btn");
      await favoriteBtn.click();

      const newFavoriteStatus = await page.evaluate(
        async (params: { id: string }) => {
          const image = await window.electronAPI.getImageById(params.id);
          return !!(image as IImage)?.isFavorite;
        },
        { id: testImageId },
      );

      expect(newFavoriteStatus).toBe(!originalFavoriteStatus);

      const isBtnActive = await favoriteBtn.evaluate((el: HTMLElement) =>
        el.classList.contains("active"),
      );
      expect(isBtnActive).toBe(!originalFavoriteStatus);
    });

    test("图像卡片复制按钮功能", async ({ electronTest, page }) => {
      await electronTest.logTestStart();

      await enterImageGridView(page);

      const targetCard = page.locator(`.image-card[data-id="${testImageId}"]`);
      await expect(targetCard).toBeVisible({ timeout: 1000 });

      await targetCard.hover();
      const copyBtn = targetCard.locator(".copy-btn");
      await copyBtn.click();

      const toastVisible = await page.locator(`#${Constants.Ids.TOAST_CONTAINER}`).isVisible();
      expect(toastVisible).toBe(true);
    });

    test("图像标签筛选区域收起/展开切换", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageGridView(page);

      const tagFilterSection = page.locator(`#${Constants.Ids.IMAGE_TAG_FILTER_SECTION}`);
      let isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) =>
        el.classList.contains("collapsed"),
      );

      if (isCollapsed) {
        await page.click(`#${Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN}`);
        await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_FILTER_CONTENT}`, {
          state: "visible",
          timeout: 1000,
        });
      }

      isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) =>
        el.classList.contains("collapsed"),
      );
      expect(isCollapsed).toBe(false);

      const isContentVisible = await page
        .locator(`#${Constants.Ids.IMAGE_TAG_FILTER_CONTENT}`)
        .isVisible();
      expect(isContentVisible).toBe(true);

      await page.click(`#${Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_FILTER_CONTENT}`, {
        state: "hidden",
        timeout: 1000,
      });

      isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) =>
        el.classList.contains("collapsed"),
      );
      expect(isCollapsed).toBe(true);

      const isContentHidden = await page
        .locator(`#${Constants.Ids.IMAGE_TAG_FILTER_CONTENT}`)
        .isHidden();
      expect(isContentHidden).toBe(true);

      await page.click(`#${Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_FILTER_CONTENT}`, {
        state: "visible",
        timeout: 1000,
      });

      isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) =>
        el.classList.contains("collapsed"),
      );
      expect(isCollapsed).toBe(false);
    });
  });

  test.describe("提示词面板功能", () => {
    test("提示词卡片收藏按钮功能", async ({ electronTest, page }) => {
      await electronTest.logTestStart();

      await enterPromptGridView(page);

      const targetCard = page.locator(`.prompt-card[data-id="${testPromptId}"]`);
      await expect(targetCard).toBeVisible({ timeout: 1000 });

      const originalFavoriteStatus = await page.evaluate(
        async (params: { id: string }) => {
          const prompts = await window.electronAPI.getPrompts("updatedAt", "desc");
          const prompt = prompts.find((p: IPrompt) => String(p.id) === params.id);
          return !!prompt?.isFavorite;
        },
        { id: testPromptId },
      );

      await targetCard.hover();
      const favoriteBtn = targetCard.locator(".favorite-btn");
      await favoriteBtn.click();

      const newFavoriteStatus = await page.evaluate(
        async (params: { id: string }) => {
          const prompts = await window.electronAPI.getPrompts("updatedAt", "desc");
          const prompt = prompts.find((p: IPrompt) => String(p.id) === params.id);
          return !!prompt?.isFavorite;
        },
        { id: testPromptId },
      );

      expect(newFavoriteStatus).toBe(!originalFavoriteStatus);

      const isBtnActive = await favoriteBtn.evaluate((el: HTMLElement) =>
        el.classList.contains("active"),
      );
      expect(isBtnActive).toBe(!originalFavoriteStatus);
    });

    test("提示词卡片复制按钮功能", async ({ electronTest, page }) => {
      await electronTest.logTestStart();

      await enterPromptGridView(page);

      const targetCard = page.locator(`.prompt-card[data-id="${testPromptId}"]`);
      await expect(targetCard).toBeVisible({ timeout: 1000 });

      await targetCard.hover();
      const copyBtn = targetCard.locator(".copy-btn");
      await copyBtn.click();

      const toastVisible = await page.locator(`#${Constants.Ids.TOAST_CONTAINER}`).isVisible();
      expect(toastVisible).toBe(true);
    });

    test("提示词标签筛选区域收起/展开切换", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterPromptGridView(page);

      const tagFilterSection = page.locator(`#${Constants.Ids.PROMPT_TAG_FILTER_SECTION}`);
      let isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) =>
        el.classList.contains("collapsed"),
      );

      if (isCollapsed) {
        await page.click(`#${Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN}`);
        await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_FILTER_CONTENT}`, {
          state: "visible",
          timeout: 1000,
        });
      }

      isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) =>
        el.classList.contains("collapsed"),
      );
      expect(isCollapsed).toBe(false);

      const isContentVisible = await page
        .locator(`#${Constants.Ids.PROMPT_TAG_FILTER_CONTENT}`)
        .isVisible();
      expect(isContentVisible).toBe(true);

      await page.click(`#${Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_FILTER_CONTENT}`, {
        state: "hidden",
        timeout: 1000,
      });

      isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) =>
        el.classList.contains("collapsed"),
      );
      expect(isCollapsed).toBe(true);

      const isContentHidden = await page
        .locator(`#${Constants.Ids.PROMPT_TAG_FILTER_CONTENT}`)
        .isHidden();
      expect(isContentHidden).toBe(true);

      await page.click(`#${Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_FILTER_CONTENT}`, {
        state: "visible",
        timeout: 1000,
      });

      isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) =>
        el.classList.contains("collapsed"),
      );
      expect(isCollapsed).toBe(false);
    });
  });
});

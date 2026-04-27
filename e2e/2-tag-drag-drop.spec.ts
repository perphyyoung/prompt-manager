import { expect } from "@playwright/test";
import {
  test,
  enterImageGridView,
  enterPromptGridView,
  ensureTagFilterExpanded,
  ensureTagFilterCollapsed,
  createImageTagInManager,
  createPromptTagInManager,
  enterImageTagManager,
  enterPromptTagManager,
} from "./electron-test.ts";
import { Constants } from "../src/constants.ts";
import type { IImage, IPrompt } from "../src/preload/index.ts";

/**
 * 标签拖拽功能 E2E 测试
 *
 * 测试场景：
 * 1. 通过 UI 创建测试图像/提示词
 * 2. 通过标签管理器创建测试标签
 * 3. 将标签拖拽到图像/提示词卡片
 * 4. 验证标签添加成功
 * 5. 重复拖拽相同标签，验证提示"标签已存在"
 */
test.describe("标签拖拽功能", () => {
  // 存储测试用图像和提示词的 ID
  let testImageId: string = "";
  let testPromptId: string = "";

  test.afterEach(async ({ electronTest }) => {
    // 清理测试创建的图像和提示词
    await electronTest.cleanupTestImages();
    await electronTest.cleanupTestPrompts();
  });

  test.describe("图像标签拖拽", () => {
    test("标签拖拽到图像卡片 - 展开状态", async ({ electronTest, page }) => {
      await electronTest.logTestStart();

      // 通过 UI 创建测试图像
      testImageId = await electronTest.createTestImageViaUI();

      // 先在标签管理器中创建测试标签
      await enterImageTagManager(page);
      const firstGroupId = await electronTest.getFirstImageTagGroupId();
      const testTagName = electronTest.generateE2ePrefixName("drag_expanded");
      await createImageTagInManager(
        page,
        testTagName,
        firstGroupId?.toString(),
      );

      // 关闭标签管理器并返回图像网格视图
      await page.click(`#${Constants.Ids.CLOSE_IMAGE_TAG_MANAGER_MODAL}`);
      await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_MANAGER_MODAL}`, {
        state: "hidden",
        timeout: 1000,
      });
      await enterImageGridView(page);

      const targetCard = page.locator(`.image-card[data-id="${testImageId}"]`);
      await expect(targetCard).toBeVisible({ timeout: 1000 });

      const originalTags = await page.evaluate(async (id) => {
        const image = await window.electronAPI.getImageById(id as string);
        return (image as IImage)?.tags || [];
      }, testImageId);

      await ensureTagFilterExpanded(
        page,
        Constants.Ids.IMAGE_TAG_FILTER_SECTION,
        Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN,
      );

      // 清除标签缓存并刷新标签筛选区
      await electronTest.clearTagCache("image");
      await electronTest.refreshTagFilters();

      // 等待标签出现在筛选列表中（使用 waitForFunction 轮询检查）
      await page.waitForFunction(
        (tagName: string) => {
          const tagElement = document.querySelector(
            `#imageTagFilterList .tag-filter-item[data-tag="${tagName}"]`,
          );
          return tagElement !== null;
        },
        testTagName,
        { timeout: 1000 },
      );

      const newTagElement = page.locator(
        `#imageTagFilterList .tag-filter-item[data-tag="${testTagName}"]`,
      );
      await expect(newTagElement).toBeVisible({ timeout: 1000 });

      // 执行拖拽操作 - 使用显式验证
      await newTagElement.hover();
      await expect(newTagElement).toBeVisible({ timeout: 1000 });
      await page.mouse.down();
      await targetCard.hover();
      await expect(targetCard).toBeVisible({ timeout: 1000 });
      await page.mouse.up();

      // 验证标签已添加 - 使用 waitForFunction 轮询检查
      await page.waitForFunction(
        async (params: { id: string; tag: string }) => {
          const image = await window.electronAPI.getImageById(params.id);
          return (image as IImage)?.tags?.includes(params.tag);
        },
        { id: testImageId, tag: testTagName },
        { timeout: 1000 },
      );

      // 验证标签已添加
      const newTags = await page.evaluate(async (id) => {
        const image = await window.electronAPI.getImageById(id as string);
        return (image as IImage)?.tags || [];
      }, testImageId);

      expect(newTags.length).toBeGreaterThan(originalTags.length);
      expect(newTags).toContain(testTagName);

      // 验证成功提示
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("标签已添加")`,
        { timeout: 1000 },
      );
      const toastContainer = page.locator(`#${Constants.Ids.TOAST_CONTAINER}`);

      // 第二次拖拽相同标签，应该提示"标签已存在"
      await newTagElement.hover();
      await expect(newTagElement).toBeVisible({ timeout: 1000 });
      await page.mouse.down();
      await targetCard.hover();
      await expect(targetCard).toBeVisible({ timeout: 1000 });
      await page.mouse.up();

      // 等待提示消息更新
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("该标签已存在")`,
        { timeout: 1000 },
      );
      const toastMessageAfterSecondDrop = await toastContainer.textContent();
      expect(toastMessageAfterSecondDrop).toContain("该标签已存在");

      // 清理测试标签
      await electronTest.cleanupImageTagsAndGroups();
    });

    test("标签拖拽到图像卡片 - 收起状态", async ({ electronTest, page }) => {
      await electronTest.logTestStart();

      // 通过 UI 创建测试图像
      testImageId = await electronTest.createTestImageViaUI();

      await enterImageGridView(page);

      const targetCard = page.locator(`.image-card[data-id="${testImageId}"]`);
      await expect(targetCard).toBeVisible({ timeout: 1000 });

      // 确保标签筛选区域收起
      await ensureTagFilterCollapsed(
        page,
        Constants.Ids.IMAGE_TAG_FILTER_SECTION,
        Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN,
      );

      // 进入标签管理器并创建测试标签
      await enterImageTagManager(page);
      const firstGroupId = await electronTest.getFirstImageTagGroupId();
      const testTagName = electronTest.generateE2ePrefixName("drag_collapsed");
      await createImageTagInManager(
        page,
        testTagName,
        firstGroupId?.toString(),
      );

      // 关闭标签管理器
      await page.click(`#${Constants.Ids.CLOSE_IMAGE_TAG_MANAGER_MODAL}`);
      await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_MANAGER_MODAL}`, {
        state: "hidden",
        timeout: 1000,
      });

      // 清除标签缓存并刷新标签筛选区
      await electronTest.clearTagCache("image");
      await electronTest.refreshTagFilters();

      // 确保标签筛选区域仍处于收起状态
      await ensureTagFilterCollapsed(
        page,
        Constants.Ids.IMAGE_TAG_FILTER_SECTION,
        Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN,
      );

      // 等待首位组的标签出现在 header tags 中（收起状态下只显示首位组标签）
      await page.waitForFunction(
        (tagName: string) => {
          const tagElement = document.querySelector(
            `#imageTagFilterHeaderTags .tag-filter-item[data-tag="${tagName}"]`,
          );
          return tagElement !== null;
        },
        testTagName,
        { timeout: 1000 },
      );

      const newTagElement = page.locator(
        `#imageTagFilterHeaderTags .tag-filter-item[data-tag="${testTagName}"]`,
      );
      await expect(newTagElement).toBeVisible({ timeout: 1000 });

      // 第一次拖拽 - 应该成功
      await newTagElement.hover();
      await expect(newTagElement).toBeVisible({ timeout: 1000 });
      await page.mouse.down();
      await targetCard.hover();
      await expect(targetCard).toBeVisible({ timeout: 1000 });
      await page.mouse.up();

      // 验证标签已添加
      await page.waitForFunction(
        async (params: { id: string; tag: string }) => {
          const image = await window.electronAPI.getImageById(params.id);
          return (image as IImage)?.tags?.includes(params.tag);
        },
        { id: testImageId, tag: testTagName },
        { timeout: 1000 },
      );

      // 验证成功提示
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("标签已添加")`,
        { timeout: 1000 },
      );

      // 第二次拖拽相同标签 - 应该提示已存在
      await newTagElement.hover();
      await expect(newTagElement).toBeVisible({ timeout: 1000 });
      await page.mouse.down();
      await targetCard.hover();
      await expect(targetCard).toBeVisible({ timeout: 1000 });
      await page.mouse.up();

      // 验证提示"该标签已存在"
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("该标签已存在")`,
        { timeout: 1000 },
      );

      // 清理测试标签
      await electronTest.cleanupImageTagsAndGroups();
    });
  });

  test.describe("提示词标签拖拽", () => {
    test("标签拖拽到提示词卡片 - 展开状态", async ({ electronTest, page }) => {
      await electronTest.logTestStart();

      // 通过 UI 创建测试提示词
      testPromptId = await electronTest.createTestPromptViaUI();

      // 先在提示词标签管理器中创建测试标签
      await enterPromptTagManager(page);
      const firstGroupId = await electronTest.getFirstPromptTagGroupId();
      const testTagName = electronTest.generateE2ePrefixName("drag_expanded");
      await createPromptTagInManager(
        page,
        testTagName,
        firstGroupId?.toString(),
      );

      // 关闭标签管理器并返回提示词网格视图
      await page.click(`#${Constants.Ids.CLOSE_PROMPT_TAG_MANAGER_MODAL}`);
      await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_MANAGER_MODAL}`, {
        state: "hidden",
        timeout: 1000,
      });
      await enterPromptGridView(page);

      const targetCard = page.locator(
        `.prompt-card[data-id="${testPromptId}"]`,
      );
      await expect(targetCard).toBeVisible({ timeout: 1000 });

      const originalTags = await page.evaluate(async (id) => {
        const prompt = await window.electronAPI.getPromptById(id as string);
        return (prompt as IPrompt)?.tags || [];
      }, testPromptId);

      await ensureTagFilterExpanded(
        page,
        Constants.Ids.PROMPT_TAG_FILTER_SECTION,
        Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN,
      );

      // 清除标签缓存并刷新标签筛选区
      await electronTest.clearTagCache("prompt");
      await electronTest.refreshTagFilters();

      await ensureTagFilterExpanded(
        page,
        Constants.Ids.PROMPT_TAG_FILTER_SECTION,
        Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN,
      );

      // 等待标签出现在筛选列表中（使用 waitForFunction 轮询检查）
      await page.waitForFunction(
        (tagName: string) => {
          const tagElement = document.querySelector(
            `#promptTagFilterList .tag-filter-item[data-tag="${tagName}"]`,
          );
          return tagElement !== null;
        },
        testTagName,
        { timeout: 1000 },
      );

      const newTagElement = page.locator(
        `#promptTagFilterList .tag-filter-item[data-tag="${testTagName}"]`,
      );
      await expect(newTagElement).toBeVisible({ timeout: 1000 });

      // 执行拖拽操作 - 使用显式验证
      await newTagElement.hover();
      await expect(newTagElement).toBeVisible({ timeout: 1000 });
      await page.mouse.down();
      await targetCard.hover();
      await expect(targetCard).toBeVisible({ timeout: 1000 });
      await page.mouse.up();

      // 验证标签已添加 - 使用 waitForFunction 轮询检查
      await page.waitForFunction(
        async (params: { id: string; tag: string }) => {
          const prompt = await window.electronAPI.getPromptById(params.id);
          return (prompt as IPrompt)?.tags?.includes(params.tag);
        },
        { id: testPromptId, tag: testTagName },
        { timeout: 1000 },
      );

      // 验证标签已添加
      const newTags = await page.evaluate(async (id) => {
        const prompt = await window.electronAPI.getPromptById(id as string);
        return (prompt as IPrompt)?.tags || [];
      }, testPromptId);

      expect(newTags.length).toBeGreaterThan(originalTags.length);
      expect(newTags).toContain(testTagName);

      // 验证成功提示
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("标签已添加")`,
        { timeout: 1000 },
      );
      const toastContainer = page.locator(`#${Constants.Ids.TOAST_CONTAINER}`);

      // 第二次拖拽相同标签，应该提示"标签已存在"
      await newTagElement.hover();
      await expect(newTagElement).toBeVisible({ timeout: 1000 });
      await page.mouse.down();
      await targetCard.hover();
      await expect(targetCard).toBeVisible({ timeout: 1000 });
      await page.mouse.up();

      // 等待提示消息更新
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("该标签已存在")`,
        { timeout: 1000 },
      );
      const toastMessageAfterSecondDrop = await toastContainer.textContent();
      expect(toastMessageAfterSecondDrop).toContain("该标签已存在");

      // 清理测试标签
      await electronTest.cleanupPromptTagsAndGroups();
    });

    test("标签拖拽到提示词卡片 - 收起状态", async ({ electronTest, page }) => {
      await electronTest.logTestStart();

      // 通过 UI 创建测试提示词
      testPromptId = await electronTest.createTestPromptViaUI();

      // 先在提示词标签管理器中创建测试标签
      await enterPromptTagManager(page);
      const firstGroupId = await electronTest.getFirstPromptTagGroupId();
      const testTagName = electronTest.generateE2ePrefixName("drag_collapsed");
      await createPromptTagInManager(
        page,
        testTagName,
        firstGroupId?.toString(),
      );

      // 关闭标签管理器并返回提示词网格视图
      await page.click(`#${Constants.Ids.CLOSE_PROMPT_TAG_MANAGER_MODAL}`);
      await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_MANAGER_MODAL}`, {
        state: "hidden",
        timeout: 1000,
      });
      await enterPromptGridView(page);

      const targetCard = page.locator(
        `.prompt-card[data-id="${testPromptId}"]`,
      );
      await expect(targetCard).toBeVisible({ timeout: 1000 });

      // 确保标签筛选区域收起
      await ensureTagFilterCollapsed(
        page,
        Constants.Ids.PROMPT_TAG_FILTER_SECTION,
        Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN,
      );

      // 清除标签缓存并刷新标签筛选区
      await electronTest.clearTagCache("prompt");
      await electronTest.refreshTagFilters();

      // 确保标签筛选区域仍处于收起状态
      await ensureTagFilterCollapsed(
        page,
        Constants.Ids.PROMPT_TAG_FILTER_SECTION,
        Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN,
      );

      // 等待首位组的标签出现在 header tags 中（收起状态下只显示首位组标签）
      await page.waitForFunction(
        (tagName: string) => {
          const tagElement = document.querySelector(
            `#promptTagFilterHeaderTags .tag-filter-item[data-tag="${tagName}"]`,
          );
          return tagElement !== null;
        },
        testTagName,
        { timeout: 1000 },
      );

      const newTagElement = page.locator(
        `#promptTagFilterHeaderTags .tag-filter-item[data-tag="${testTagName}"]`,
      );
      await expect(newTagElement).toBeVisible({ timeout: 1000 });

      // 第一次拖拽 - 应该成功
      await newTagElement.hover();
      await expect(newTagElement).toBeVisible({ timeout: 1000 });
      await page.mouse.down();
      await targetCard.hover();
      await expect(targetCard).toBeVisible({ timeout: 1000 });
      await page.mouse.up();

      // 验证标签已添加
      await page.waitForFunction(
        async (params: { id: string; tag: string }) => {
          const prompt = await window.electronAPI.getPromptById(params.id);
          return (prompt as IPrompt)?.tags?.includes(params.tag);
        },
        { id: testPromptId, tag: testTagName },
        { timeout: 1000 },
      );

      // 验证成功提示
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("标签已添加")`,
        { timeout: 1000 },
      );

      // 第二次拖拽相同标签 - 应该提示已存在
      await newTagElement.hover();
      await expect(newTagElement).toBeVisible({ timeout: 1000 });
      await page.mouse.down();
      await targetCard.hover();
      await expect(targetCard).toBeVisible({ timeout: 1000 });
      await page.mouse.up();

      // 验证提示"该标签已存在"
      await page.waitForSelector(
        `#${Constants.Ids.TOAST_CONTAINER}:has-text("该标签已存在")`,
        { timeout: 1000 },
      );

      // 清理测试标签
      await electronTest.cleanupPromptTagsAndGroups();
    });
  });
});

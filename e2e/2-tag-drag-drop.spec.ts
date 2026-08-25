import { expect } from "@playwright/test";
import {
  test,
  enterImageGridView,
  enterPromptGridView,
  ensureTagFilterExpanded,
  ensureTagFilterCollapsed,
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
 *
 * 数据管理：
 * - 使用测试专用数据库，每个测试文件独立
 * - beforeAll 创建共享基础数据（图像、提示词、标签组、标签）
 * - 各测试项复用共享数据，不手动清理
 */
test.describe("标签拖拽功能", () => {
  // 共享测试数据（在 beforeAll 中初始化）
  let sharedImageTagName: string;
  let sharedPromptTagName: string;

  // ========== 初始化 ==========
  test.beforeAll(async ({ electronTest }) => {
    const factory = electronTest.getApiFactory();
    const imageFactory = factory.createImageFactory();
    const promptFactory = factory.createPromptFactory();

    // 创建基础测试数据（图像/提示词）
    await imageFactory.createBatch(2, "drag");
    await promptFactory.createBatch(2, "drag");

    // 创建共享的图像标签组和标签（所有图像拖拽测试复用）
    ({ tagName: sharedImageTagName } = await imageFactory.createTagInGroup("drag_shared", "drag_shared", true));

    // 创建共享的提示词标签组和标签（所有提示词拖拽测试复用）
    ({ tagName: sharedPromptTagName } = await promptFactory.createTagInGroup("drag_shared", "drag_shared", true));

    // 刷新界面以显示新数据
    await electronTest.refreshData();
  });

  test.describe("图像标签拖拽", () => {
    test("标签拖拽到图像卡片 - 展开状态", async ({ electronTest, page }) => {
      await electronTest.logTestStart();

      // 获取第一张测试图像的 ID（使用 beforeAll 创建的数据）
      const images = await page.evaluate(async () => {
        return await window.electronAPI.getImages("updatedAt", "desc");
      });
      const testImageId = String(images[0]?.id);
      expect(testImageId).toBeTruthy();

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

      // 等待共享标签出现在筛选列表中
      await page.waitForFunction(
        (tagName: string) => {
          const tagElement = document.querySelector(
            `#imageTagFilterList .tag-filter-item[data-tag="${tagName}"]`,
          );
          return tagElement !== null;
        },
        sharedImageTagName,
        { timeout: 1000 },
      );

      const newTagElement = page.locator(
        `#imageTagFilterList .tag-filter-item[data-tag="${sharedImageTagName}"]`,
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
        { id: testImageId, tag: sharedImageTagName },
        { timeout: 1000 },
      );

      // 验证标签已添加
      const newTags = await page.evaluate(async (id) => {
        const image = await window.electronAPI.getImageById(id as string);
        return (image as IImage)?.tags || [];
      }, testImageId);

      expect(newTags.length).toBeGreaterThan(originalTags.length);
      expect(newTags).toContain(sharedImageTagName);

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
    });

    test("标签拖拽到图像卡片 - 收起状态", async ({ electronTest, page }) => {
      await electronTest.logTestStart();

      // 获取第二张测试图像的 ID（使用 beforeAll 创建的数据）
      const images = await page.evaluate(async () => {
        return await window.electronAPI.getImages("updatedAt", "desc");
      });
      const testImageId = String(images[1]?.id);
      expect(testImageId).toBeTruthy();

      await enterImageGridView(page);

      const targetCard = page.locator(`.image-card[data-id="${testImageId}"]`);
      await expect(targetCard).toBeVisible({ timeout: 1000 });

      // 确保标签筛选区域收起
      await ensureTagFilterCollapsed(
        page,
        Constants.Ids.IMAGE_TAG_FILTER_SECTION,
        Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN,
      );

      // 清除标签缓存并刷新标签筛选区
      await electronTest.clearTagCache("image");
      await electronTest.refreshTagFilters();

      // 确保标签筛选区域仍处于收起状态
      await ensureTagFilterCollapsed(
        page,
        Constants.Ids.IMAGE_TAG_FILTER_SECTION,
        Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN,
      );

      // 等待共享标签出现在 header tags 中（收起状态下只显示首位组标签）
      await page.waitForFunction(
        (tagName: string) => {
          const tagElement = document.querySelector(
            `#imageTagFilterHeaderTags .tag-filter-item[data-tag="${tagName}"]`,
          );
          return tagElement !== null;
        },
        sharedImageTagName,
        { timeout: 1000 },
      );

      const newTagElement = page.locator(
        `#imageTagFilterHeaderTags .tag-filter-item[data-tag="${sharedImageTagName}"]`,
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
        { id: testImageId, tag: sharedImageTagName },
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
    });

  });

  test.describe("提示词标签拖拽", () => {
    test("标签拖拽到提示词卡片 - 展开状态", async ({ electronTest, page }) => {
      await electronTest.logTestStart();

      // 获取第一张测试提示词的 ID（使用 beforeAll 创建的数据）
      const prompts = await page.evaluate(async () => {
        return await window.electronAPI.getPrompts("updatedAt", "desc");
      });
      const testPromptId = String(prompts[0]?.id);
      expect(testPromptId).toBeTruthy();

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

      // 等待共享标签出现在筛选列表中
      await page.waitForFunction(
        (tagName: string) => {
          const tagElement = document.querySelector(
            `#promptTagFilterList .tag-filter-item[data-tag="${tagName}"]`,
          );
          return tagElement !== null;
        },
        sharedPromptTagName,
        { timeout: 1000 },
      );

      const newTagElement = page.locator(
        `#promptTagFilterList .tag-filter-item[data-tag="${sharedPromptTagName}"]`,
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
        { id: testPromptId, tag: sharedPromptTagName },
        { timeout: 1000 },
      );

      // 验证标签已添加
      const newTags = await page.evaluate(async (id) => {
        const prompt = await window.electronAPI.getPromptById(id as string);
        return (prompt as IPrompt)?.tags || [];
      }, testPromptId);

      expect(newTags.length).toBeGreaterThan(originalTags.length);
      expect(newTags).toContain(sharedPromptTagName);

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
    });

    test("标签拖拽到提示词卡片 - 收起状态", async ({ electronTest, page }) => {
      await electronTest.logTestStart();

      // 获取第二张测试提示词的 ID（使用 beforeAll 创建的数据）
      const prompts = await page.evaluate(async () => {
        return await window.electronAPI.getPrompts("updatedAt", "desc");
      });
      const testPromptId = String(prompts[1]?.id);
      expect(testPromptId).toBeTruthy();

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

      // 等待共享标签出现在 header tags 中（收起状态下只显示首位组标签）
      await page.waitForFunction(
        (tagName: string) => {
          const tagElement = document.querySelector(
            `#promptTagFilterHeaderTags .tag-filter-item[data-tag="${tagName}"]`,
          );
          return tagElement !== null;
        },
        sharedPromptTagName,
        { timeout: 1000 },
      );

      const newTagElement = page.locator(
        `#promptTagFilterHeaderTags .tag-filter-item[data-tag="${sharedPromptTagName}"]`,
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
        { id: testPromptId, tag: sharedPromptTagName },
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
    });
  });
});

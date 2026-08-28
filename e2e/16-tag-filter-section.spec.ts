/**
 * 标签筛选区功能测试
 * 测试内容：
 * 1. 特殊标签筛选（收藏）
 * 2. 普通标签筛选（计数不为0）
 * 3. 清除筛选功能
 * 4. 排序选择器功能
 * 5. 逆序按钮功能
 * 6. 标签管理器按钮功能
 * 7. 收起/展开按钮功能
 * 8. 收起时头部标签筛选功能
 *
 * 测试设计：所有测试共享同一个应用实例，beforeAll 启动，afterAll 关闭
 */

import { expect } from "@playwright/test";
import { Constants } from "../src/renderer/constants.ts";
import {
  test,
  enterImageGridView,
  enterPromptGridView,
  ensureTagFilterExpanded,
  ensureTagFilterCollapsed,
} from "./electron-test.ts";
// ========== 图像标签筛选区测试 ==========

test.describe("图像标签筛选区", () => {
  // 文件级别：创建基础测试数据（所有测试复用）
  test.beforeAll(async ({ electronTest }) => {
    const factory = electronTest.getApiFactory();
    await factory.createImageFactory().createBatch(3, "shared");
    await electronTest.refreshData();
  });
  test('应该能通过特殊标签"无标"筛选图像', async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 进入图像网格视图
    await enterImageGridView(page);

    // 确保标签筛选区展开
    await ensureTagFilterExpanded(
      page,
      Constants.Ids.IMAGE_TAG_FILTER_SECTION,
      Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN,
    );

    // 点击"无标"特殊标签进行筛选
    const noTagBtn = page.locator(
      `#${Constants.Ids.IMAGE_TAG_FILTER_SPECIAL_TAGS} .tag-filter-item[data-tag="${Constants.NO_TAG_TAG}"]`,
    );
    await expect(noTagBtn).toBeVisible({ timeout: 1000 });
    await noTagBtn.click();

    // 验证筛选标签被选中（有active类）
    await expect(noTagBtn).toHaveClass(/active/);

    // 验证"标签筛选"按钮变成"清除筛选"
    const filterActionBtn = page.locator(`#${Constants.Ids.IMAGE_TAG_FILTER_ACTION_BTN}`);
    await expect(filterActionBtn).toHaveText("清除筛选");
    await expect(filterActionBtn).toHaveClass(/has-filters/);

    // 验证筛选动作按钮点击后清除筛选
    await filterActionBtn.click();
    await expect(filterActionBtn).toHaveText("标签筛选");
    await expect(filterActionBtn).not.toHaveClass(/has-filters/);
  });

  test("应该能通过普通标签筛选图像", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签（测试目标是筛选而非创建）
    const factory = electronTest.getApiFactory();
    const imageFactory = factory.createImageFactory();
    const testTagName = electronTest.generateE2ePrefixName("filter_test");
    await imageFactory.createTag(testTagName);

    // 获取第一个图像ID并关联标签
    const firstImageId = await page.evaluate(async () => {
      const images = await window.electronAPI.getImages("updatedAt", "desc");
      return images[0]?.id;
    });

    if (firstImageId) {
      await electronTest.linkTagsToImage(firstImageId, [testTagName]);
    }

    await electronTest.refreshData();
    await electronTest.refreshTagFilters();
    await enterImageGridView(page);

    // 确保标签筛选区展开
    await ensureTagFilterExpanded(
      page,
      Constants.Ids.IMAGE_TAG_FILTER_SECTION,
      Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN,
    );

    // 点击普通标签进行筛选
    const tagBtn = page.locator(
      `#${Constants.Ids.IMAGE_TAG_FILTER_LIST} .tag-filter-item[data-tag="${testTagName}"]`,
    );
    await expect(tagBtn).toBeVisible({ timeout: 1000 });
    await tagBtn.click();

    // 验证筛选标签被选中
    await expect(tagBtn).toHaveClass(/active/);

    // 验证标签计数显示不为0
    const tagBadge = tagBtn.locator(".tag-badge");
    const badgeText = await tagBadge.textContent();
    expect(parseInt(badgeText || "0")).toBeGreaterThan(0);
  });

  test("排序选择器应该能切换标签排序方式", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 进入图像网格视图
    await enterImageGridView(page);

    // 确保标签筛选区展开
    await ensureTagFilterExpanded(
      page,
      Constants.Ids.IMAGE_TAG_FILTER_SECTION,
      Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN,
    );

    // 获取排序选择器
    const sortSelect = page.locator(`#${Constants.Ids.IMAGE_TAG_FILTER_SORT_SELECT}`);
    await expect(sortSelect).toBeVisible({ timeout: 1000 });

    // 切换到"名称（A→Z）"排序
    await sortSelect.selectOption("name-asc");

    // 验证localStorage已更新
    const sortBy = await page.evaluate(
      (key: string) => localStorage.getItem(key),
      Constants.LocalStorageKey.IMAGE_TAG_FILTER_SORT_BY,
    );
    const sortOrder = await page.evaluate(
      (key: string) => localStorage.getItem(key),
      Constants.LocalStorageKey.IMAGE_TAG_FILTER_SORT_ORDER,
    );
    expect(sortBy).toBe("name");
    expect(sortOrder).toBe("asc");

    // 切换到"数量（多→少）"排序
    await sortSelect.selectOption("count-desc");

    const sortBy2 = await page.evaluate(
      (key: string) => localStorage.getItem(key),
      Constants.LocalStorageKey.IMAGE_TAG_FILTER_SORT_BY,
    );
    const sortOrder2 = await page.evaluate(
      (key: string) => localStorage.getItem(key),
      Constants.LocalStorageKey.IMAGE_TAG_FILTER_SORT_ORDER,
    );
    expect(sortBy2).toBe("count");
    expect(sortOrder2).toBe("desc");
  });

  test("逆序按钮应该能切换排序顺序", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 进入图像网格视图
    await enterImageGridView(page);

    // 确保标签筛选区展开
    await ensureTagFilterExpanded(
      page,
      Constants.Ids.IMAGE_TAG_FILTER_SECTION,
      Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN,
    );

    // 读取当前排序顺序
    const initialOrder = await page.evaluate(
      (key: string) => localStorage.getItem(key),
      Constants.LocalStorageKey.IMAGE_TAG_FILTER_SORT_ORDER,
    );
    const expectedNewOrder = initialOrder === "asc" ? "desc" : "asc";

    // 点击逆序按钮
    const orderBtn = page.locator(`#${Constants.Ids.IMAGE_TAG_FILTER_ORDER_BTN}`);
    await expect(orderBtn).toBeVisible({ timeout: 1000 });
    await orderBtn.click();

    // 验证排序顺序已切换
    const newOrder = await page.evaluate(
      (key: string) => localStorage.getItem(key),
      Constants.LocalStorageKey.IMAGE_TAG_FILTER_SORT_ORDER,
    );
    expect(newOrder).toBe(expectedNewOrder);

    // 再次点击逆序按钮
    await orderBtn.click();

    // 验证排序顺序已切换回初始值
    const finalOrder = await page.evaluate(
      (key: string) => localStorage.getItem(key),
      Constants.LocalStorageKey.IMAGE_TAG_FILTER_SORT_ORDER,
    );
    expect(finalOrder).toBe(initialOrder);
  });

  test("标签管理器按钮应该能打开标签管理器", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 进入图像网格视图
    await enterImageGridView(page);

    // 点击标签管理器按钮
    const tagManagerBtn = page.locator(`#${Constants.Ids.IMAGE_TAG_MANAGER_BTN}`);
    await expect(tagManagerBtn).toBeVisible({ timeout: 1000 });
    await tagManagerBtn.click();

    // 验证标签管理器模态框已打开
    const tagManagerModal = page.locator(`#${Constants.Ids.IMAGE_TAG_MANAGER_MODAL}`);
    await expect(tagManagerModal).toBeVisible({ timeout: 1000 });

    // 关闭标签管理器
    await page.click(`#${Constants.Ids.CLOSE_IMAGE_TAG_MANAGER_MODAL}`);
    await expect(tagManagerModal).toBeHidden({ timeout: 1000 });
  });

  test("收起/展开按钮应该能控制标签筛选区显示", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 切换到图像面板（不依赖卡片存在）
    await page.click(`#${Constants.Ids.IMAGE_MANAGER_BTN}`);
    await page.waitForSelector(`#${Constants.Ids.IMAGE_PANEL}`, {
      state: "visible",
      timeout: 1000,
    });

    // 确保初始状态为展开
    await ensureTagFilterExpanded(
      page,
      Constants.Ids.IMAGE_TAG_FILTER_SECTION,
      Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN,
    );

    // 点击收起按钮
    await ensureTagFilterCollapsed(
      page,
      Constants.Ids.IMAGE_TAG_FILTER_SECTION,
      Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN,
    );

    // 验证内容区域已隐藏
    const tagFilterContent = page.locator(`#${Constants.Ids.IMAGE_TAG_FILTER_CONTENT}`);
    await expect(tagFilterContent).toBeHidden();

    // 验证头部标签容器可见（收起时显示）
    const headerTags = page.locator(`#${Constants.Ids.IMAGE_TAG_FILTER_HEADER_TAGS}`);
    await expect(headerTags).toBeVisible();

    // 再次点击展开
    await ensureTagFilterExpanded(
      page,
      Constants.Ids.IMAGE_TAG_FILTER_SECTION,
      Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN,
    );

    // 验证内容区域已显示
    await expect(tagFilterContent).toBeVisible();
  });

  test("收起时应该能点击头部标签进行筛选", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 切换到图像面板（不依赖卡片存在）
    await page.click(`#${Constants.Ids.IMAGE_MANAGER_BTN}`);
    await page.waitForSelector(`#${Constants.Ids.IMAGE_PANEL}`, {
      state: "visible",
      timeout: 1000,
    });

    // 确保标签筛选区展开
    await ensureTagFilterExpanded(
      page,
      Constants.Ids.IMAGE_TAG_FILTER_SECTION,
      Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN,
    );

    // 收起标签筛选区
    await ensureTagFilterCollapsed(
      page,
      Constants.Ids.IMAGE_TAG_FILTER_SECTION,
      Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN,
    );

    // 验证头部标签容器可见
    const headerTags = page.locator(`#${Constants.Ids.IMAGE_TAG_FILTER_HEADER_TAGS}`);
    await expect(headerTags).toBeVisible();

    // 测试1: 点击头部区域的"收藏"特殊标签进行筛选
    const favoriteTagBtn = headerTags.locator(
      `.tag-filter-item[data-tag="${Constants.FAVORITE_TAG}"]`,
    );
    const hasFavoriteTag = (await favoriteTagBtn.count()) > 0;

    if (hasFavoriteTag) {
      await favoriteTagBtn.click();
      await expect(favoriteTagBtn).toHaveClass(/active/);

      // 验证"标签筛选"按钮变成"清除筛选"
      const filterActionBtn = page.locator(`#${Constants.Ids.IMAGE_TAG_FILTER_ACTION_BTN}`);
      await expect(filterActionBtn).toHaveText("清除筛选");

      // 清除筛选
      await filterActionBtn.click();
      await expect(filterActionBtn).toHaveText("标签筛选");
    }

    // 测试2: 点击头部区域的普通标签（首位组标签）进行筛选
    const firstTagBtn = headerTags
      .locator('.tag-filter-item:not([data-tag="' + Constants.FAVORITE_TAG + '"])')
      .first();
    const hasRegularTag = (await firstTagBtn.count()) > 0;

    if (hasRegularTag) {
      await firstTagBtn.click();
      await expect(firstTagBtn).toHaveClass(/active/);

      // 验证"标签筛选"按钮变成"清除筛选"
      const filterActionBtn = page.locator(`#${Constants.Ids.IMAGE_TAG_FILTER_ACTION_BTN}`);
      await expect(filterActionBtn).toHaveText("清除筛选");
    }
  });
});

// ========== 提示词标签筛选区测试 ==========

test.describe("提示词标签筛选区", () => {
  // 文件级别：创建基础测试数据（所有测试复用）
  test.beforeAll(async ({ electronTest }) => {
    const factory = electronTest.getApiFactory();
    await factory.createPromptFactory().createBatch(3, "shared");
    await electronTest.refreshData();
  });

  test('应该能通过特殊标签"无标"筛选提示词', async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 进入提示词网格视图
    await enterPromptGridView(page);

    // 确保标签筛选区展开
    await ensureTagFilterExpanded(
      page,
      Constants.Ids.PROMPT_TAG_FILTER_SECTION,
      Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN,
    );

    // 点击"无标"特殊标签进行筛选
    const noTagBtn = page.locator(
      `#${Constants.Ids.PROMPT_TAG_FILTER_SPECIAL_TAGS} .tag-filter-item[data-tag="${Constants.NO_TAG_TAG}"]`,
    );
    await expect(noTagBtn).toBeVisible({ timeout: 1000 });
    await noTagBtn.click();

    // 验证筛选标签被选中（有active类）
    await expect(noTagBtn).toHaveClass(/active/);

    // 验证"标签筛选"按钮变成"清除筛选"
    const filterActionBtn = page.locator(`#${Constants.Ids.PROMPT_TAG_FILTER_ACTION_BTN}`);
    await expect(filterActionBtn).toHaveText("清除筛选");
    await expect(filterActionBtn).toHaveClass(/has-filters/);

    // 验证筛选动作按钮点击后清除筛选
    await filterActionBtn.click();
    await expect(filterActionBtn).toHaveText("标签筛选");
    await expect(filterActionBtn).not.toHaveClass(/has-filters/);
  });

  test("应该能通过普通标签筛选提示词", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签（测试目标是筛选而非创建）
    const factory = electronTest.getApiFactory();
    const promptFactory = factory.createPromptFactory();
    const testTagName = electronTest.generateE2ePrefixName("filter_test");
    await promptFactory.createTag(testTagName);

    // 获取第一个提示词ID并关联标签
    const firstPromptId = await page.evaluate(async () => {
      const prompts = await window.electronAPI.getPrompts("updatedAt", "desc");
      return prompts[0]?.id;
    });

    if (firstPromptId) {
      await electronTest.linkTagsToPrompt(firstPromptId, [testTagName]);
    }

    await electronTest.refreshData();
    await electronTest.refreshTagFilters();
    await enterPromptGridView(page);

    // 确保标签筛选区展开
    await ensureTagFilterExpanded(
      page,
      Constants.Ids.PROMPT_TAG_FILTER_SECTION,
      Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN,
    );

    // 点击普通标签进行筛选
    const tagBtn = page.locator(
      `#${Constants.Ids.PROMPT_TAG_FILTER_LIST} .tag-filter-item[data-tag="${testTagName}"]`,
    );
    await expect(tagBtn).toBeVisible({ timeout: 1000 });
    await tagBtn.click();

    // 验证筛选标签被选中
    await expect(tagBtn).toHaveClass(/active/);

    // 验证标签计数显示不为0
    const tagBadge = tagBtn.locator(".tag-badge");
    const badgeText = await tagBadge.textContent();
    expect(parseInt(badgeText || "0")).toBeGreaterThan(0);
  });

  test("排序选择器应该能切换标签排序方式", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 进入提示词网格视图
    await enterPromptGridView(page);

    // 确保标签筛选区展开
    await ensureTagFilterExpanded(
      page,
      Constants.Ids.PROMPT_TAG_FILTER_SECTION,
      Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN,
    );

    // 获取排序选择器
    const sortSelect = page.locator(`#${Constants.Ids.PROMPT_TAG_FILTER_SORT_SELECT}`);
    await expect(sortSelect).toBeVisible({ timeout: 1000 });

    // 切换到"名称（A→Z）"排序
    await sortSelect.selectOption("name-asc");

    // 验证localStorage已更新
    const sortBy = await page.evaluate(
      (key: string) => localStorage.getItem(key),
      Constants.LocalStorageKey.PROMPT_TAG_FILTER_SORT_BY,
    );
    const sortOrder = await page.evaluate(
      (key: string) => localStorage.getItem(key),
      Constants.LocalStorageKey.PROMPT_TAG_FILTER_SORT_ORDER,
    );
    expect(sortBy).toBe("name");
    expect(sortOrder).toBe("asc");

    // 切换到"数量（多→少）"排序
    await sortSelect.selectOption("count-desc");

    const sortBy2 = await page.evaluate(
      (key: string) => localStorage.getItem(key),
      Constants.LocalStorageKey.PROMPT_TAG_FILTER_SORT_BY,
    );
    const sortOrder2 = await page.evaluate(
      (key: string) => localStorage.getItem(key),
      Constants.LocalStorageKey.PROMPT_TAG_FILTER_SORT_ORDER,
    );
    expect(sortBy2).toBe("count");
    expect(sortOrder2).toBe("desc");
  });

  test("逆序按钮应该能切换排序顺序", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 进入提示词网格视图
    await enterPromptGridView(page);

    // 确保标签筛选区展开
    await ensureTagFilterExpanded(
      page,
      Constants.Ids.PROMPT_TAG_FILTER_SECTION,
      Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN,
    );

    // 读取当前排序顺序
    const initialOrder = await page.evaluate(
      (key: string) => localStorage.getItem(key),
      Constants.LocalStorageKey.PROMPT_TAG_FILTER_SORT_ORDER,
    );
    const expectedNewOrder = initialOrder === "asc" ? "desc" : "asc";

    // 点击逆序按钮
    const orderBtn = page.locator(`#${Constants.Ids.PROMPT_TAG_FILTER_ORDER_BTN}`);
    await expect(orderBtn).toBeVisible({ timeout: 1000 });
    await orderBtn.click();

    // 验证排序顺序已切换
    const newOrder = await page.evaluate(
      (key: string) => localStorage.getItem(key),
      Constants.LocalStorageKey.PROMPT_TAG_FILTER_SORT_ORDER,
    );
    expect(newOrder).toBe(expectedNewOrder);

    // 再次点击逆序按钮
    await orderBtn.click();

    // 验证排序顺序已切换回初始值
    const finalOrder = await page.evaluate(
      (key: string) => localStorage.getItem(key),
      Constants.LocalStorageKey.PROMPT_TAG_FILTER_SORT_ORDER,
    );
    expect(finalOrder).toBe(initialOrder);
  });

  test("标签管理器按钮应该能打开标签管理器", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 进入提示词网格视图
    await enterPromptGridView(page);

    // 点击标签管理器按钮
    const tagManagerBtn = page.locator(`#${Constants.Ids.PROMPT_TAG_MANAGER_BTN}`);
    await expect(tagManagerBtn).toBeVisible({ timeout: 1000 });
    await tagManagerBtn.click();

    // 验证标签管理器模态框已打开
    const tagManagerModal = page.locator(`#${Constants.Ids.PROMPT_TAG_MANAGER_MODAL}`);
    await expect(tagManagerModal).toBeVisible({ timeout: 1000 });

    // 关闭标签管理器
    await page.click(`#${Constants.Ids.CLOSE_PROMPT_TAG_MANAGER_MODAL}`);
    await expect(tagManagerModal).toBeHidden({ timeout: 1000 });
  });

  test("收起/展开按钮应该能控制标签筛选区显示", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 切换到提示词面板（不依赖卡片存在）
    await page.click(`#${Constants.Ids.PROMPT_MANAGER_BTN}`);
    await page.waitForSelector(`#${Constants.Ids.PROMPT_PANEL}`, {
      state: "visible",
      timeout: 1000,
    });

    // 确保初始状态为展开
    await ensureTagFilterExpanded(
      page,
      Constants.Ids.PROMPT_TAG_FILTER_SECTION,
      Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN,
    );

    // 点击收起按钮
    await ensureTagFilterCollapsed(
      page,
      Constants.Ids.PROMPT_TAG_FILTER_SECTION,
      Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN,
    );

    // 验证内容区域已隐藏
    const tagFilterContent = page.locator(`#${Constants.Ids.PROMPT_TAG_FILTER_CONTENT}`);
    await expect(tagFilterContent).toBeHidden();

    // 验证头部标签容器可见（收起时显示）
    const headerTags = page.locator(`#${Constants.Ids.PROMPT_TAG_FILTER_HEADER_TAGS}`);
    await expect(headerTags).toBeVisible();

    // 再次点击展开
    await ensureTagFilterExpanded(
      page,
      Constants.Ids.PROMPT_TAG_FILTER_SECTION,
      Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN,
    );

    // 验证内容区域已显示
    await expect(tagFilterContent).toBeVisible();
  });

  test("收起时应该能点击头部标签进行筛选", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 切换到提示词面板（不依赖卡片存在）
    await page.click(`#${Constants.Ids.PROMPT_MANAGER_BTN}`);
    await page.waitForSelector(`#${Constants.Ids.PROMPT_PANEL}`, {
      state: "visible",
      timeout: 1000,
    });

    // 确保标签筛选区展开
    await ensureTagFilterExpanded(
      page,
      Constants.Ids.PROMPT_TAG_FILTER_SECTION,
      Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN,
    );

    // 收起标签筛选区
    await ensureTagFilterCollapsed(
      page,
      Constants.Ids.PROMPT_TAG_FILTER_SECTION,
      Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN,
    );

    // 验证头部标签容器可见
    const headerTags = page.locator(`#${Constants.Ids.PROMPT_TAG_FILTER_HEADER_TAGS}`);
    await expect(headerTags).toBeVisible();

    // 测试1: 点击头部区域的"收藏"特殊标签进行筛选
    const favoriteTagBtn = headerTags.locator(
      `.tag-filter-item[data-tag="${Constants.FAVORITE_TAG}"]`,
    );
    const hasFavoriteTag = (await favoriteTagBtn.count()) > 0;

    if (hasFavoriteTag) {
      await favoriteTagBtn.click();
      await expect(favoriteTagBtn).toHaveClass(/active/);

      // 验证"标签筛选"按钮变成"清除筛选"
      const filterActionBtn = page.locator(`#${Constants.Ids.PROMPT_TAG_FILTER_ACTION_BTN}`);
      await expect(filterActionBtn).toHaveText("清除筛选");

      // 清除筛选
      await filterActionBtn.click();
      await expect(filterActionBtn).toHaveText("标签筛选");
    }

    // 测试2: 点击头部区域的普通标签（首位组标签）进行筛选
    const firstTagBtn = headerTags
      .locator('.tag-filter-item:not([data-tag="' + Constants.FAVORITE_TAG + '"])')
      .first();
    const hasRegularTag = (await firstTagBtn.count()) > 0;

    if (hasRegularTag) {
      await firstTagBtn.click();
      await expect(firstTagBtn).toHaveClass(/active/);

      // 验证"标签筛选"按钮变成"清除筛选"
      const filterActionBtn = page.locator(`#${Constants.Ids.PROMPT_TAG_FILTER_ACTION_BTN}`);
      await expect(filterActionBtn).toHaveText("清除筛选");
    }
  });
});

import { expect } from "@playwright/test";
import {
  test,
  enterImageCompactView,
  enterPromptCompactView,
} from "./electron-test.ts";
import { Constants } from "../src/constants.ts";

test.describe("批量工具栏 - 紧凑视图功能测试", () => {
  // 文件级别：创建基础测试数据（所有测试复用）
  test.beforeAll(async ({ electronTest }) => {
    const factory = electronTest.getApiFactory();
    await factory.createImageFactory().createBatch(3, "shared");
    await factory.createPromptFactory().createBatch(3, "shared");
    await electronTest.refreshData();
  });

  // ==================== 图像紧凑视图 - 全选按钮 ====================
  test("图像紧凑视图-全选按钮应该选中所有列表项", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像紧凑视图
    await enterImageCompactView(page);
    await page.waitForSelector(".list-item--image.list-item--compact", {
      timeout: 1000,
    });

    // 进入批量模式（Ctrl + 点击第一个列表项）
    await page.keyboard.down("Control");
    const firstItem = page
      .locator(".list-item--image.list-item--compact")
      .first();
    await firstItem.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 验证初始计数为1
    let countText = await toolbar.locator(".batch-toolbar-count").textContent();
    expect(countText).toContain("已选择 1 个图像");

    // 点击"全选"按钮
    await toolbar.locator('[data-action="SelectAll"]').click();

    // 验证所有列表项都被选中
    await page.waitForFunction(
      () => {
        const items = document.querySelectorAll(
          ".list-item--image.list-item--compact",
        );
        const selectedItems = document.querySelectorAll(
          ".list-item--image.list-item--compact.is-selected",
        );
        return selectedItems.length === items.length;
      },
      { timeout: 1000 },
    );

    // 验证计数更新为全部
    countText = await toolbar.locator(".batch-toolbar-count").textContent();
    expect(countText).toMatch(/已选择 \d+ 个图像/);

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像紧凑视图 - 反选按钮 ====================
  test("图像紧凑视图-反选按钮应该反转选择状态", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像紧凑视图
    await enterImageCompactView(page);
    await page.waitForSelector(".list-item--image.list-item--compact", {
      timeout: 1000,
    });

    // 进入批量模式
    await page.keyboard.down("Control");
    const firstItem = page
      .locator(".list-item--image.list-item--compact")
      .first();
    await firstItem.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 点击"全选"按钮先选中所有
    await toolbar.locator('[data-action="SelectAll"]').click();
    await page.waitForFunction(
      () => {
        const items = document.querySelectorAll(
          ".list-item--image.list-item--compact",
        );
        const selectedItems = document.querySelectorAll(
          ".list-item--image.list-item--compact.is-selected",
        );
        return selectedItems.length === items.length;
      },
      { timeout: 1000 },
    );

    // 点击"反选"按钮
    await toolbar.locator('[data-action="Invert"]').click();

    // PRD: 选中数为0时不退出批量模式，工具栏仍然可见，计数显示为0
    await expect(toolbar).toBeVisible({ timeout: 1000 });
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 0 个图像");

    // 点击取消退出批量模式，避免干扰后续测试
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像紧凑视图 - 添加标签按钮 ====================
  test("图像紧凑视图-添加标签按钮应该能正常批量添加标签", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像紧凑视图
    await enterImageCompactView(page);
    await page.waitForSelector(".list-item--image.list-item--compact", {
      timeout: 1000,
    });

    // 进入批量模式
    await page.keyboard.down("Control");
    const firstItem = page
      .locator(".list-item--image.list-item--compact")
      .first();
    await firstItem.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 记录第一个列表项的ID
    const itemId = await firstItem.getAttribute("data-id");

    // 点击"添加标签"按钮
    await toolbar.locator('[data-action="AddTag"]').click();

    // 验证输入对话框出现（DialogService.showInputDialog 使用 inputModal）
    const tagModal = page.locator(`#${Constants.Ids.INPUT_MODAL}`);
    await expect(tagModal).toBeVisible({ timeout: 1000 });

    // 输入标签名（使用 e2e_ 前缀以便清理）
    const testTagName = electronTest.generateE2ePrefixName("batch_test");
    await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, testTagName);

    // 点击确定按钮
    await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);
    await expect(tagModal).toBeHidden({ timeout: 1000 });

    // 验证标签已添加到图像（通过API检查）
    await page.waitForFunction(
      async (params: { id: string; tag: string }) => {
        const images = await window.electronAPI.getImages("createdAt", "desc");
        const image = images.find((img: any) => img.id === params.id);
        return image?.tags?.includes(params.tag);
      },
      { id: itemId!, tag: testTagName },
      { timeout: 1000 },
    );

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像紧凑视图 - 收藏按钮 ====================
  test("图像紧凑视图-收藏按钮应该收藏选中的图像", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像紧凑视图
    await enterImageCompactView(page);
    await page.waitForSelector(".list-item--image.list-item--compact", {
      timeout: 1000,
    });

    // 进入批量模式
    await page.keyboard.down("Control");
    const firstItem = page
      .locator(".list-item--image.list-item--compact")
      .first();
    await firstItem.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 记录第一个列表项的ID
    const itemId = await firstItem.getAttribute("data-id");

    // 点击"收藏"按钮
    await toolbar.locator('[data-action="Favorite"]').click();

    // 验证收藏状态变化（通过检查列表项的收藏样式或API）
    await page.waitForFunction(
      async (id: string) => {
        const card = document.querySelector(
          `.list-item--image.list-item--compact[data-id="${id}"]`,
        );
        return (
          card?.classList.contains("favorited") ||
          card?.querySelector(".favorite-icon")
        );
      },
      itemId!,
      { timeout: 1000 },
    );

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像紧凑视图 - 取消按钮 ====================
  test("图像紧凑视图-取消按钮应该退出批量模式", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像紧凑视图
    await enterImageCompactView(page);
    await page.waitForSelector(".list-item--image.list-item--compact", {
      timeout: 1000,
    });

    // 进入批量模式
    await page.keyboard.down("Control");
    const firstItem = page
      .locator(".list-item--image.list-item--compact")
      .first();
    await firstItem.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 验证计数显示
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 1 个图像");

    // 点击"取消"按钮
    await toolbar.locator('[data-action="Cancel"]').click();

    // 验证工具栏隐藏
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像紧凑视图 - ESC键退出 ====================
  test("图像紧凑视图-ESC键应该退出批量模式", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 进入图像紧凑视图
    await enterImageCompactView(page);
    await page.waitForSelector(".list-item--image.list-item--compact", {
      timeout: 1000,
    });

    // 进入批量模式
    await page.keyboard.down("Control");
    const firstItem = page
      .locator(".list-item--image.list-item--compact")
      .first();
    await firstItem.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 验证计数显示
    let countText = await toolbar.locator(".batch-toolbar-count").textContent();
    expect(countText).toContain("已选择 1 个图像");

    // 按下 ESC 键
    await page.keyboard.press("Escape");

    // 验证工具栏隐藏
    await expect(toolbar).toBeHidden({ timeout: 1000 });

    // 验证选中数=0（通过重新进入批量模式检查）
    // 注意：ESC 后需要重新获取列表项元素
    await page.waitForSelector(".list-item--image.list-item--compact", {
      timeout: 1000,
    });

    // 使用更可靠的方式触发 Ctrl+点击
    const itemElement = page
      .locator(".list-item--image.list-item--compact")
      .first();
    await itemElement.click({ modifiers: ["Control"] });

    await expect(toolbar).toBeVisible({ timeout: 1000 });
    countText = await toolbar.locator(".batch-toolbar-count").textContent();
    expect(countText).toContain("已选择 1 个图像"); // 重新选中，应该是1

    // 清理
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像紧凑视图 - Shift+范围选择 ====================
  test("图像紧凑视图-Shift+点击应该范围选择", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像紧凑视图
    await enterImageCompactView(page);
    await page.waitForSelector(".list-item--image.list-item--compact", {
      timeout: 1000,
    });

    // 确保至少有3个列表项
    const items = page.locator(".list-item--image.list-item--compact");
    const itemCount = await items.count();
    if (itemCount < 3) {
      test.skip();
      return;
    }

    // 进入批量模式，选中第一项（Ctrl+点击）
    await page.keyboard.down("Control");
    await items.nth(0).click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 验证初始计数为1
    let countText = await toolbar.locator(".batch-toolbar-count").textContent();
    expect(countText).toContain("已选择 1 个图像");

    // Shift+点击第三项（应该选中0,1,2共3项）
    await page.keyboard.down("Shift");
    await items.nth(2).click();
    await page.keyboard.up("Shift");

    // 验证选中3项
    await page.waitForFunction(
      () => {
        const selectedItems = document.querySelectorAll(
          ".list-item--image.list-item--compact.is-selected",
        );
        return selectedItems.length === 3;
      },
      { timeout: 1000 },
    );

    countText = await toolbar.locator(".batch-toolbar-count").textContent();
    expect(countText).toContain("已选择 3 个图像");

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像紧凑视图 - Ctrl+A全选 ====================
  test("图像紧凑视图-Ctrl+A应该全选所有可见项目", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像紧凑视图
    await enterImageCompactView(page);
    await page.waitForSelector(".list-item--image.list-item--compact", {
      timeout: 1000,
    });

    // 进入批量模式（先选中一项）
    await page.keyboard.down("Control");
    await page.locator(".list-item--image.list-item--compact").first().click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 先取消选择
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });

    // 重新进入批量模式
    await page.keyboard.down("Control");
    await page.locator(".list-item--image.list-item--compact").first().click();
    await page.keyboard.up("Control");
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // Ctrl+A 全选
    await page.keyboard.press("Control+a");

    // 验证所有列表项被选中
    await page.waitForFunction(
      () => {
        const items = document.querySelectorAll(
          ".list-item--image.list-item--compact",
        );
        const selectedItems = document.querySelectorAll(
          ".list-item--image.list-item--compact.is-selected",
        );
        return selectedItems.length === items.length;
      },
      { timeout: 1000 },
    );

    // 验证计数显示为全部
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toMatch(/已选择 \d+ 个图像/);

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像紧凑视图 - 搜索改变退出批量模式 ====================
  test("图像紧凑视图-搜索改变应该退出批量模式", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像紧凑视图
    await enterImageCompactView(page);
    await page.waitForSelector(".list-item--image.list-item--compact", {
      timeout: 1000,
    });

    // 进入批量模式
    await page.keyboard.down("Control");
    await page.locator(".list-item--image.list-item--compact").first().click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 验证 selection-mode 类存在
    const container = page.locator(`#${Constants.Ids.IMAGE_LIST}`);
    const hasSelectionModeBefore = await container.evaluate((el: HTMLElement) =>
      el.classList.contains("selection-mode"),
    );
    expect(hasSelectionModeBefore).toBe(true);

    // 输入搜索关键词
    await page.fill(
      `#${Constants.Ids.IMAGE_SEARCH_INPUT}`,
      "test_search_keyword",
    );

    // 等待搜索生效并验证工具栏隐藏
    await expect(toolbar).toBeHidden({ timeout: 1000 });

    // 验证 selection-mode 类被移除
    const hasSelectionModeAfter = await container.evaluate((el: HTMLElement) =>
      el.classList.contains("selection-mode"),
    );
    expect(hasSelectionModeAfter).toBe(false);

    // 清理：清空搜索
    await page.click(`#${Constants.Ids.CLEAR_IMAGE_SEARCH_BTN}`);
  });

  // ==================== 图像紧凑视图 - 添加标签空输入不执行 ====================
  test("图像紧凑视图-添加标签空输入不应该执行操作", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像紧凑视图
    await enterImageCompactView(page);
    await page.waitForSelector(".list-item--image.list-item--compact", {
      timeout: 1000,
    });

    // 进入批量模式
    await page.keyboard.down("Control");
    const firstItem = page
      .locator(".list-item--image.list-item--compact")
      .first();
    const itemId = await firstItem.getAttribute("data-id");
    await firstItem.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 记录操作前的标签（通过API）
    const tagsBefore = await page.evaluate(async (id: string) => {
      const images = await window.electronAPI.getImages("createdAt", "desc");
      const image = images.find((img: any) => img.id === id);
      return image?.tags || [];
    }, itemId!);

    // 点击"添加标签"按钮
    await toolbar.locator('[data-action="AddTag"]').click();

    // 验证输入对话框出现
    const tagModal = page.locator(`#${Constants.Ids.INPUT_MODAL}`);
    await expect(tagModal).toBeVisible({ timeout: 1000 });

    // 不输入任何内容，直接点击确定
    await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

    // 验证对话框关闭
    await expect(tagModal).toBeHidden({ timeout: 1000 });

    // 验证标签未改变（通过API检查）
    const tagsAfter = await page.evaluate(async (id: string) => {
      const images = await window.electronAPI.getImages("createdAt", "desc");
      const image = images.find((img: any) => img.id === id);
      return image?.tags || [];
    }, itemId!);

    expect(tagsAfter).toEqual(tagsBefore);

    // 验证工具栏仍然可见（选中集不变）
    await expect(toolbar).toBeVisible({ timeout: 1000 });
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 1 个图像");

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
  });

  // ==================== 提示词紧凑视图 - 全选按钮 ====================
  test("提示词紧凑视图-全选按钮应该选中所有列表项", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词紧凑视图
    await enterPromptCompactView(page);
    await page.waitForSelector(".list-item--prompt.list-item--compact", {
      timeout: 1000,
    });

    // 进入批量模式
    await page.keyboard.down("Control");
    const firstItem = page
      .locator(".list-item--prompt.list-item--compact")
      .first();
    await firstItem.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 点击"全选"按钮
    await toolbar.locator('[data-action="SelectAll"]').click();

    // 验证所有列表项都被选中
    await page.waitForFunction(
      () => {
        const items = document.querySelectorAll(
          ".list-item--prompt.list-item--compact",
        );
        const selectedItems = document.querySelectorAll(
          ".list-item--prompt.list-item--compact.is-selected",
        );
        return selectedItems.length === items.length;
      },
      { timeout: 1000 },
    );

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词紧凑视图 - 反选按钮 ====================
  test("提示词紧凑视图-反选按钮应该反转选择状态", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词紧凑视图
    await enterPromptCompactView(page);
    await page.waitForSelector(".list-item--prompt.list-item--compact", {
      timeout: 1000,
    });

    // 进入批量模式
    await page.keyboard.down("Control");
    const firstItem = page
      .locator(".list-item--prompt.list-item--compact")
      .first();
    await firstItem.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 点击"全选"按钮
    await toolbar.locator('[data-action="SelectAll"]').click();
    await page.waitForFunction(
      () => {
        const items = document.querySelectorAll(
          ".list-item--prompt.list-item--compact",
        );
        const selectedItems = document.querySelectorAll(
          ".list-item--prompt.list-item--compact.is-selected",
        );
        return selectedItems.length === items.length;
      },
      { timeout: 1000 },
    );

    // 点击"反选"按钮
    await toolbar.locator('[data-action="Invert"]').click();

    // PRD: 选中数为0时不退出批量模式，工具栏仍然可见，计数显示为0
    await expect(toolbar).toBeVisible({ timeout: 1000 });
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 0 个提示词");

    // 点击取消退出批量模式，避免干扰后续测试
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词紧凑视图 - 添加标签按钮 ====================
  test("提示词紧凑视图-添加标签按钮应该能正常批量添加标签", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词紧凑视图
    await enterPromptCompactView(page);
    await page.waitForSelector(".list-item--prompt.list-item--compact", {
      timeout: 1000,
    });

    // 进入批量模式
    await page.keyboard.down("Control");
    const firstItem = page
      .locator(".list-item--prompt.list-item--compact")
      .first();
    await firstItem.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 记录第一个列表项的ID
    const itemId = await firstItem.getAttribute("data-id");

    // 点击"添加标签"按钮
    await toolbar.locator('[data-action="AddTag"]').click();

    // 验证输入对话框出现
    const tagModal = page.locator(`#${Constants.Ids.INPUT_MODAL}`);
    await expect(tagModal).toBeVisible({ timeout: 1000 });

    // 输入标签名（使用 e2e_ 前缀以便清理）
    const testTagName = electronTest.generateE2ePrefixName("batch_test");
    await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, testTagName);

    // 点击确定按钮
    await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);
    await expect(tagModal).toBeHidden({ timeout: 1000 });

    // 验证标签已添加到提示词（通过API检查）
    await page.waitForFunction(
      async (params: { id: string; tag: string }) => {
        const prompts = await window.electronAPI.getPrompts(
          "createdAt",
          "desc",
        );
        const prompt = prompts.find((p: any) => p.id === params.id);
        return prompt?.tags?.includes(params.tag);
      },
      { id: itemId!, tag: testTagName },
      { timeout: 1000 },
    );

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词紧凑视图 - 收藏按钮 ====================
  test("提示词紧凑视图-收藏按钮应该收藏选中的提示词", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词紧凑视图
    await enterPromptCompactView(page);
    await page.waitForSelector(".list-item--prompt.list-item--compact", {
      timeout: 1000,
    });

    // 进入批量模式
    await page.keyboard.down("Control");
    const firstItem = page
      .locator(".list-item--prompt.list-item--compact")
      .first();
    await firstItem.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 记录第一个列表项的ID
    const itemId = await firstItem.getAttribute("data-id");

    // 点击"收藏"按钮
    await toolbar.locator('[data-action="Favorite"]').click();

    // 验证收藏状态变化
    await page.waitForFunction(
      async (id: string) => {
        const card = document.querySelector(
          `.list-item--prompt.list-item--compact[data-id="${id}"]`,
        );
        return (
          card?.classList.contains("favorited") ||
          card?.querySelector(".favorite-icon")
        );
      },
      itemId!,
      { timeout: 1000 },
    );

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词紧凑视图 - 取消按钮 ====================
  test("提示词紧凑视图-取消按钮应该退出批量模式", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词紧凑视图
    await enterPromptCompactView(page);
    await page.waitForSelector(".list-item--prompt.list-item--compact", {
      timeout: 1000,
    });

    // 进入批量模式
    await page.keyboard.down("Control");
    const firstItem = page
      .locator(".list-item--prompt.list-item--compact")
      .first();
    await firstItem.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 验证计数显示
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 1 个提示词");

    // 点击"取消"按钮
    await toolbar.locator('[data-action="Cancel"]').click();

    // 验证工具栏隐藏
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词紧凑视图 - ESC键退出 ====================
  test("提示词紧凑视图-ESC键应该退出批量模式", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词紧凑视图
    await enterPromptCompactView(page);
    await page.waitForSelector(".list-item--prompt.list-item--compact", {
      timeout: 1000,
    });

    // 进入批量模式
    await page.keyboard.down("Control");
    const firstItem = page
      .locator(".list-item--prompt.list-item--compact")
      .first();
    await firstItem.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 按下 ESC 键
    await page.keyboard.press("Escape");

    // 验证工具栏隐藏
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词紧凑视图 - Shift+范围选择 ====================
  test("提示词紧凑视图-Shift+点击应该范围选择", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词紧凑视图
    await enterPromptCompactView(page);
    await page.waitForSelector(".list-item--prompt.list-item--compact", {
      timeout: 1000,
    });

    // 确保至少有3个列表项
    const items = page.locator(".list-item--prompt.list-item--compact");
    const itemCount = await items.count();
    if (itemCount < 3) {
      test.skip();
      return;
    }

    // 进入批量模式，选中第一项
    await page.keyboard.down("Control");
    await items.nth(0).click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // Shift+点击第三项
    await page.keyboard.down("Shift");
    await items.nth(2).click();
    await page.keyboard.up("Shift");

    // 验证选中3项
    await page.waitForFunction(
      () => {
        const selectedItems = document.querySelectorAll(
          ".list-item--prompt.list-item--compact.is-selected",
        );
        return selectedItems.length === 3;
      },
      { timeout: 1000 },
    );

    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 3 个提示词");

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词紧凑视图 - Ctrl+A全选 ====================
  test("提示词紧凑视图-Ctrl+A应该全选所有可见项目", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词紧凑视图
    await enterPromptCompactView(page);
    await page.waitForSelector(".list-item--prompt.list-item--compact", {
      timeout: 1000,
    });

    // 进入批量模式
    await page.keyboard.down("Control");
    await page.locator(".list-item--prompt.list-item--compact").first().click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 先取消选择
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });

    // 重新进入批量模式
    await page.keyboard.down("Control");
    await page.locator(".list-item--prompt.list-item--compact").first().click();
    await page.keyboard.up("Control");
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // Ctrl+A 全选
    await page.keyboard.press("Control+a");

    // 验证所有列表项被选中
    await page.waitForFunction(
      () => {
        const items = document.querySelectorAll(
          ".list-item--prompt.list-item--compact",
        );
        const selectedItems = document.querySelectorAll(
          ".list-item--prompt.list-item--compact.is-selected",
        );
        return selectedItems.length === items.length;
      },
      { timeout: 1000 },
    );

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词紧凑视图 - 搜索改变退出批量模式 ====================
  test("提示词紧凑视图-搜索改变应该退出批量模式", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词紧凑视图
    await enterPromptCompactView(page);
    await page.waitForSelector(".list-item--prompt.list-item--compact", {
      timeout: 1000,
    });

    // 进入批量模式
    await page.keyboard.down("Control");
    await page.locator(".list-item--prompt.list-item--compact").first().click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 验证 selection-mode 类存在
    const container = page.locator(`#${Constants.Ids.PROMPT_LIST}`);
    const hasSelectionModeBefore = await container.evaluate((el: HTMLElement) =>
      el.classList.contains("selection-mode"),
    );
    expect(hasSelectionModeBefore).toBe(true);

    // 输入搜索关键词
    await page.fill(
      `#${Constants.Ids.PROMPT_SEARCH_INPUT}`,
      "test_search_keyword",
    );

    // 等待搜索生效并验证工具栏隐藏
    await expect(toolbar).toBeHidden({ timeout: 1000 });

    // 验证 selection-mode 类被移除
    const hasSelectionModeAfter = await container.evaluate((el: HTMLElement) =>
      el.classList.contains("selection-mode"),
    );
    expect(hasSelectionModeAfter).toBe(false);

    // 清理：清空搜索
    await page.click(`#${Constants.Ids.CLEAR_PROMPT_SEARCH_BTN}`);
  });

  // ==================== 提示词紧凑视图 - 添加标签空输入不执行 ====================
  test("提示词紧凑视图-添加标签空输入不应该执行操作", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词紧凑视图
    await enterPromptCompactView(page);
    await page.waitForSelector(".list-item--prompt.list-item--compact", {
      timeout: 1000,
    });

    // 进入批量模式
    await page.keyboard.down("Control");
    const firstItem = page
      .locator(".list-item--prompt.list-item--compact")
      .first();
    const itemId = await firstItem.getAttribute("data-id");
    await firstItem.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 记录操作前的标签
    const tagsBefore = await page.evaluate(async (id: string) => {
      const prompts = await window.electronAPI.getPrompts("createdAt", "desc");
      const prompt = prompts.find((p: any) => p.id === id);
      return prompt?.tags || [];
    }, itemId!);

    // 点击"添加标签"按钮
    await toolbar.locator('[data-action="AddTag"]').click();

    // 验证输入对话框出现
    const tagModal = page.locator(`#${Constants.Ids.INPUT_MODAL}`);
    await expect(tagModal).toBeVisible({ timeout: 1000 });

    // 不输入任何内容，直接点击确定
    await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);
    await expect(tagModal).toBeHidden({ timeout: 1000 });

    // 验证标签未改变
    const tagsAfter = await page.evaluate(async (id: string) => {
      const prompts = await window.electronAPI.getPrompts("createdAt", "desc");
      const prompt = prompts.find((p: any) => p.id === id);
      return prompt?.tags || [];
    }, itemId!);

    expect(tagsAfter).toEqual(tagsBefore);

    // 验证工具栏仍然可见
    await expect(toolbar).toBeVisible({ timeout: 1000 });
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 1 个提示词");

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
  });

  // ==================== 图像紧凑视图 - 删除按钮（完整流程） ====================
  test("图像紧凑视图-删除按钮应该将测试图像移到回收站", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建2个测试图像
    const factory = electronTest.getApiFactory();
    const imageFactory = factory.createImageFactory();
    const testImages = await imageFactory.createBatch(2, "batch_delete");
    expect(testImages.length).toBe(2);
    const testImageIds = testImages.map((img) => img.id);

    await electronTest.refreshData();

    // 进入图像紧凑视图
    await enterImageCompactView(page);

    // 验证测试图像已显示（显式等待条件）
    await page.waitForFunction(
      (ids: string[]) => {
        const items = document.querySelectorAll(
          ".list-item--image.list-item--compact",
        );
        const foundIds = Array.from(items).map((card) =>
          card.getAttribute("data-id"),
        );
        return ids.every((id) => foundIds.includes(id));
      },
      testImageIds,
      { timeout: 1000 },
    );

    // 进入批量模式 - 选中测试图像
    await page.keyboard.down("Control");
    await page.click(`.list-item--image.list-item--compact[data-id="${testImageIds[0]}"]`);
    await page.click(`.list-item--image.list-item--compact[data-id="${testImageIds[1]}"]`);
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 验证计数为2
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 2 个图像");

    // 点击删除按钮
    await toolbar.locator('[data-action="Delete"]').click();

    // 验证确认对话框
    const confirmModal = page.locator(`#${Constants.Ids.CONFIRM_MODAL}`);
    await expect(confirmModal).toBeVisible({ timeout: 1000 });

    // 确认删除
    await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);
    await expect(confirmModal).toBeHidden({ timeout: 1000 });

    // PRD: 验证清空选择（选中数=0）
    let countTextAfter = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countTextAfter).toContain("已选择 0 个图像");

    // PRD: 验证 Toast 提示 - 等待包含"已删除"的特定 Toast
    const toast = page.locator('.toast-notification, .toast, [role="alert"]');
    await expect(toast).toBeVisible({ timeout: 3000 });

    // 等待 Toast 内容包含"已删除"（处理竞态条件：刷新 Toast 可能还在显示）
    await expect
      .poll(
        async () => {
          const text = (await toast.textContent()) || "";
          return text;
        },
        {
          message: "等待 Toast 显示删除成功消息",
          timeout: 1000,
          intervals: [100, 200, 300],
        },
      )
      .toMatch(/已删除/);

    const toastText = await toast.textContent();
    expect(toastText).toMatch(/删除成功|已删除|成功/);

    // 通过 API 验证图像已移到回收站（isDeleted = true）
    await page.waitForFunction(
      async (ids: string[]) => {
        const images = await window.electronAPI.getImages("createdAt", "desc");
        const testImages = images.filter((img: { id: string }) =>
          ids.includes(img.id),
        );
        return testImages.every((img: { isDeleted: boolean }) => img.isDeleted);
      },
      testImageIds,
      { timeout: 1000 },
    );
  });

  // ==================== 提示词紧凑视图 - 删除按钮（完整流程） ====================
  test("提示词紧凑视图-删除按钮应该将测试提示词移到回收站", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建2个测试提示词
    const factory = electronTest.getApiFactory();
    const promptFactory = factory.createPromptFactory();
    const testPrompts = await promptFactory.createBatch(2, "batch_delete");
    expect(testPrompts.length).toBe(2);
    const testPromptIds = testPrompts.map((p) => p.id);

    await electronTest.refreshData();

    // 进入提示词紧凑视图
    await enterPromptCompactView(page);

    // 验证测试提示词已显示
    await page.waitForFunction(
      (ids: string[]) => {
        const items = document.querySelectorAll(
          ".list-item--prompt.list-item--compact",
        );
        const foundIds = Array.from(items).map((card) =>
          card.getAttribute("data-id"),
        );
        return ids.every((id) => foundIds.includes(id));
      },
      testPromptIds,
      { timeout: 1000 },
    );

    // 进入批量模式
    await page.keyboard.down("Control");
    await page.click(`.list-item--prompt.list-item--compact[data-id="${testPromptIds[0]}"]`);
    await page.click(`.list-item--prompt.list-item--compact[data-id="${testPromptIds[1]}"]`);
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 点击删除按钮
    await toolbar.locator('[data-action="Delete"]').click();

    // 验证确认对话框
    const confirmModal = page.locator(`#${Constants.Ids.CONFIRM_MODAL}`);
    await expect(confirmModal).toBeVisible({ timeout: 1000 });

    // 确认删除
    await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);
    await expect(confirmModal).toBeHidden({ timeout: 1000 });

    // PRD: 验证清空选择（选中数=0）
    let countTextAfter = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countTextAfter).toContain("已选择 0 个提示词");

    // PRD: 验证 Toast 提示 - 等待包含"已删除"的特定 Toast
    const toast = page.locator('.toast-notification, .toast, [role="alert"]');
    await expect(toast).toBeVisible({ timeout: 3000 });

    // 等待 Toast 内容包含"已删除"（处理竞态条件：刷新 Toast 可能还在显示）
    await expect
      .poll(
        async () => {
          const text = (await toast.textContent()) || "";
          return text;
        },
        {
          message: "等待 Toast 显示删除成功消息",
          timeout: 1000,
          intervals: [100, 200, 300],
        },
      )
      .toMatch(/已删除/);

    const toastText = await toast.textContent();
    expect(toastText).toMatch(/删除成功|已删除|成功/);

    // 通过 API 验证提示词已移到回收站（isDeleted = true）
    await page.waitForFunction(
      async (ids: string[]) => {
        const prompts = await window.electronAPI.getPrompts(
          "createdAt",
          "desc",
        );
        const testPrompts = prompts.filter((p: { id: string }) =>
          ids.includes(p.id),
        );
        return testPrompts.every((p: { isDeleted: boolean }) => p.isDeleted);
      },
      testPromptIds,
      { timeout: 1000 },
    );
  });

  // ==================== 图像紧凑视图 - 视图模式切换保留选择状态 ====================
  test("图像紧凑视图-视图模式切换应该保留选择状态", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像紧凑视图
    await enterImageCompactView(page);
    await page.waitForSelector(".list-item--image.list-item--compact", {
      timeout: 1000,
    });

    // 确保至少有2个列表项
    const items = page.locator(".list-item--image.list-item--compact");
    const itemCount = await items.count();
    if (itemCount < 2) {
      test.skip();
      return;
    }

    // 进入批量模式，选中2项
    await page.keyboard.down("Control");
    const item1 = items.nth(0);
    const item2 = items.nth(1);
    const itemId1 = await item1.getAttribute("data-id");
    const itemId2 = await item2.getAttribute("data-id");
    await item1.click();
    await item2.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 验证计数为2
    let countText = await toolbar.locator(".batch-toolbar-count").textContent();
    expect(countText).toContain("已选择 2 个图像");

    // 切换到列表视图
    await page.click(`#${Constants.Ids.IMAGE_LIST_VIEW_BTN}`);
    await page.waitForSelector(`#${Constants.Ids.IMAGE_LIST}`, {
      state: "visible",
      timeout: 1000,
    });

    // 验证工具栏仍然可见，计数不变
    await expect(toolbar).toBeVisible({ timeout: 1000 });
    countText = await toolbar.locator(".batch-toolbar-count").textContent();
    expect(countText).toContain("已选择 2 个图像");

    // 验证相同项目仍然被选中（通过data-id）- 切换到列表视图后使用列表视图选择器
    await page.waitForFunction(
      (ids: readonly (string | null)[]) => {
        const selectedItems = document.querySelectorAll(
          ".list-item--image.is-selected",
        );
        const selectedIds = Array.from(selectedItems).map((item) =>
          item.getAttribute("data-id"),
        );
        return ids.every((id) => id !== null && selectedIds.includes(id));
      },
      [itemId1, itemId2] as const,
      { timeout: 1000 },
    );

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词紧凑视图 - 视图模式切换保留选择状态 ====================
  test("提示词紧凑视图-视图模式切换应该保留选择状态", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词紧凑视图
    await enterPromptCompactView(page);
    await page.waitForSelector(".list-item--prompt.list-item--compact", {
      timeout: 1000,
    });

    // 确保至少有2个列表项
    const items = page.locator(".list-item--prompt.list-item--compact");
    const itemCount = await items.count();
    if (itemCount < 2) {
      test.skip();
      return;
    }

    // 进入批量模式，选中2项
    await page.keyboard.down("Control");
    const item1 = items.nth(0);
    const item2 = items.nth(1);
    const itemId1 = await item1.getAttribute("data-id");
    const itemId2 = await item2.getAttribute("data-id");
    await item1.click();
    await item2.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 验证计数为2
    let countText = await toolbar.locator(".batch-toolbar-count").textContent();
    expect(countText).toContain("已选择 2 个提示词");

    // 切换到列表视图
    await page.click(`#${Constants.Ids.PROMPT_LIST_VIEW_BTN}`);
    await page.waitForSelector(`#${Constants.Ids.PROMPT_LIST}`, {
      state: "visible",
      timeout: 1000,
    });

    // 验证工具栏仍然可见，计数不变
    await expect(toolbar).toBeVisible({ timeout: 1000 });
    countText = await toolbar.locator(".batch-toolbar-count").textContent();
    expect(countText).toContain("已选择 2 个提示词");

    // 验证相同项目仍然被选中（通过data-id）- 切换到列表视图后使用列表视图选择器
    await page.waitForFunction(
      (ids: readonly (string | null)[]) => {
        const selectedItems = document.querySelectorAll(
          ".list-item--prompt.is-selected",
        );
        const selectedIds = Array.from(selectedItems).map((item) =>
          item.getAttribute("data-id"),
        );
        return ids.every((id) => id !== null && selectedIds.includes(id));
      },
      [itemId1, itemId2] as const,
      { timeout: 1000 },
    );

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像紧凑视图 - 展开状态点击标签退出批量模式 ====================
  test("图像紧凑视图-展开状态点击标签应该退出批量模式", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像紧凑视图
    await enterImageCompactView(page);
    await page.waitForSelector(".list-item--image.list-item--compact", {
      timeout: 1000,
    });

    // 确保至少有一个列表项
    const items = page.locator(".list-item--image.list-item--compact");
    const itemCount = await items.count();
    if (itemCount < 1) {
      test.skip();
      return;
    }

    // 进入批量模式，选中1项
    await page.keyboard.down("Control");
    const item1 = items.nth(0);
    await item1.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 验证 selection-mode 类存在
    const container = page.locator(`#${Constants.Ids.IMAGE_LIST}`);
    const hasSelectionModeBefore = await container.evaluate((el: HTMLElement) =>
      el.classList.contains("selection-mode"),
    );
    expect(hasSelectionModeBefore).toBe(true);

    // 确保标签过滤器展开
    const tagFilterSection = page.locator(
      `#${Constants.Ids.IMAGE_TAG_FILTER_SECTION}`,
    );
    const isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) =>
      el.classList.contains("collapsed"),
    );
    if (isCollapsed) {
      await page.click(`#${Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN}`);
      // 等待标签过滤器内容可见
      await page.waitForSelector(
        `#${Constants.Ids.IMAGE_TAG_FILTER_CONTENT} .tag-filter-item`,
        { state: "visible", timeout: 1000 },
      );
    }

    // 点击一个标签（使用可见的标签）
    const firstTag = page
      .locator(`#${Constants.Ids.IMAGE_TAG_FILTER_CONTENT} .tag-filter-item`)
      .first();
    await firstTag.click();

    // 验证工具栏隐藏
    await expect(toolbar).toBeHidden({ timeout: 1000 });

    // 验证 selection-mode 类被移除
    const hasSelectionModeAfter = await container.evaluate((el: HTMLElement) =>
      el.classList.contains("selection-mode"),
    );
    expect(hasSelectionModeAfter).toBe(false);

    // 清理：清除标签筛选（点击标签筛选动作按钮）
    await page.click(`#${Constants.Ids.IMAGE_TAG_FILTER_ACTION_BTN}`);
  });

  // ==================== 提示词紧凑视图 - 展开状态点击标签退出批量模式 ====================
  test("提示词紧凑视图-展开状态点击标签应该退出批量模式", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词紧凑视图
    await enterPromptCompactView(page);
    await page.waitForSelector(".list-item--prompt.list-item--compact", {
      timeout: 1000,
    });

    // 确保至少有一个列表项
    const items = page.locator(".list-item--prompt.list-item--compact");
    const itemCount = await items.count();
    if (itemCount < 1) {
      test.skip();
      return;
    }

    // 进入批量模式，选中1项
    await page.keyboard.down("Control");
    const item1 = items.nth(0);
    await item1.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 验证 selection-mode 类存在
    const container = page.locator(`#${Constants.Ids.PROMPT_LIST}`);
    const hasSelectionModeBefore = await container.evaluate((el: HTMLElement) =>
      el.classList.contains("selection-mode"),
    );
    expect(hasSelectionModeBefore).toBe(true);

    // 确保标签过滤器展开
    const tagFilterSection = page.locator(
      `#${Constants.Ids.PROMPT_TAG_FILTER_SECTION}`,
    );
    const isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) =>
      el.classList.contains("collapsed"),
    );
    if (isCollapsed) {
      await page.click(`#${Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN}`);
      // 等待标签过滤器内容可见
      await page.waitForSelector(
        `#${Constants.Ids.PROMPT_TAG_FILTER_CONTENT} .tag-filter-item`,
        { state: "visible", timeout: 1000 },
      );
    }

    // 点击一个标签（使用可见的标签）
    const firstTag = page
      .locator(`#${Constants.Ids.PROMPT_TAG_FILTER_CONTENT} .tag-filter-item`)
      .first();
    await firstTag.click();

    // 验证工具栏隐藏
    await expect(toolbar).toBeHidden({ timeout: 1000 });

    // 验证 selection-mode 类被移除
    const hasSelectionModeAfter = await container.evaluate((el: HTMLElement) =>
      el.classList.contains("selection-mode"),
    );
    expect(hasSelectionModeAfter).toBe(false);

    // 清理：清除标签筛选（点击标签筛选动作按钮）
    await page.click(`#${Constants.Ids.PROMPT_TAG_FILTER_ACTION_BTN}`);
  });

  // ==================== 图像紧凑视图 - 收起状态点击标签退出批量模式 ====================
  test("图像紧凑视图-收起状态点击标签应该退出批量模式", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像紧凑视图
    await enterImageCompactView(page);
    await page.waitForSelector(".list-item--image.list-item--compact", {
      timeout: 1000,
    });

    // 确保至少有一个列表项
    const items = page.locator(".list-item--image.list-item--compact");
    const itemCount = await items.count();
    if (itemCount < 1) {
      test.skip();
      return;
    }

    // 确保标签过滤器收起
    const tagFilterSection = page.locator(
      `#${Constants.Ids.IMAGE_TAG_FILTER_SECTION}`,
    );
    const isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) =>
      el.classList.contains("collapsed"),
    );
    if (!isCollapsed) {
      await page.click(`#${Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN}`);
      // 等待标签过滤器内容隐藏
      await page.waitForSelector(
        `#${Constants.Ids.IMAGE_TAG_FILTER_CONTENT} .tag-filter-item`,
        { state: "hidden", timeout: 1000 },
      );
    }

    // 进入批量模式，选中1项
    await page.keyboard.down("Control");
    const item1 = items.nth(0);
    await item1.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 验证 selection-mode 类存在
    const container = page.locator(`#${Constants.Ids.IMAGE_LIST}`);
    const hasSelectionModeBefore = await container.evaluate((el: HTMLElement) =>
      el.classList.contains("selection-mode"),
    );
    expect(hasSelectionModeBefore).toBe(true);

    // 收起状态下点击标签（标签仍然可见）
    const firstTag = page
      .locator(`#${Constants.Ids.IMAGE_TAG_FILTER_SECTION} .tag-filter-item`)
      .first();
    await firstTag.click();

    // 验证工具栏隐藏
    await expect(toolbar).toBeHidden({ timeout: 1000 });

    // 验证 selection-mode 类被移除
    const hasSelectionModeAfter = await container.evaluate((el: HTMLElement) =>
      el.classList.contains("selection-mode"),
    );
    expect(hasSelectionModeAfter).toBe(false);

    // 清理：清除标签筛选（点击标签筛选动作按钮）
    await page.click(`#${Constants.Ids.IMAGE_TAG_FILTER_ACTION_BTN}`);
  });

  // ==================== 提示词紧凑视图 - 收起状态点击标签退出批量模式 ====================
  test("提示词紧凑视图-收起状态点击标签应该退出批量模式", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词紧凑视图
    await enterPromptCompactView(page);
    await page.waitForSelector(".list-item--prompt.list-item--compact", {
      timeout: 1000,
    });

    // 确保至少有一个列表项
    const items = page.locator(".list-item--prompt.list-item--compact");
    const itemCount = await items.count();
    if (itemCount < 1) {
      test.skip();
      return;
    }

    // 确保标签过滤器收起
    const tagFilterSection = page.locator(
      `#${Constants.Ids.PROMPT_TAG_FILTER_SECTION}`,
    );
    const isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) =>
      el.classList.contains("collapsed"),
    );
    if (!isCollapsed) {
      await page.click(`#${Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN}`);
      // 等待标签过滤器内容隐藏（收起状态下标签仍然可见，但内容区域折叠）
      await page.waitForSelector(
        `#${Constants.Ids.PROMPT_TAG_FILTER_CONTENT}`,
        { state: "hidden", timeout: 1000 },
      );
    }

    // 进入批量模式，选中1项
    await page.keyboard.down("Control");
    const item1 = items.nth(0);
    await item1.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 验证 selection-mode 类存在
    const container = page.locator(`#${Constants.Ids.PROMPT_LIST}`);
    const hasSelectionModeBefore = await container.evaluate((el: HTMLElement) =>
      el.classList.contains("selection-mode"),
    );
    expect(hasSelectionModeBefore).toBe(true);

    // 收起状态下点击标签（标签仍然可见）
    const firstTag = page
      .locator(`#${Constants.Ids.PROMPT_TAG_FILTER_SECTION} .tag-filter-item`)
      .first();
    await firstTag.click();

    // 验证工具栏隐藏
    await expect(toolbar).toBeHidden({ timeout: 1000 });

    // 验证 selection-mode 类被移除
    const hasSelectionModeAfter = await container.evaluate((el: HTMLElement) =>
      el.classList.contains("selection-mode"),
    );
    expect(hasSelectionModeAfter).toBe(false);

    // 清理：清除标签筛选（点击标签筛选动作按钮）
    await page.click(`#${Constants.Ids.PROMPT_TAG_FILTER_ACTION_BTN}`);
  });

  // ==================== 图像紧凑视图 - 切换到网格视图保留选择状态 ====================
  test("图像紧凑视图-切换到网格视图应该保留选择状态", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像紧凑视图
    await enterImageCompactView(page);
    await page.waitForSelector(".list-item--image.list-item--compact", {
      timeout: 1000,
    });

    // 确保至少有2个列表项
    const items = page.locator(".list-item--image.list-item--compact");
    const itemCount = await items.count();
    if (itemCount < 2) {
      test.skip();
      return;
    }

    // 进入批量模式，选中2项
    await page.keyboard.down("Control");
    const item1 = items.nth(0);
    const item2 = items.nth(1);
    const itemId1 = await item1.getAttribute("data-id");
    const itemId2 = await item2.getAttribute("data-id");
    await item1.click();
    await item2.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 验证计数为2
    let countText = await toolbar.locator(".batch-toolbar-count").textContent();
    expect(countText).toContain("已选择 2 个图像");

    // 切换到网格视图
    await page.click(`#${Constants.Ids.IMAGE_GRID_VIEW_BTN}`);
    await page.waitForSelector(`#${Constants.Ids.IMAGE_GRID}`, {
      state: "visible",
      timeout: 1000,
    });

    // 验证工具栏仍然可见，计数不变
    await expect(toolbar).toBeVisible({ timeout: 1000 });
    countText = await toolbar.locator(".batch-toolbar-count").textContent();
    expect(countText).toContain("已选择 2 个图像");

    // 验证相同项目仍然被选中（通过data-id）
    await page.waitForFunction(
      (ids: readonly (string | null)[]) => {
        const selectedItems = document.querySelectorAll(
          ".image-card.is-selected",
        );
        const selectedIds = Array.from(selectedItems).map((item) =>
          item.getAttribute("data-id"),
        );
        return ids.every((id) => id !== null && selectedIds.includes(id));
      },
      [itemId1, itemId2] as const,
      { timeout: 1000 },
    );

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词紧凑视图 - 切换到网格视图保留选择状态 ====================
  test("提示词紧凑视图-切换到网格视图应该保留选择状态", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词紧凑视图
    await enterPromptCompactView(page);
    await page.waitForSelector(".list-item--prompt.list-item--compact", {
      timeout: 1000,
    });

    // 确保至少有2个列表项
    const items = page.locator(".list-item--prompt.list-item--compact");
    const itemCount = await items.count();
    if (itemCount < 2) {
      test.skip();
      return;
    }

    // 进入批量模式，选中2项
    await page.keyboard.down("Control");
    const item1 = items.nth(0);
    const item2 = items.nth(1);
    const itemId1 = await item1.getAttribute("data-id");
    const itemId2 = await item2.getAttribute("data-id");
    await item1.click();
    await item2.click();
    await page.keyboard.up("Control");

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 验证计数为2
    let countText = await toolbar.locator(".batch-toolbar-count").textContent();
    expect(countText).toContain("已选择 2 个提示词");

    // 切换到网格视图
    await page.click(`#${Constants.Ids.PROMPT_GRID_VIEW_BTN}`);
    await page.waitForSelector(`#${Constants.Ids.PROMPT_GRID}`, {
      state: "visible",
      timeout: 1000,
    });

    // 验证工具栏仍然可见，计数不变
    await expect(toolbar).toBeVisible({ timeout: 1000 });
    countText = await toolbar.locator(".batch-toolbar-count").textContent();
    expect(countText).toContain("已选择 2 个提示词");

    // 验证相同项目仍然被选中（通过data-id）
    await page.waitForFunction(
      (ids: readonly (string | null)[]) => {
        const selectedItems = document.querySelectorAll(
          ".prompt-card.is-selected",
        );
        const selectedIds = Array.from(selectedItems).map((item) =>
          item.getAttribute("data-id"),
        );
        return ids.every((id) => id !== null && selectedIds.includes(id));
      },
      [itemId1, itemId2] as const,
      { timeout: 1000 },
    );

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });
});

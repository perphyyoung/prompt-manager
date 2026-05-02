import { expect } from "@playwright/test";
import { Constants } from "../src/constants.ts";
import {
  enterImageGridView,
  enterPromptGridView,
  openImageDetail,
  openPromptDetail,
  test,
} from "./electron-test.ts";

test.describe("批量工具栏 - 图像详情界面功能测试", () => {
  // 共享的测试数据
  let sharedImageId: string;

  // 文件级别：创建基础测试数据
  test.beforeAll(async ({ electronTest }) => {
    const factory = electronTest.getApiFactory();

    // 创建测试图像（用于详情界面测试）
    const imageFactory = factory.createImageFactory();
    const images = await imageFactory.createBatch(1, "shared");
    sharedImageId = images[0].id;

    // 创建共享的测试标签并关联到图像
    const tagNames = await imageFactory.createTags(2, "shared");
    await electronTest.linkTagsToImage(sharedImageId, tagNames);

    // 刷新界面以显示新数据
    await electronTest.refreshData();
  });

  // 每个测试后使用快捷键切换到图像主界面，自动关闭可能打开的模态框
  test.afterEach(async ({ page }) => {
    // 使用快捷键切换到图像主界面（会自动关闭所有模态框）
    await page.keyboard.press("Control+i");
    await page.waitForSelector(`#${Constants.Ids.IMAGE_PANEL}`, {
      state: "visible",
      timeout: 1000,
    });
  });

  // ==================== 图像详情界面 - 全选按钮 ====================
  test("图像详情界面-全选按钮应该选中所有标签", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像网格视图并打开详情（标签已在 beforeAll 中关联）
    await enterImageGridView(page);
    await openImageDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector(`#${Constants.Ids.IMAGE_DETAIL_MODAL}.active`, {
      timeout: 1000,
    });

    // 点击批量按钮进入批量模式
    const batchBtn = page.locator(
      `#${Constants.Ids.IMAGE_DETAIL_BATCH_TAG_BTN}`,
    );
    await batchBtn.click();

    // 等待工具栏出现
    const toolbar = page.locator(
      `#${Constants.Ids.IMAGE_DETAIL_BATCH_TAG_TOOLBAR}`,
    );
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 点击"全选"按钮
    await toolbar.locator('[data-action="SelectAll"]').click();

    // 验证所有标签都被选中（至少有2个）
    await page.waitForFunction(
      () => {
        const tags = document.querySelectorAll(".tag-batch-selectable");
        const selectedTags = document.querySelectorAll(
          ".tag-batch-selectable.tag-selected",
        );
        return tags.length >= 2 && selectedTags.length === tags.length;
      },
      { timeout: 1000 },
    );

    // 验证计数显示正确
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 2 个标签");

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像详情界面 - 反选按钮 ====================
  test("图像详情界面-反选按钮应该反转选择状态", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像网格视图并打开详情（标签已在 beforeAll 中关联）
    await enterImageGridView(page);
    await openImageDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector(`#${Constants.Ids.IMAGE_DETAIL_MODAL}.active`, {
      timeout: 1000,
    });

    // 点击批量按钮进入批量模式
    const batchBtn = page.locator(
      `#${Constants.Ids.IMAGE_DETAIL_BATCH_TAG_BTN}`,
    );
    await batchBtn.click();

    // 等待工具栏出现
    const toolbar = page.locator(
      `#${Constants.Ids.IMAGE_DETAIL_BATCH_TAG_TOOLBAR}`,
    );
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 点击"全选"按钮
    await toolbar.locator('[data-action="SelectAll"]').click();
    await page.waitForFunction(
      () => {
        const tags = document.querySelectorAll(".tag-batch-selectable");
        const selectedTags = document.querySelectorAll(
          ".tag-batch-selectable.tag-selected",
        );
        return selectedTags.length === tags.length;
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
    expect(countText).toContain("已选择 0 个标签");

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像详情界面 - 删除按钮 ====================
  test("图像详情界面-删除按钮应该批量删除选中标签", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签
    const factory = electronTest.getApiFactory();
    const imageFactory = factory.createImageFactory();
    const testTagName = electronTest.generateE2ePrefixName("detail_delete");
    const otherTagName = electronTest.generateE2ePrefixName("other");
    await imageFactory.createTag(testTagName);
    await imageFactory.createTag(otherTagName);

    await electronTest.refreshData();

    // 进入图像网格视图并打开详情
    await enterImageGridView(page);
    await openImageDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector(`#${Constants.Ids.IMAGE_DETAIL_MODAL}.active`, {
      timeout: 1000,
    });

    // 在详情中添加测试标签和对照组标签
    const tagInput = page.locator(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`);
    await tagInput.click();
    await tagInput.fill(testTagName);
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (tagName: string) => {
        const tags = document.querySelectorAll(".tag-editable");
        return Array.from(tags).some(
          (tag) => tag.getAttribute("data-tag") === tagName,
        );
      },
      testTagName,
      { timeout: 1000 },
    );

    await tagInput.click();
    await tagInput.fill(otherTagName);
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (tagName: string) => {
        const tags = document.querySelectorAll(".tag-editable");
        return Array.from(tags).some(
          (tag) => tag.getAttribute("data-tag") === tagName,
        );
      },
      otherTagName,
      { timeout: 1000 },
    );

    // 点击批量按钮进入批量模式
    const batchBtn = page.locator(
      `#${Constants.Ids.IMAGE_DETAIL_BATCH_TAG_BTN}`,
    );
    await batchBtn.click();

    // 等待工具栏出现
    const toolbar = page.locator(
      `#${Constants.Ids.IMAGE_DETAIL_BATCH_TAG_TOOLBAR}`,
    );
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 只点击测试标签进行选择（不是全选）
    const testTagItem = page.locator(
      `.tag-editable[data-tag="${testTagName}"]`,
    );
    await testTagItem.click();

    // 验证只选中了测试标签
    await page.waitForFunction(
      (tagName: string) => {
        const selectedTags = document.querySelectorAll(
          ".tag-batch-selectable.tag-selected",
        );
        return (
          selectedTags.length === 1 &&
          selectedTags[0].getAttribute("data-tag") === tagName
        );
      },
      testTagName,
      { timeout: 1000 },
    );

    // 点击删除按钮
    await toolbar.locator('[data-action="Delete"]').click();

    // 验证确认对话框
    const confirmModal = page.locator(`#${Constants.Ids.CONFIRM_MODAL}`);
    await expect(confirmModal).toBeVisible({ timeout: 1000 });

    // 确认删除
    await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);
    await expect(confirmModal).toBeHidden({ timeout: 1000 });

    // PRD: 验证清空选择（选中数=0）- 等待计数更新
    await expect
      .poll(
        async () => {
          const text = await toolbar
            .locator(".batch-toolbar-count")
            .textContent();
          return text || "";
        },
        {
          message: "等待工具栏计数更新为 0",
          timeout: 3000,
          intervals: [100, 200, 300],
        },
      )
      .toContain("已选择 0 个标签");

    // PRD: 验证 Toast 提示 - 等待包含"已删除"的特定 Toast
    // 使用 expect.poll 等待 Toast 出现并包含预期文本
    const toastLocator = page.locator(
      '.toast-notification, .toast, [role="alert"]',
    );

    // 等待 Toast 出现并包含"已删除"文本（处理竞态条件）
    await expect
      .poll(
        async () => {
          const toastCount = await toastLocator.count();
          if (toastCount === 0) return "";

          const toast = toastLocator.first();
          const text = (await toast.textContent()) || "";
          return text;
        },
        {
          message: "等待 Toast 显示删除成功消息",
          timeout: 5000,
          intervals: [100, 200, 300, 500],
        },
      )
      .toMatch(/已删除 | 删除成功/);

    // 验证 Toast 文本
    const toastText = await toastLocator.first().textContent();
    expect(toastText).toMatch(/删除成功 | 已删除 | 成功/);

    // 验证测试标签已删除，对照组标签仍然存在
    await page.waitForFunction(
      (params: { testTag: string; otherTag: string }) => {
        const tags = document.querySelectorAll(".tag-editable");
        const tagNames = Array.from(tags).map((tag) =>
          tag.getAttribute("data-tag"),
        );
        return (
          !tagNames.includes(params.testTag) &&
          tagNames.includes(params.otherTag)
        );
      },
      { testTag: testTagName, otherTag: otherTagName },
      { timeout: 1000 },
    );
  });

  // ==================== 图像详情界面 - 单选（点击标签） ====================
  test("图像详情界面-点击标签应该单选", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 先进入图像标签管理器创建测试标签
    // 使用 API 工厂创建测试标签
    const factory = electronTest.getApiFactory();
    const imageFactory = factory.createImageFactory();
    const testTagName1 = electronTest.generateE2ePrefixName("detail_single_1");
    const testTagName2 = electronTest.generateE2ePrefixName("detail_single_2");
    await imageFactory.createTag(testTagName1);
    await imageFactory.createTag(testTagName2);

    await electronTest.refreshData();

    // 进入图像网格视图并打开详情
    await enterImageGridView(page);
    await openImageDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector(`#${Constants.Ids.IMAGE_DETAIL_MODAL}.active`, {
      timeout: 1000,
    });

    // 在详情中添加测试标签
    const tagInput = page.locator(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`);
    await tagInput.click();
    await tagInput.fill(testTagName1);
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (tagName: string) => {
        const tags = document.querySelectorAll(".tag-editable");
        return Array.from(tags).some(
          (tag) => tag.getAttribute("data-tag") === tagName,
        );
      },
      testTagName1,
      { timeout: 1000 },
    );

    await tagInput.click();
    await tagInput.fill(testTagName2);
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (tagName: string) => {
        const tags = document.querySelectorAll(".tag-editable");
        return Array.from(tags).some(
          (tag) => tag.getAttribute("data-tag") === tagName,
        );
      },
      testTagName2,
      { timeout: 1000 },
    );

    // 点击批量按钮进入批量模式
    const batchBtn = page.locator(
      `#${Constants.Ids.IMAGE_DETAIL_BATCH_TAG_BTN}`,
    );
    await batchBtn.click();

    // 等待工具栏出现
    const toolbar = page.locator(
      `#${Constants.Ids.IMAGE_DETAIL_BATCH_TAG_TOOLBAR}`,
    );
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 点击第一个标签进行选择
    const tag1 = page.locator(`.tag-editable[data-tag="${testTagName1}"]`);
    await tag1.click();

    // 验证只选中了第一个标签
    await page.waitForFunction(
      (tagName: string) => {
        const selectedTags = document.querySelectorAll(
          ".tag-batch-selectable.tag-selected",
        );
        return (
          selectedTags.length === 1 &&
          selectedTags[0].getAttribute("data-tag") === tagName
        );
      },
      testTagName1,
      { timeout: 1000 },
    );

    // 验证计数为1
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 1 个标签");

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像详情界面 - 多选（Ctrl+点击标签） ====================
  test("图像详情界面-Ctrl+点击标签应该多选", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签
    const factory = electronTest.getApiFactory();
    const imageFactory = factory.createImageFactory();
    const testTagName1 = electronTest.generateE2ePrefixName("detail_multi_1");
    const testTagName2 = electronTest.generateE2ePrefixName("detail_multi_2");
    await imageFactory.createTag(testTagName1);
    await imageFactory.createTag(testTagName2);

    await electronTest.refreshData();

    // 进入图像网格视图并打开详情
    await enterImageGridView(page);
    await openImageDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector(`#${Constants.Ids.IMAGE_DETAIL_MODAL}.active`, {
      timeout: 1000,
    });

    // 在详情中添加测试标签
    const tagInput = page.locator(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`);
    await tagInput.click();
    await tagInput.fill(testTagName1);
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (tagName: string) => {
        const tags = document.querySelectorAll(".tag-editable");
        return Array.from(tags).some(
          (tag) => tag.getAttribute("data-tag") === tagName,
        );
      },
      testTagName1,
      { timeout: 1000 },
    );

    await tagInput.click();
    await tagInput.fill(testTagName2);
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (tagName: string) => {
        const tags = document.querySelectorAll(".tag-editable");
        return Array.from(tags).some(
          (tag) => tag.getAttribute("data-tag") === tagName,
        );
      },
      testTagName2,
      { timeout: 1000 },
    );

    // 点击批量按钮进入批量模式
    const batchBtn = page.locator(
      `#${Constants.Ids.IMAGE_DETAIL_BATCH_TAG_BTN}`,
    );
    await batchBtn.click();

    // 等待工具栏出现
    const toolbar = page.locator(
      `#${Constants.Ids.IMAGE_DETAIL_BATCH_TAG_TOOLBAR}`,
    );
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // Ctrl+点击两个标签进行选择
    await page.keyboard.down("Control");
    const tag1 = page.locator(`.tag-editable[data-tag="${testTagName1}"]`);
    const tag2 = page.locator(`.tag-editable[data-tag="${testTagName2}"]`);
    await tag1.click();
    await tag2.click();
    await page.keyboard.up("Control");

    // 验证两个标签都被选中
    await page.waitForFunction(
      (names: string[]) => {
        const selectedTags = document.querySelectorAll(
          ".tag-batch-selectable.tag-selected",
        );
        const selectedNames = Array.from(selectedTags).map((tag) =>
          tag.getAttribute("data-tag"),
        );
        return names.every((name) => selectedNames.includes(name));
      },
      [testTagName1, testTagName2],
      { timeout: 1000 },
    );

    // 验证计数为2
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 2 个标签");

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像详情界面 - 取消按钮 ====================
  test("图像详情界面-取消按钮应该退出批量模式", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像网格视图并打开详情（标签已在 beforeAll 中关联）
    await enterImageGridView(page);
    await openImageDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector(`#${Constants.Ids.IMAGE_DETAIL_MODAL}.active`, {
      timeout: 1000,
    });

    // 点击批量按钮进入批量模式
    const batchBtn = page.locator(
      `#${Constants.Ids.IMAGE_DETAIL_BATCH_TAG_BTN}`,
    );
    await batchBtn.click();

    // 等待工具栏出现
    const toolbar = page.locator(
      `#${Constants.Ids.IMAGE_DETAIL_BATCH_TAG_TOOLBAR}`,
    );
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 点击"取消"按钮
    await toolbar.locator('[data-action="Cancel"]').click();

    // 验证工具栏隐藏
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像详情界面 - ESC键退出 ====================
  test("图像详情界面-ESC键应该退出批量模式", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 进入图像网格视图并打开详情（标签已在 beforeAll 中关联）
    await enterImageGridView(page);
    await openImageDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector(`#${Constants.Ids.IMAGE_DETAIL_MODAL}.active`, {
      timeout: 1000,
    });

    // 点击批量按钮进入批量模式
    const batchBtn = page.locator(
      `#${Constants.Ids.IMAGE_DETAIL_BATCH_TAG_BTN}`,
    );
    await batchBtn.click();

    // 等待工具栏出现
    const toolbar = page.locator(
      `#${Constants.Ids.IMAGE_DETAIL_BATCH_TAG_TOOLBAR}`,
    );
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 按下 ESC 键
    await page.keyboard.press("Escape");

    // 验证工具栏隐藏
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });
});

test.describe("批量工具栏 - 提示词详情界面功能测试", () => {
  // 共享的测试数据
  let sharedPromptId: string;

  // 文件级别：创建基础测试数据
  test.beforeAll(async ({ electronTest }) => {
    const factory = electronTest.getApiFactory();

    // 创建测试提示词（用于详情界面测试）
    const promptFactory = factory.createPromptFactory();
    const prompts = await promptFactory.createBatch(1, "shared");
    sharedPromptId = prompts[0].id;

    // 创建共享的测试标签并关联到提示词
    const tagNames = await promptFactory.createTags(2, "shared");
    await electronTest.linkTagsToPrompt(sharedPromptId, tagNames);

    // 刷新界面以显示新数据
    await electronTest.refreshData();
  });

  // 每个测试后使用快捷键切换到提示词主界面，自动关闭可能打开的模态框
  test.afterEach(async ({ page }) => {
    // 使用快捷键切换到提示词主界面（会自动关闭所有模态框）
    await page.keyboard.press("Control+p");
    await page.waitForSelector(`#${Constants.Ids.PROMPT_PANEL}`, {
      state: "visible",
      timeout: 1000,
    });
  });

  // ==================== 提示词详情界面 - 全选按钮 ====================
  test("提示词详情界面-全选按钮应该选中所有标签", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词网格视图并打开详情（标签已在 beforeAll 中关联）
    await enterPromptGridView(page);
    await openPromptDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector(`#${Constants.Ids.PROMPT_DETAIL_MODAL}.active`, {
      timeout: 1000,
    });

    // 点击批量按钮进入批量模式
    const batchBtn = page.locator(
      `#${Constants.Ids.PROMPT_DETAIL_BATCH_TAG_BTN}`,
    );
    await batchBtn.click();

    // 等待工具栏出现
    const toolbar = page.locator(
      `#${Constants.Ids.PROMPT_DETAIL_BATCH_TAG_TOOLBAR}`,
    );
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 点击"全选"按钮
    await toolbar.locator('[data-action="SelectAll"]').click();

    // 验证所有标签都被选中（至少有2个）
    await page.waitForFunction(
      () => {
        const tags = document.querySelectorAll(".tag-batch-selectable");
        const selectedTags = document.querySelectorAll(
          ".tag-batch-selectable.tag-selected",
        );
        return tags.length >= 2 && selectedTags.length === tags.length;
      },
      { timeout: 1000 },
    );

    // 验证计数显示正确
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 2 个标签");

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词详情界面 - 反选按钮 ====================
  test("提示词详情界面-反选按钮应该反转选择状态", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词网格视图并打开详情（标签已在 beforeAll 中关联）
    await enterPromptGridView(page);
    await openPromptDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector(`#${Constants.Ids.PROMPT_DETAIL_MODAL}.active`, {
      timeout: 1000,
    });

    // 点击批量按钮进入批量模式
    const batchBtn = page.locator(
      `#${Constants.Ids.PROMPT_DETAIL_BATCH_TAG_BTN}`,
    );
    await batchBtn.click();

    // 等待工具栏出现
    const toolbar = page.locator(
      `#${Constants.Ids.PROMPT_DETAIL_BATCH_TAG_TOOLBAR}`,
    );
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 点击"全选"按钮
    await toolbar.locator('[data-action="SelectAll"]').click();
    await page.waitForFunction(
      () => {
        const tags = document.querySelectorAll(".tag-batch-selectable");
        const selectedTags = document.querySelectorAll(
          ".tag-batch-selectable.tag-selected",
        );
        return selectedTags.length === tags.length;
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
    expect(countText).toContain("已选择 0 个标签");

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词详情界面 - 删除按钮 ====================
  test("提示词详情界面-删除按钮应该批量删除选中标签", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签
    const factory = electronTest.getApiFactory();
    const promptFactory = factory.createPromptFactory();
    const testTagName = electronTest.generateE2ePrefixName("detail_delete");
    const otherTagName = electronTest.generateE2ePrefixName("other");
    await promptFactory.createTag(testTagName);
    await promptFactory.createTag(otherTagName);

    await electronTest.refreshData();

    // 进入提示词网格视图并打开详情
    await enterPromptGridView(page);
    await openPromptDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector(`#${Constants.Ids.PROMPT_DETAIL_MODAL}.active`, {
      timeout: 1000,
    });

    // 在详情中添加测试标签和对照组标签
    const tagInput = page.locator(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`);
    await tagInput.click();
    await tagInput.fill(testTagName);
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (tagName: string) => {
        const tags = document.querySelectorAll(".tag-editable");
        return Array.from(tags).some(
          (tag) => tag.getAttribute("data-tag") === tagName,
        );
      },
      testTagName,
      { timeout: 1000 },
    );

    await tagInput.click();
    await tagInput.fill(otherTagName);
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (tagName: string) => {
        const tags = document.querySelectorAll(".tag-editable");
        return Array.from(tags).some(
          (tag) => tag.getAttribute("data-tag") === tagName,
        );
      },
      otherTagName,
      { timeout: 1000 },
    );

    // 点击批量按钮进入批量模式
    const batchBtn = page.locator(
      `#${Constants.Ids.PROMPT_DETAIL_BATCH_TAG_BTN}`,
    );
    await batchBtn.click();

    // 等待工具栏出现
    const toolbar = page.locator(
      `#${Constants.Ids.PROMPT_DETAIL_BATCH_TAG_TOOLBAR}`,
    );
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 只点击测试标签进行选择（不是全选）
    const testTagItem = page.locator(
      `.tag-editable[data-tag="${testTagName}"]`,
    );
    await testTagItem.click();

    await page.waitForFunction(
      (tagName: string) => {
        const selectedTags = document.querySelectorAll(
          ".tag-batch-selectable.tag-selected",
        );
        return (
          selectedTags.length === 1 &&
          selectedTags[0].getAttribute("data-tag") === tagName
        );
      },
      testTagName,
      { timeout: 1000 },
    );

    // 点击删除按钮
    await toolbar.locator('[data-action="Delete"]').click();

    // 验证确认对话框
    const confirmModal = page.locator(`#${Constants.Ids.CONFIRM_MODAL}`);
    await expect(confirmModal).toBeVisible({ timeout: 1000 });

    // 确认删除
    await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);
    await expect(confirmModal).toBeHidden({ timeout: 1000 });

    // PRD: 验证清空选择（选中数=0）- 等待计数更新
    await expect
      .poll(
        async () => {
          const text = await toolbar
            .locator(".batch-toolbar-count")
            .textContent();
          return text || "";
        },
        {
          message: "等待工具栏计数更新为 0",
          timeout: 3000,
          intervals: [100, 200, 300],
        },
      )
      .toContain("已选择 0 个标签");

    // PRD: 验证 Toast 提示 - 等待包含"已删除"的特定 Toast
    // 使用 expect.poll 等待 Toast 出现并包含预期文本
    const toastLocator = page.locator(
      '.toast-notification, .toast, [role="alert"]',
    );

    // 等待 Toast 出现并包含"已删除"文本（处理竞态条件）
    await expect
      .poll(
        async () => {
          const toastCount = await toastLocator.count();
          if (toastCount === 0) return "";

          const toast = toastLocator.first();
          const text = (await toast.textContent()) || "";
          return text;
        },
        {
          message: "等待 Toast 显示删除成功消息",
          timeout: 5000,
          intervals: [100, 200, 300, 500],
        },
      )
      .toMatch(/已删除 | 删除成功/);

    // 验证 Toast 文本
    const toastText = await toastLocator.first().textContent();
    expect(toastText).toMatch(/删除成功 | 已删除 | 成功/);

    // 验证测试标签已删除，对照组标签仍然存在
    const verifyResult = await page.evaluate(
      (params: { testTag: string; otherTag: string }) => {
        const tags = document.querySelectorAll(".tag-editable");
        const tagNames = Array.from(tags).map((tag) =>
          tag.getAttribute("data-tag"),
        );
        return {
          allTagNames: tagNames,
          testTagDeleted: !tagNames.includes(params.testTag),
          otherTagExists: tagNames.includes(params.otherTag),
        };
      },
      { testTag: testTagName, otherTag: otherTagName },
    );
    expect(verifyResult.testTagDeleted).toBe(true);
    expect(verifyResult.otherTagExists).toBe(true);
  });

  // ==================== 提示词详情界面 - 单选（点击标签） ====================
  test("提示词详情界面-点击标签应该单选", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签
    const factory = electronTest.getApiFactory();
    const promptFactory = factory.createPromptFactory();
    const testTagName1 = electronTest.generateE2ePrefixName("detail_single_1");
    const testTagName2 = electronTest.generateE2ePrefixName("detail_single_2");
    await promptFactory.createTag(testTagName1);
    await promptFactory.createTag(testTagName2);

    await electronTest.refreshData();

    // 进入提示词网格视图并打开详情
    await enterPromptGridView(page);
    await openPromptDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector(`#${Constants.Ids.PROMPT_DETAIL_MODAL}.active`, {
      timeout: 1000,
    });

    // 在详情中添加测试标签
    const tagInput = page.locator(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`);
    await tagInput.click();
    await tagInput.fill(testTagName1);
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (tagName: string) => {
        const tags = document.querySelectorAll(".tag-editable");
        return Array.from(tags).some(
          (tag) => tag.getAttribute("data-tag") === tagName,
        );
      },
      testTagName1,
      { timeout: 1000 },
    );

    await tagInput.click();
    await tagInput.fill(testTagName2);
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (tagName: string) => {
        const tags = document.querySelectorAll(".tag-editable");
        return Array.from(tags).some(
          (tag) => tag.getAttribute("data-tag") === tagName,
        );
      },
      testTagName2,
      { timeout: 1000 },
    );

    // 点击批量按钮进入批量模式
    const batchBtn = page.locator(
      `#${Constants.Ids.PROMPT_DETAIL_BATCH_TAG_BTN}`,
    );
    await batchBtn.click();

    // 等待工具栏出现
    const toolbar = page.locator(
      `#${Constants.Ids.PROMPT_DETAIL_BATCH_TAG_TOOLBAR}`,
    );
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 点击第一个标签进行选择
    const tag1 = page.locator(`.tag-editable[data-tag="${testTagName1}"]`);
    await tag1.click();

    // 验证只选中了第一个标签
    await page.waitForFunction(
      (tagName: string) => {
        const selectedTags = document.querySelectorAll(
          ".tag-batch-selectable.tag-selected",
        );
        return (
          selectedTags.length === 1 &&
          selectedTags[0].getAttribute("data-tag") === tagName
        );
      },
      testTagName1,
      { timeout: 1000 },
    );

    // 验证计数为1
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 1 个标签");

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词详情界面 - 多选（Ctrl+点击标签） ====================
  test("提示词详情界面-Ctrl+点击标签应该多选", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签
    const factory = electronTest.getApiFactory();
    const promptFactory = factory.createPromptFactory();
    const testTagName1 = electronTest.generateE2ePrefixName("detail_multi_1");
    const testTagName2 = electronTest.generateE2ePrefixName("detail_multi_2");
    await promptFactory.createTag(testTagName1);
    await promptFactory.createTag(testTagName2);

    await electronTest.refreshData();

    // 进入提示词网格视图并打开详情
    await enterPromptGridView(page);
    await openPromptDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector(`#${Constants.Ids.PROMPT_DETAIL_MODAL}.active`, {
      timeout: 1000,
    });

    // 在详情中添加测试标签
    const tagInput = page.locator(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`);
    await tagInput.click();
    await tagInput.fill(testTagName1);
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (tagName: string) => {
        const tags = document.querySelectorAll(".tag-editable");
        return Array.from(tags).some(
          (tag) => tag.getAttribute("data-tag") === tagName,
        );
      },
      testTagName1,
      { timeout: 1000 },
    );

    await tagInput.click();
    await tagInput.fill(testTagName2);
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (tagName: string) => {
        const tags = document.querySelectorAll(".tag-editable");
        return Array.from(tags).some(
          (tag) => tag.getAttribute("data-tag") === tagName,
        );
      },
      testTagName2,
      { timeout: 1000 },
    );

    // 点击批量按钮进入批量模式
    const batchBtn = page.locator(
      `#${Constants.Ids.PROMPT_DETAIL_BATCH_TAG_BTN}`,
    );
    await batchBtn.click();

    // 等待工具栏出现
    const toolbar = page.locator(
      `#${Constants.Ids.PROMPT_DETAIL_BATCH_TAG_TOOLBAR}`,
    );
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // Ctrl+点击两个标签进行选择
    await page.keyboard.down("Control");
    const tag1 = page.locator(`.tag-editable[data-tag="${testTagName1}"]`);
    const tag2 = page.locator(`.tag-editable[data-tag="${testTagName2}"]`);
    await tag1.click();
    await tag2.click();
    await page.keyboard.up("Control");

    // 验证两个标签都被选中
    await page.waitForFunction(
      (names: string[]) => {
        const selectedTags = document.querySelectorAll(
          ".tag-batch-selectable.tag-selected",
        );
        const selectedNames = Array.from(selectedTags).map((tag) =>
          tag.getAttribute("data-tag"),
        );
        return names.every((name) => selectedNames.includes(name));
      },
      [testTagName1, testTagName2],
      { timeout: 1000 },
    );

    // 验证计数为2
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 2 个标签");

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词详情界面 - 取消按钮 ====================
  test("提示词详情界面-取消按钮应该退出批量模式", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词网格视图并打开详情（标签已在 beforeAll 中关联）
    await enterPromptGridView(page);
    await openPromptDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector(`#${Constants.Ids.PROMPT_DETAIL_MODAL}.active`, {
      timeout: 1000,
    });

    // 点击批量按钮进入批量模式
    const batchBtn = page.locator(
      `#${Constants.Ids.PROMPT_DETAIL_BATCH_TAG_BTN}`,
    );
    await batchBtn.click();

    // 等待工具栏出现
    const toolbar = page.locator(
      `#${Constants.Ids.PROMPT_DETAIL_BATCH_TAG_TOOLBAR}`,
    );
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 点击"取消"按钮
    await toolbar.locator('[data-action="Cancel"]').click();

    // 验证工具栏隐藏
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词详情界面 - ESC键退出 ====================
  test("提示词详情界面-ESC键应该退出批量模式", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词网格视图并打开详情（标签已在 beforeAll 中关联）
    await enterPromptGridView(page);
    await openPromptDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector(`#${Constants.Ids.PROMPT_DETAIL_MODAL}.active`, {
      timeout: 1000,
    });

    // 点击批量按钮进入批量模式
    const batchBtn = page.locator(
      `#${Constants.Ids.PROMPT_DETAIL_BATCH_TAG_BTN}`,
    );
    await batchBtn.click();

    // 等待工具栏出现
    const toolbar = page.locator(
      `#${Constants.Ids.PROMPT_DETAIL_BATCH_TAG_TOOLBAR}`,
    );
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 按下 ESC 键
    await page.keyboard.press("Escape");

    // 验证工具栏隐藏
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });
});

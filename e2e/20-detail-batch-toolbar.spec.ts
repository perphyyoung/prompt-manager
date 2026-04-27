import { expect } from "@playwright/test";
import {
  test,
  createImageTagsInManagerBatch,
  createPromptTagsInManagerBatch,
  enterImageGridView,
  enterPromptGridView,
  enterImageTagManager,
  enterPromptTagManager,
  openImageDetail,
  openPromptDetail,
} from "./electron-test.ts";
import { Constants } from "../src/constants.ts";

test.describe("批量工具栏 - 详情界面功能测试", () => {
  // ==================== 图像详情界面 - 全选按钮 ====================
  test("图像详情界面-全选按钮应该选中所有标签", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像网格视图并打开详情
    await enterImageGridView(page);
    await openImageDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector("#imageDetailModal.active", { timeout: 1000 });

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

    // 验证所有标签都被选中
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

    // 进入图像网格视图并打开详情
    await enterImageGridView(page);
    await openImageDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector("#imageDetailModal.active", { timeout: 1000 });

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

    // 先进入图像标签管理器创建测试标签
    await enterImageTagManager(page);

    // 创建1个测试标签和1个对照组标签
    const testTagName = electronTest.generateE2ePrefixName("detail_delete");
    const otherTagName = electronTest.generateE2ePrefixName("other");
    await createImageTagsInManagerBatch(page, [testTagName, otherTagName]);

    // 关闭标签管理器，返回主界面
    await page.click(`#${Constants.Ids.CLOSE_IMAGE_TAG_MANAGER_MODAL}`);
    await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_MANAGER_MODAL}`, {
      state: "hidden",
      timeout: 1000,
    });

    // 进入图像网格视图并打开详情
    await enterImageGridView(page);
    await openImageDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector("#imageDetailModal.active", { timeout: 1000 });

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

    // PRD: 验证清空选择（选中数=0）
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 0 个标签");

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

    // 确保模态框已关闭（如果删除导致模态框关闭，则等待其关闭；否则手动关闭）
    const modalLocator = page.locator("#imageDetailModal");
    if (await modalLocator.isVisible()) {
      await page.keyboard.press("Escape");
      await expect(modalLocator).toBeHidden({ timeout: 1000 });
    }

    // 手动清理测试数据：删除图像测试标签
    await electronTest.cleanupImageTagsAndGroups();
  });

  // ==================== 图像详情界面 - 单选（点击标签） ====================
  test("图像详情界面-点击标签应该单选", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 先进入图像标签管理器创建测试标签
    await enterImageTagManager(page);

    // 创建2个测试标签
    const testTagName1 = electronTest.generateE2ePrefixName("detail_single_1");
    const testTagName2 = electronTest.generateE2ePrefixName("detail_single_2");
    await createImageTagsInManagerBatch(page, [testTagName1, testTagName2]);

    // 关闭标签管理器，返回主界面
    await page.click(`#${Constants.Ids.CLOSE_IMAGE_TAG_MANAGER_MODAL}`);
    await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_MANAGER_MODAL}`, {
      state: "hidden",
      timeout: 1000,
    });

    // 进入图像网格视图并打开详情
    await enterImageGridView(page);
    await openImageDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector("#imageDetailModal.active", { timeout: 1000 });

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

    // 手动清理测试数据：删除图像测试标签
    await electronTest.cleanupImageTagsAndGroups();
  });

  // ==================== 图像详情界面 - 多选（Ctrl+点击标签） ====================
  test("图像详情界面-Ctrl+点击标签应该多选", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 先进入图像标签管理器创建测试标签
    await enterImageTagManager(page);

    // 创建2个测试标签
    const testTagName1 = electronTest.generateE2ePrefixName("detail_multi_1");
    const testTagName2 = electronTest.generateE2ePrefixName("detail_multi_2");
    await createImageTagsInManagerBatch(page, [testTagName1, testTagName2]);

    // 关闭标签管理器，返回主界面
    await page.click(`#${Constants.Ids.CLOSE_IMAGE_TAG_MANAGER_MODAL}`);
    await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_MANAGER_MODAL}`, {
      state: "hidden",
      timeout: 1000,
    });

    // 进入图像网格视图并打开详情
    await enterImageGridView(page);
    await openImageDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector("#imageDetailModal.active", { timeout: 1000 });

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

    // 手动清理测试数据：删除图像测试标签
    await electronTest.cleanupImageTagsAndGroups();
  });

  // ==================== 图像详情界面 - 取消按钮 ====================
  test("图像详情界面-取消按钮应该退出批量模式", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像网格视图并打开详情
    await enterImageGridView(page);
    await openImageDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector("#imageDetailModal.active", { timeout: 1000 });

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

    // 进入图像网格视图并打开详情
    await enterImageGridView(page);
    await openImageDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector("#imageDetailModal.active", { timeout: 1000 });

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

  // ==================== 提示词详情界面 - 全选按钮 ====================
  test("提示词详情界面-全选按钮应该选中所有标签", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词网格视图并打开详情
    await enterPromptGridView(page);
    await openPromptDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector("#promptDetailModal.active", { timeout: 1000 });

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

    // 验证所有标签都被选中
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

    // 进入提示词网格视图并打开详情
    await enterPromptGridView(page);
    await openPromptDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector("#promptDetailModal.active", { timeout: 1000 });

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

    // 先进入提示词标签管理器创建测试标签
    await enterPromptTagManager(page);

    // 创建2个测试标签和1个对照组标签
    const testTagName = electronTest.generateE2ePrefixName("detail_delete");
    const otherTagName = electronTest.generateE2ePrefixName("other");
    await createPromptTagsInManagerBatch(page, [testTagName, otherTagName]);

    // 关闭标签管理器，返回主界面
    await page.click(`#${Constants.Ids.CLOSE_PROMPT_TAG_MANAGER_MODAL}`);
    await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_MANAGER_MODAL}`, {
      state: "hidden",
      timeout: 1000,
    });

    // 进入提示词网格视图并打开详情
    await enterPromptGridView(page);
    await openPromptDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector("#promptDetailModal.active", { timeout: 1000 });

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

    // PRD: 验证清空选择（选中数=0）
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 0 个标签");

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

    // 手动清理测试数据：删除提示词测试标签
    await electronTest.cleanupPromptTagsAndGroups();
  });

  // ==================== 提示词详情界面 - 单选（点击标签） ====================
  test("提示词详情界面-点击标签应该单选", async ({ electronTest, page }) => {
    await electronTest.logTestStart();

    // 先进入提示词标签管理器创建测试标签
    await enterPromptTagManager(page);

    // 创建2个测试标签
    const testTagName1 = electronTest.generateE2ePrefixName("detail_single_1");
    const testTagName2 = electronTest.generateE2ePrefixName("detail_single_2");
    await createPromptTagsInManagerBatch(page, [testTagName1, testTagName2]);

    // 关闭标签管理器，返回主界面
    await page.click(`#${Constants.Ids.CLOSE_PROMPT_TAG_MANAGER_MODAL}`);
    await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_MANAGER_MODAL}`, {
      state: "hidden",
      timeout: 1000,
    });

    // 进入提示词网格视图并打开详情
    await enterPromptGridView(page);
    await openPromptDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector("#promptDetailModal.active", { timeout: 1000 });

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

    // 手动清理测试数据：删除提示词测试标签
    await electronTest.cleanupPromptTagsAndGroups();
  });

  // ==================== 提示词详情界面 - 多选（Ctrl+点击标签） ====================
  test("提示词详情界面-Ctrl+点击标签应该多选", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 先进入提示词标签管理器创建测试标签
    await enterPromptTagManager(page);

    // 创建2个测试标签
    const testTagName1 = electronTest.generateE2ePrefixName("detail_multi_1");
    const testTagName2 = electronTest.generateE2ePrefixName("detail_multi_2");
    await createPromptTagsInManagerBatch(page, [testTagName1, testTagName2]);

    // 关闭标签管理器，返回主界面
    await page.click(`#${Constants.Ids.CLOSE_PROMPT_TAG_MANAGER_MODAL}`);
    await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_MANAGER_MODAL}`, {
      state: "hidden",
      timeout: 1000,
    });

    // 进入提示词网格视图并打开详情
    await enterPromptGridView(page);
    await openPromptDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector("#promptDetailModal.active", { timeout: 1000 });

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

    // 手动清理测试数据：删除提示词测试标签
    await electronTest.cleanupPromptTagsAndGroups();
  });

  // ==================== 提示词详情界面 - 取消按钮 ====================
  test("提示词详情界面-取消按钮应该退出批量模式", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词网格视图并打开详情
    await enterPromptGridView(page);
    await openPromptDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector("#promptDetailModal.active", { timeout: 1000 });

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

    // 进入提示词网格视图并打开详情
    await enterPromptGridView(page);
    await openPromptDetail(page);

    // 等待详情模态框打开
    await page.waitForSelector("#promptDetailModal.active", { timeout: 1000 });

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

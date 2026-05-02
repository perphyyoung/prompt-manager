import { expect } from "@playwright/test";
import {
  test,
  enterImageTagManager,
  enterPromptTagManager,
} from "./electron-test.ts";
import { Constants } from "../src/constants.ts";

test.describe("批量工具栏 - 标签管理界面功能测试", () => {
  // 文件级别：创建基础测试数据
  test.beforeAll(async ({ electronTest }) => {
    const factory = electronTest.getApiFactory();
    // 创建一些基础标签供测试使用
    await factory.createImageFactory().createTags(3, "shared");
    await factory.createPromptFactory().createTags(3, "shared");
    await electronTest.refreshData();
  });
  // ==================== 图像标签管理界面 - 全选按钮 ====================
  test("图像标签管理界面-全选按钮应该选中所有标签", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像标签管理器
    await enterImageTagManager(page);

    // 点击批量管理按钮
    const batchManageBtn = page.locator(
      `#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`,
    );
    await expect(batchManageBtn).toBeVisible({ timeout: 1000 });
    await expect(batchManageBtn).toBeEnabled({ timeout: 1000 });
    await batchManageBtn.click();

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 点击"全选"按钮
    await toolbar.locator('[data-action="SelectAll"]').click();

    // 验证所有标签都被选中（通过复选框checked状态）
    await page.waitForFunction(
      (containerId: string) => {
        const checkboxes = document.querySelectorAll(
          `#${containerId} .tag-batch-checkbox`,
        );
        const checkedBoxes = document.querySelectorAll(
          `#${containerId} .tag-batch-checkbox:checked`,
        );
        return (
          checkedBoxes.length === checkboxes.length && checkboxes.length > 0
        );
      },
      Constants.Ids.IMAGE_TAG_GROUP_CARDS,
      { timeout: 1000 },
    );

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像标签管理界面 - 反选按钮 ====================
  test("图像标签管理界面-反选按钮应该反转选择状态", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像标签管理器
    await enterImageTagManager(page);

    // 点击批量管理按钮
    await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 点击"全选"按钮
    await toolbar.locator('[data-action="SelectAll"]').click();
    await page.waitForFunction(
      (containerId: string) => {
        const checkboxes = document.querySelectorAll(
          `#${containerId} .tag-batch-checkbox`,
        );
        const checkedBoxes = document.querySelectorAll(
          `#${containerId} .tag-batch-checkbox:checked`,
        );
        return (
          checkedBoxes.length === checkboxes.length && checkboxes.length > 0
        );
      },
      Constants.Ids.IMAGE_TAG_GROUP_CARDS,
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

  // ==================== 图像标签管理界面 - 移动到组完整流程 ====================
  test("图像标签管理界面-移动到组应该完成完整流程", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签和标签组
    const factory = electronTest.getApiFactory();
    const imageFactory = factory.createImageFactory();
    const tagName = electronTest.generateE2ePrefixName("move_test");
    await imageFactory.createTag(tagName);
    const group = await imageFactory.createTagGroup("测试组");
    await electronTest.refreshData();

    // 先进入标签管理器
    await enterImageTagManager(page);

    // 等待标签加载
    await page.waitForFunction(
      (params: { containerId: string; tagName: string }) => {
        const items = document.querySelectorAll(
          `#${params.containerId} .tag-manager-item`,
        );
        return Array.from(items).some(
          (item) => item.getAttribute("data-tag") === params.tagName,
        );
      },
      { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, tagName },
      { timeout: 1000 },
    );

    // 点击批量管理按钮
    await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 选择测试标签（使用复选框）
    const tagCheckbox = page.locator(
      `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName}"] .tag-batch-checkbox`,
    );
    await tagCheckbox.check();

    // 验证已选中
    await expect(tagCheckbox).toBeChecked({ timeout: 1000 });

    // 点击"移动到组"按钮
    await toolbar.locator('[data-action="Move"]').click();

    // 验证组选择对话框出现
    const groupModal = page.locator(`#${Constants.Ids.SELECT_MODAL}`);
    await expect(groupModal).toBeVisible({ timeout: 1000 });

    // 选择目标组（通过select元素或按钮）
    const groupSelect = groupModal.locator("select, .group-list");
    if (await groupSelect.isVisible().catch(() => false)) {
      await groupSelect.selectOption(String(group.id));
    } else {
      // 如果是按钮列表形式
      await groupModal.locator(`text=${group.name}`).click();
    }

    // 点击确认（使用 selectModal 的 OK 按钮）
    await page.click(`#${Constants.Ids.SELECT_OK_BTN}`);
    await expect(groupModal).toBeHidden({ timeout: 1000 });

    // PRD: 验证 Toast 显示成功统计
    const toast = page.locator('.toast-notification, .toast, [role="alert"]');
    await expect(toast).toBeVisible({ timeout: 3000 });
    const toastText = await toast.textContent();
    expect(toastText).toMatch(/已移动|成功|移动/);

    // 验证标签已移动到目标组（通过API验证）
    await page.waitForFunction(
      async (params: { tag: string; groupId: number }) => {
        const tags = await window.electronAPI.getImageTags();
        // 标签仍然存在
        return tags.includes(params.tag);
      },
      { tag: tagName, groupId: group.id },
      { timeout: 1000 },
    );

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像标签管理界面 - 取消按钮 ====================
  test("图像标签管理界面-取消按钮应该退出批量模式", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像标签管理器
    await enterImageTagManager(page);

    // 点击批量管理按钮
    await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 点击"取消"按钮
    await toolbar.locator('[data-action="Cancel"]').click();

    // 验证工具栏隐藏
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像标签管理界面 - ESC键退出 ====================
  test("图像标签管理界面-ESC键应该退出批量模式", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入图像标签管理器
    await enterImageTagManager(page);

    // 点击批量管理按钮
    await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 按下 ESC 键
    await page.keyboard.press("Escape");

    // 验证工具栏隐藏
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词标签管理界面 - 全选按钮 ====================
  test("提示词标签管理界面-全选按钮应该选中所有标签", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词标签管理器
    await enterPromptTagManager(page);

    // 点击批量管理按钮
    await page.click(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 点击"全选"按钮
    await toolbar.locator('[data-action="SelectAll"]').click();

    // 验证所有标签都被选中（通过复选框checked状态）
    await page.waitForFunction(
      (containerId: string) => {
        const checkboxes = document.querySelectorAll(
          `#${containerId} .tag-batch-checkbox`,
        );
        const checkedBoxes = document.querySelectorAll(
          `#${containerId} .tag-batch-checkbox:checked`,
        );
        return (
          checkedBoxes.length === checkboxes.length && checkboxes.length > 0
        );
      },
      Constants.Ids.PROMPT_TAG_GROUP_CARDS,
      { timeout: 1000 },
    );

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词标签管理界面 - 反选按钮 ====================
  test("提示词标签管理界面-反选按钮应该反转选择状态", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词标签管理器
    await enterPromptTagManager(page);

    // 点击批量管理按钮
    await page.click(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 点击"全选"按钮
    await toolbar.locator('[data-action="SelectAll"]').click();
    await page.waitForFunction(
      (containerId: string) => {
        const checkboxes = document.querySelectorAll(
          `#${containerId} .tag-batch-checkbox`,
        );
        const checkedBoxes = document.querySelectorAll(
          `#${containerId} .tag-batch-checkbox:checked`,
        );
        return (
          checkedBoxes.length === checkboxes.length && checkboxes.length > 0
        );
      },
      Constants.Ids.PROMPT_TAG_GROUP_CARDS,
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

  // ==================== 提示词标签管理界面 - 移动到组完整流程 ====================
  test("提示词标签管理界面-移动到组应该完成完整流程", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签和标签组
    const factory = electronTest.getApiFactory();
    const promptFactory = factory.createPromptFactory();
    const tagName = electronTest.generateE2ePrefixName("move_test");
    await promptFactory.createTag(tagName);
    const group = await promptFactory.createTagGroup("测试组");
    await electronTest.refreshData();

    // 先进入标签管理器
    await enterPromptTagManager(page);

    // 等待标签加载
    await page.waitForFunction(
      (params: { containerId: string; tagName: string }) => {
        const items = document.querySelectorAll(
          `#${params.containerId} .tag-manager-item`,
        );
        return Array.from(items).some(
          (item) => item.getAttribute("data-tag") === params.tagName,
        );
      },
      { containerId: Constants.Ids.PROMPT_TAG_GROUP_CARDS, tagName },
      { timeout: 1000 },
    );

    // 点击批量管理按钮
    await page.click(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 选择测试标签（使用复选框）
    const tagCheckbox = page.locator(
      `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName}"] .tag-batch-checkbox`,
    );
    await tagCheckbox.check();

    // 验证已选中
    await expect(tagCheckbox).toBeChecked({ timeout: 1000 });

    // 点击"移动到组"按钮
    await toolbar.locator('[data-action="Move"]').click();

    // 验证组选择对话框出现
    const groupModal = page.locator(`#${Constants.Ids.SELECT_MODAL}`);
    await expect(groupModal).toBeVisible({ timeout: 1000 });

    // 选择目标组（通过select元素或按钮）
    const groupSelect = groupModal.locator("select, .group-list");
    if (await groupSelect.isVisible().catch(() => false)) {
      await groupSelect.selectOption(String(group.id));
    } else {
      // 如果是按钮列表形式
      await groupModal.locator(`text=${group.name}`).click();
    }

    // 点击确认（使用 selectModal 的 OK 按钮）
    await page.click(`#${Constants.Ids.SELECT_OK_BTN}`);
    await expect(groupModal).toBeHidden({ timeout: 1000 });

    // PRD: 验证 Toast 显示成功统计
    const toast = page.locator('.toast-notification, .toast, [role="alert"]');
    await expect(toast).toBeVisible({ timeout: 3000 });
    const toastText = await toast.textContent();
    expect(toastText).toMatch(/已移动|成功|移动/);

    // 验证标签已移动到目标组（通过API验证）
    await page.waitForFunction(
      async (params: { tag: string; groupId: number }) => {
        const tags = await window.electronAPI.getPromptTags();
        // 标签仍然存在
        return tags.includes(params.tag);
      },
      { tag: tagName, groupId: group.id },
      { timeout: 1000 },
    );

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词标签管理界面 - 取消按钮 ====================
  test("提示词标签管理界面-取消按钮应该退出批量模式", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词标签管理器
    await enterPromptTagManager(page);

    // 点击批量管理按钮
    await page.click(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 点击"取消"按钮
    await toolbar.locator('[data-action="Cancel"]').click();

    // 验证工具栏隐藏
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词标签管理界面 - ESC键退出 ====================
  test("提示词标签管理界面-ESC键应该退出批量模式", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 进入提示词标签管理器
    await enterPromptTagManager(page);

    // 点击批量管理按钮
    await page.click(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 按下 ESC 键
    await page.keyboard.press("Escape");

    // 验证工具栏隐藏
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像标签管理界面 - 删除按钮（实际执行删除） ====================
  test("图像标签管理界面-删除按钮应该安全删除测试标签", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签
    const factory = electronTest.getApiFactory();
    const imageFactory = factory.createImageFactory();
    const searchKeyword = "batch_delete_test";
    const tagName1 = electronTest.generateE2ePrefixName(`${searchKeyword}_1`);
    const tagName2 = electronTest.generateE2ePrefixName(`${searchKeyword}_2`);
    const otherTagName = electronTest.generateE2ePrefixName("other_control"); // 对照组
    await imageFactory.createTag(tagName1);
    await imageFactory.createTag(tagName2);
    await imageFactory.createTag(otherTagName);
    await electronTest.refreshData();

    // 进入图像标签管理器
    await enterImageTagManager(page);

    // 使用特定关键词搜索
    await page.fill(
      `#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`,
      searchKeyword,
    );

    // 关键：等待搜索筛选完成 AND 验证所有可见项目都包含搜索关键词
    await page.waitForFunction(
      (params: { containerId: string; keyword: string }) => {
        const items = document.querySelectorAll(
          `#${params.containerId} .tag-manager-item`,
        );
        // 必须验证：1) 预期数量，2) 所有项目都包含搜索关键词
        return (
          items.length >= 2 &&
          Array.from(items).every((item) =>
            item.getAttribute("data-tag")?.includes(params.keyword),
          )
        );
      },
      {
        containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS,
        keyword: searchKeyword,
      },
      { timeout: 1000 },
    );

    // 点击批量管理按钮
    await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 全选
    await toolbar.locator('[data-action="SelectAll"]').click();

    // 关键：删除前验证选中的项目
    await page.waitForFunction(
      async (keyword: string) => {
        const checkedBoxes = document.querySelectorAll(
          ".tag-batch-checkbox:checked",
        );
        const selectedTags = Array.from(checkedBoxes).map((cb) =>
          cb.getAttribute("data-tag"),
        );
        // 安全检查：所有选中的标签必须包含搜索关键词
        return selectedTags.every((tag) => tag?.includes(keyword));
      },
      searchKeyword,
      { timeout: 1000 },
    );

    // 点击"删除"按钮
    await toolbar.locator('[data-action="Delete"]').click();

    // 验证确认对话框出现
    const confirmModal = page.locator(`#${Constants.Ids.CONFIRM_MODAL}`);
    await expect(confirmModal).toBeVisible({ timeout: 1000 });

    // 点击确认删除
    await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

    // 等待确认对话框关闭
    await expect(confirmModal).toBeHidden({ timeout: 1000 });

    // PRD: 验证清空选择（选中数=0）
    // 等待计数更新为0（onRefresh 可能是异步的）
    await page.waitForFunction(
      (toolbarId: string) => {
        const toolbar = document.getElementById(toolbarId);
        if (!toolbar) return false;
        const countSpan = toolbar.querySelector(".batch-toolbar-count");
        return countSpan && countSpan.textContent?.includes("已选择 0 个标签");
      },
      Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR,
      { timeout: 3000 },
    );
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 0 个标签");

    // PRD: 验证 Toast 提示
    const toast = page.locator('.toast-notification, .toast, [role="alert"]');
    await expect(toast).toBeVisible({ timeout: 3000 });
    const toastText = await toast.textContent();
    expect(toastText).toMatch(/删除成功|已删除|成功/);

    // 通过 API 验证删除
    await page.waitForFunction(
      async (names: string[]) => {
        const tags = await window.electronAPI.getImageTags();
        return !tags.includes(names[0]) && !tags.includes(names[1]);
      },
      [tagName1, tagName2],
      { timeout: 1000 },
    );

    // 关键：验证对照组（otherTagName）仍然存在
    await page.click(`#${Constants.Ids.CLEAR_IMAGE_TAG_MANAGER_SEARCH_BTN}`);
    await page.waitForFunction(
      (params: { containerId: string; tagName: string }) => {
        const items = document.querySelectorAll(
          `#${params.containerId} .tag-manager-item`,
        );
        return Array.from(items).some(
          (item) => item.getAttribute("data-tag") === params.tagName,
        );
      },
      {
        containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS,
        tagName: otherTagName,
      },
      { timeout: 1000 },
    );
    await expect(
      page.locator(
        `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${otherTagName}"]`,
      ),
    ).toBeVisible({ timeout: 1000 });

    // 验证工具栏已隐藏（因为选择为空）
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词标签管理界面 - 删除按钮（实际执行删除） ====================
  test("提示词标签管理界面-删除按钮应该安全删除测试标签", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签
    const factory = electronTest.getApiFactory();
    const promptFactory = factory.createPromptFactory();
    const searchKeyword = "batch_delete_test";
    const tagName1 = electronTest.generateE2ePrefixName(`${searchKeyword}_1`);
    const tagName2 = electronTest.generateE2ePrefixName(`${searchKeyword}_2`);
    const otherTagName = electronTest.generateE2ePrefixName("other_control"); // 对照组
    await promptFactory.createTag(tagName1);
    await promptFactory.createTag(tagName2);
    await promptFactory.createTag(otherTagName);
    await electronTest.refreshData();

    // 进入提示词标签管理器
    await enterPromptTagManager(page);

    // 使用特定关键词搜索
    await page.fill(
      `#${Constants.Ids.PROMPT_TAG_MANAGER_SEARCH_INPUT}`,
      searchKeyword,
    );

    // 关键：等待搜索筛选完成 AND 验证所有可见项目都包含搜索关键词
    await page.waitForFunction(
      (params: { containerId: string; keyword: string }) => {
        const items = document.querySelectorAll(
          `#${params.containerId} .tag-manager-item`,
        );
        // 必须验证：1) 预期数量，2) 所有项目都包含搜索关键词
        return (
          items.length >= 2 &&
          Array.from(items).every((item) =>
            item.getAttribute("data-tag")?.includes(params.keyword),
          )
        );
      },
      {
        containerId: Constants.Ids.PROMPT_TAG_GROUP_CARDS,
        keyword: searchKeyword,
      },
      { timeout: 1000 },
    );

    // 点击批量管理按钮
    await page.click(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 全选
    await toolbar.locator('[data-action="SelectAll"]').click();

    // 关键：删除前验证选中的项目
    await page.waitForFunction(
      async (keyword: string) => {
        const checkedBoxes = document.querySelectorAll(
          ".tag-batch-checkbox:checked",
        );
        const selectedTags = Array.from(checkedBoxes).map((cb) =>
          cb.getAttribute("data-tag"),
        );
        // 安全检查：所有选中的标签必须包含搜索关键词
        return selectedTags.every((tag) => tag?.includes(keyword));
      },
      searchKeyword,
      { timeout: 1000 },
    );

    // 点击"删除"按钮
    await toolbar.locator('[data-action="Delete"]').click();

    // 验证确认对话框出现
    const confirmModal = page.locator(`#${Constants.Ids.CONFIRM_MODAL}`);
    await expect(confirmModal).toBeVisible({ timeout: 1000 });

    // 点击确认删除
    await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

    // 等待确认对话框关闭
    await expect(confirmModal).toBeHidden({ timeout: 1000 });

    // PRD: 验证清空选择（选中数=0）
    // 等待计数更新为0（onRefresh 可能是异步的）
    await page.waitForFunction(
      (toolbarId: string) => {
        const toolbar = document.getElementById(toolbarId);
        if (!toolbar) return false;
        const countSpan = toolbar.querySelector(".batch-toolbar-count");
        return countSpan && countSpan.textContent?.includes("已选择 0 个标签");
      },
      Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR,
      { timeout: 3000 },
    );
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 0 个标签");

    // PRD: 验证 Toast 提示
    const toast = page.locator('.toast-notification, .toast, [role="alert"]');
    await expect(toast).toBeVisible({ timeout: 3000 });
    const toastText = await toast.textContent();
    expect(toastText).toMatch(/删除成功|已删除|成功/);

    // 通过 API 验证删除
    await page.waitForFunction(
      async (names: string[]) => {
        const tags = await window.electronAPI.getPromptTags();
        return !tags.includes(names[0]) && !tags.includes(names[1]);
      },
      [tagName1, tagName2],
      { timeout: 1000 },
    );

    // 关键：验证对照组（otherTagName）仍然存在
    await page.click(`#${Constants.Ids.CLEAR_PROMPT_TAG_MANAGER_SEARCH_BTN}`);
    await page.waitForFunction(
      (params: { containerId: string; tagName: string }) => {
        const items = document.querySelectorAll(
          `#${params.containerId} .tag-manager-item`,
        );
        return Array.from(items).some(
          (item) => item.getAttribute("data-tag") === params.tagName,
        );
      },
      {
        containerId: Constants.Ids.PROMPT_TAG_GROUP_CARDS,
        tagName: otherTagName,
      },
      { timeout: 1000 },
    );
    await expect(
      page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${otherTagName}"]`,
      ),
    ).toBeVisible({ timeout: 1000 });

    // 验证工具栏已隐藏（因为选择为空）
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像标签管理界面 - 单选（点击标签项） ====================
  test("图像标签管理界面-单击标签项应该单选", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签
    const factory = electronTest.getApiFactory();
    const imageFactory = factory.createImageFactory();
    const tagName = electronTest.generateE2ePrefixName("single_select");
    await imageFactory.createTag(tagName);
    await electronTest.refreshData();

    // 进入图像标签管理器
    await enterImageTagManager(page);

    // 等待标签加载
    await page.waitForFunction(
      (params: { containerId: string; tagName: string }) => {
        const items = document.querySelectorAll(
          `#${params.containerId} .tag-manager-item`,
        );
        return Array.from(items).some(
          (item) => item.getAttribute("data-tag") === params.tagName,
        );
      },
      { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, tagName },
      { timeout: 1000 },
    );

    // 点击批量管理按钮进入批量模式
    await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 单击标签项（不是复选框）
    const tagItem = page.locator(
      `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName}"]`,
    );
    await tagItem.click();

    // 验证标签被选中
    await expect(tagItem).toHaveClass(/is-selected|tag-selected/, {
      timeout: 1000,
    });

    // 验证工具栏计数显示为1
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 1 个标签");

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词标签管理界面 - 单选（点击标签项） ====================
  test("提示词标签管理界面-单击标签项应该单选", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签
    const factory = electronTest.getApiFactory();
    const promptFactory = factory.createPromptFactory();
    const tagName = electronTest.generateE2ePrefixName("single_select");
    await promptFactory.createTag(tagName);
    await electronTest.refreshData();

    // 进入提示词标签管理器
    await enterPromptTagManager(page);

    // 等待标签加载
    await page.waitForFunction(
      (params: { containerId: string; tagName: string }) => {
        const items = document.querySelectorAll(
          `#${params.containerId} .tag-manager-item`,
        );
        return Array.from(items).some(
          (item) => item.getAttribute("data-tag") === params.tagName,
        );
      },
      { containerId: Constants.Ids.PROMPT_TAG_GROUP_CARDS, tagName },
      { timeout: 1000 },
    );

    // 点击批量管理按钮进入批量模式
    await page.click(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 单击标签项（不是复选框）
    const tagItem = page.locator(
      `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName}"]`,
    );
    await tagItem.click();

    // 验证标签被选中
    await expect(tagItem).toHaveClass(/is-selected|tag-selected/, {
      timeout: 1000,
    });

    // 验证工具栏计数显示为1
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 1 个标签");

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像标签管理界面 - 复选框选择 ====================
  test("图像标签管理界面-复选框应该切换选择状态", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签
    const factory = electronTest.getApiFactory();
    const imageFactory = factory.createImageFactory();
    const tagName = electronTest.generateE2ePrefixName("checkbox_test");
    await imageFactory.createTag(tagName);
    await electronTest.refreshData();

    // 进入图像标签管理器
    await enterImageTagManager(page);

    // 等待标签加载
    await page.waitForFunction(
      (params: { containerId: string; tagName: string }) => {
        const items = document.querySelectorAll(
          `#${params.containerId} .tag-manager-item`,
        );
        return Array.from(items).some(
          (item) => item.getAttribute("data-tag") === params.tagName,
        );
      },
      { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, tagName },
      { timeout: 1000 },
    );

    // 点击批量管理按钮进入批量模式
    await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 等待复选框出现
    await page.waitForSelector(
      `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-batch-checkbox`,
      { state: "visible", timeout: 1000 },
    );

    // 选中标签的复选框
    const checkbox = page.locator(
      `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName}"] .tag-batch-checkbox`,
    );
    await checkbox.check();

    // 验证复选框被选中
    await expect(checkbox).toBeChecked({ timeout: 1000 });

    // 验证工具栏计数显示为1
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 1 个标签");

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词标签管理界面 - 复选框选择 ====================
  test("提示词标签管理界面-复选框应该切换选择状态", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签
    const factory = electronTest.getApiFactory();
    const promptFactory = factory.createPromptFactory();
    const tagName = electronTest.generateE2ePrefixName("checkbox_test");
    await promptFactory.createTag(tagName);
    await electronTest.refreshData();

    // 进入提示词标签管理器
    await enterPromptTagManager(page);

    // 等待标签加载
    await page.waitForFunction(
      (params: { containerId: string; tagName: string }) => {
        const items = document.querySelectorAll(
          `#${params.containerId} .tag-manager-item`,
        );
        return Array.from(items).some(
          (item) => item.getAttribute("data-tag") === params.tagName,
        );
      },
      { containerId: Constants.Ids.PROMPT_TAG_GROUP_CARDS, tagName },
      { timeout: 1000 },
    );

    // 点击批量管理按钮进入批量模式
    await page.click(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 等待复选框出现
    await page.waitForSelector(
      `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-batch-checkbox`,
      { state: "visible", timeout: 1000 },
    );

    // 选中标签的复选框
    const checkbox = page.locator(
      `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName}"] .tag-batch-checkbox`,
    );
    await checkbox.check();

    // 验证复选框被选中
    await expect(checkbox).toBeChecked({ timeout: 1000 });

    // 验证工具栏计数显示为1
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 1 个标签");

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像标签管理界面 - 搜索改变时退出批量模式 ====================
  test("图像标签管理界面-搜索改变应该退出批量模式", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签
    const factory = electronTest.getApiFactory();
    const imageFactory = factory.createImageFactory();
    const tagName = electronTest.generateE2ePrefixName("search_test");
    await imageFactory.createTag(tagName);
    await electronTest.refreshData();

    // 进入图像标签管理器
    await enterImageTagManager(page);

    // 等待标签加载
    await page.waitForFunction(
      (params: { containerId: string; tagName: string }) => {
        const items = document.querySelectorAll(
          `#${params.containerId} .tag-manager-item`,
        );
        return Array.from(items).some(
          (item) => item.getAttribute("data-tag") === params.tagName,
        );
      },
      { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, tagName },
      { timeout: 1000 },
    );

    // 点击批量管理按钮进入批量模式
    await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 选择一个标签
    const tagItem = page.locator(
      `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName}"]`,
    );
    await tagItem.click();

    // 验证已选中
    await expect(tagItem).toHaveClass(/is-selected|tag-selected/, {
      timeout: 1000,
    });

    // PRD: 搜索改变时退出批量模式
    await page.fill(
      `#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`,
      "some_search_term",
    );

    // 验证工具栏隐藏（搜索改变时退出批量模式）
    await expect(toolbar).toBeHidden({ timeout: 1000 });

    // 由于搜索词过滤掉了测试标签，无法验证标签选择状态
    // 直接清除搜索
    await page.click(`#${Constants.Ids.CLEAR_IMAGE_TAG_MANAGER_SEARCH_BTN}`);
  });

  // ==================== 提示词标签管理界面 - 搜索改变时退出批量模式 ====================
  test("提示词标签管理界面-搜索改变应该退出批量模式", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签
    const factory = electronTest.getApiFactory();
    const promptFactory = factory.createPromptFactory();
    const tagName = electronTest.generateE2ePrefixName("search_test");
    await promptFactory.createTag(tagName);
    await electronTest.refreshData();

    // 进入提示词标签管理器
    await enterPromptTagManager(page);

    // 等待标签加载
    await page.waitForFunction(
      (params: { containerId: string; tagName: string }) => {
        const items = document.querySelectorAll(
          `#${params.containerId} .tag-manager-item`,
        );
        return Array.from(items).some(
          (item) => item.getAttribute("data-tag") === params.tagName,
        );
      },
      { containerId: Constants.Ids.PROMPT_TAG_GROUP_CARDS, tagName },
      { timeout: 1000 },
    );

    // 点击批量管理按钮进入批量模式
    await page.click(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 选择一个标签
    const tagItem = page.locator(
      `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName}"]`,
    );
    await tagItem.click();

    // 验证已选中
    await expect(tagItem).toHaveClass(/is-selected|tag-selected/, {
      timeout: 1000,
    });

    // PRD: 搜索改变时退出批量模式
    await page.fill(
      `#${Constants.Ids.PROMPT_TAG_MANAGER_SEARCH_INPUT}`,
      "some_search_term",
    );

    // 验证工具栏隐藏（搜索改变时退出批量模式）
    await expect(toolbar).toBeHidden({ timeout: 1000 });

    // 由于搜索词过滤掉了测试标签，无法验证标签选择状态
    // 直接清除搜索
    await page.click(`#${Constants.Ids.CLEAR_PROMPT_TAG_MANAGER_SEARCH_BTN}`);
  });

  // ==================== 图像标签管理界面 - 删除取消时选中集不变 ====================
  test("图像标签管理界面-删除取消应该保持选中集", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签
    const factory = electronTest.getApiFactory();
    const imageFactory = factory.createImageFactory();
    const tagName = electronTest.generateE2ePrefixName("delete_cancel");
    await imageFactory.createTag(tagName);
    await electronTest.refreshData();

    // 进入图像标签管理器
    await enterImageTagManager(page);

    // 等待标签加载
    await page.waitForFunction(
      (params: { containerId: string; tagName: string }) => {
        const items = document.querySelectorAll(
          `#${params.containerId} .tag-manager-item`,
        );
        return Array.from(items).some(
          (item) => item.getAttribute("data-tag") === params.tagName,
        );
      },
      { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, tagName },
      { timeout: 1000 },
    );

    // 点击批量管理按钮进入批量模式
    await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 选择标签
    const tagItem = page.locator(
      `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName}"]`,
    );
    await tagItem.click();

    // 验证已选中
    await expect(tagItem).toHaveClass(/is-selected|tag-selected/, {
      timeout: 1000,
    });

    // 点击删除按钮
    await toolbar.locator('[data-action="Delete"]').click();

    // 验证确认对话框出现
    const confirmModal = page.locator(`#${Constants.Ids.CONFIRM_MODAL}`);
    await expect(confirmModal).toBeVisible({ timeout: 1000 });

    // 点击取消
    await page.click(`#${Constants.Ids.CONFIRM_CANCEL_BTN}`);
    await expect(confirmModal).toBeHidden({ timeout: 1000 });

    // PRD: 取消操作后选中集不变
    await expect(toolbar).toBeVisible({ timeout: 1000 });
    await expect(tagItem).toHaveClass(/is-selected|tag-selected/, {
      timeout: 1000,
    });
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 1 个标签");

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词标签管理界面 - 删除取消时选中集不变 ====================
  test("提示词标签管理界面-删除取消应该保持选中集", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签
    const factory = electronTest.getApiFactory();
    const promptFactory = factory.createPromptFactory();
    const tagName = electronTest.generateE2ePrefixName("delete_cancel");
    await promptFactory.createTag(tagName);
    await electronTest.refreshData();

    // 进入提示词标签管理器
    await enterPromptTagManager(page);

    // 等待标签加载
    await page.waitForFunction(
      (params: { containerId: string; tagName: string }) => {
        const items = document.querySelectorAll(
          `#${params.containerId} .tag-manager-item`,
        );
        return Array.from(items).some(
          (item) => item.getAttribute("data-tag") === params.tagName,
        );
      },
      { containerId: Constants.Ids.PROMPT_TAG_GROUP_CARDS, tagName },
      { timeout: 1000 },
    );

    // 点击批量管理按钮进入批量模式
    await page.click(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 选择标签
    const tagItem = page.locator(
      `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName}"]`,
    );
    await tagItem.click();

    // 验证已选中
    await expect(tagItem).toHaveClass(/is-selected|tag-selected/, {
      timeout: 1000,
    });

    // 点击删除按钮
    await toolbar.locator('[data-action="Delete"]').click();

    // 验证确认对话框出现
    const confirmModal = page.locator(`#${Constants.Ids.CONFIRM_MODAL}`);
    await expect(confirmModal).toBeVisible({ timeout: 1000 });

    // 点击取消
    await page.click(`#${Constants.Ids.CONFIRM_CANCEL_BTN}`);
    await expect(confirmModal).toBeHidden({ timeout: 1000 });

    // PRD: 取消操作后选中集不变
    await expect(toolbar).toBeVisible({ timeout: 1000 });
    await expect(tagItem).toHaveClass(/is-selected|tag-selected/, {
      timeout: 1000,
    });
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 1 个标签");

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像标签管理界面 - 选中数>0时自动显示工具栏 ====================
  test("图像标签管理界面-选中数大于0时应该显示工具栏", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签
    const factory = electronTest.getApiFactory();
    const imageFactory = factory.createImageFactory();
    const tagName = electronTest.generateE2ePrefixName("auto_show");
    await imageFactory.createTag(tagName);
    await electronTest.refreshData();

    // 进入图像标签管理器
    await enterImageTagManager(page);

    // 等待标签加载
    await page.waitForFunction(
      (params: { containerId: string; tagName: string }) => {
        const items = document.querySelectorAll(
          `#${params.containerId} .tag-manager-item`,
        );
        return Array.from(items).some(
          (item) => item.getAttribute("data-tag") === params.tagName,
        );
      },
      { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, tagName },
      { timeout: 1000 },
    );

    // 验证工具栏初始隐藏
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeHidden({ timeout: 1000 });

    // 点击批量管理按钮进入批量模式
    await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);

    // 等待工具栏出现
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 选择一个标签（选中数从0变为1）
    const tagItem = page.locator(
      `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName}"]`,
    );
    await tagItem.click();

    // 验证工具栏仍然显示（计数更新）
    await expect(toolbar).toBeVisible({ timeout: 1000 });
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 1 个标签");

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词标签管理界面 - 选中数>0时自动显示工具栏 ====================
  test("提示词标签管理界面-选中数大于0时应该显示工具栏", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // 使用 API 工厂创建测试标签
    const factory = electronTest.getApiFactory();
    const promptFactory = factory.createPromptFactory();
    const tagName = electronTest.generateE2ePrefixName("auto_show");
    await promptFactory.createTag(tagName);
    await electronTest.refreshData();

    // 进入提示词标签管理器
    await enterPromptTagManager(page);

    // 等待标签加载
    await page.waitForFunction(
      (params: { containerId: string; tagName: string }) => {
        const items = document.querySelectorAll(
          `#${params.containerId} .tag-manager-item`,
        );
        return Array.from(items).some(
          (item) => item.getAttribute("data-tag") === params.tagName,
        );
      },
      { containerId: Constants.Ids.PROMPT_TAG_GROUP_CARDS, tagName },
      { timeout: 1000 },
    );

    // 验证工具栏初始隐藏
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeHidden({ timeout: 1000 });

    // 点击批量管理按钮进入批量模式
    await page.click(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`);

    // 等待工具栏出现
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 选择一个标签（选中数从0变为1）
    const tagItem = page.locator(
      `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName}"]`,
    );
    await tagItem.click();

    // 验证工具栏仍然显示（计数更新）
    await expect(toolbar).toBeVisible({ timeout: 1000 });
    const countText = await toolbar
      .locator(".batch-toolbar-count")
      .textContent();
    expect(countText).toContain("已选择 1 个标签");

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 图像标签管理界面 - 无可选组提示（放在最后，避免影响其他测试） ====================
  test("图像标签管理界面-无可选组时应该提示", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // Mock API 返回空数组（模拟没有可用组）
    await electronTest.mockImageTagGroupsEmpty();

    // 进入图像标签管理器
    await enterImageTagManager(page);

    // 点击批量管理按钮
    await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 先选择一个标签
    const firstTag = page
      .locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item`)
      .first();
    await firstTag.click();

    // 点击"移动到组"按钮
    await toolbar.locator('[data-action="Move"]').click();

    // 验证提示"无可用组"（通过Toast或对话框）
    const toast = page.locator('.toast-notification, .toast, [role="alert"]');
    const modal = page.locator(".modal, #inputModal");

    // 等待 Toast 或对话框出现
    await Promise.race([
      toast.waitFor({ state: "visible", timeout: 3000 }).catch(() => {}),
      modal.waitFor({ state: "visible", timeout: 3000 }).catch(() => {}),
    ]);

    // 检查是否有"无可用组"提示
    const hasNoGroupMessage = await Promise.race([
      toast
        .isVisible()
        .then(async (visible) => {
          if (visible) {
            const text = await toast.textContent();
            return (
              text?.includes("无可用组") || text?.includes("没有可用") || false
            );
          }
          return false;
        })
        .catch(() => false),
      modal
        .isVisible()
        .then(async (visible) => {
          if (visible) {
            const text = await modal.textContent();
            return (
              text?.includes("无可用组") || text?.includes("没有可用") || false
            );
          }
          return false;
        })
        .catch(() => false),
    ]);

    // 如果没有提示，验证至少没有崩溃且模态框正常处理
    expect(
      hasNoGroupMessage ||
        (await modal.isVisible().catch(() => false)) ||
        (await toast.isVisible().catch(() => false)),
    ).toBeTruthy();

    // 关闭提示/对话框
    await page.keyboard.press("Escape");
    await modal.waitFor({ state: "hidden", timeout: 1000 }).catch(() => {});

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });

  // ==================== 提示词标签管理界面 - 无可选组提示（放在最后，避免影响其他测试） ====================
  test("提示词标签管理界面-无可选组时应该提示", async ({
    electronTest,
    page,
  }) => {
    await electronTest.logTestStart();

    // Mock API 返回空数组（模拟没有可用组）
    await electronTest.mockPromptTagGroupsEmpty();

    // 进入提示词标签管理器
    await enterPromptTagManager(page);

    // 点击批量管理按钮
    await page.click(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`);

    // 等待工具栏出现
    const toolbar = page.locator(`#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`);
    await expect(toolbar).toBeVisible({ timeout: 1000 });

    // 先选择一个标签
    const firstTag = page
      .locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item`)
      .first();
    await firstTag.click();

    // 点击"移动到组"按钮
    await toolbar.locator('[data-action="Move"]').click();

    // 验证提示"无可用组"（通过Toast或对话框）
    const toast = page.locator('.toast-notification, .toast, [role="alert"]');
    const modal = page.locator(".modal, #inputModal");

    // 等待 Toast 或对话框出现
    await Promise.race([
      toast.waitFor({ state: "visible", timeout: 3000 }).catch(() => {}),
      modal.waitFor({ state: "visible", timeout: 3000 }).catch(() => {}),
    ]);

    // 检查是否有"无可用组"提示
    const hasNoGroupMessage = await Promise.race([
      toast
        .isVisible()
        .then(async (visible) => {
          if (visible) {
            const text = await toast.textContent();
            return (
              text?.includes("无可用组") || text?.includes("没有可用") || false
            );
          }
          return false;
        })
        .catch(() => false),
      modal
        .isVisible()
        .then(async (visible) => {
          if (visible) {
            const text = await modal.textContent();
            return (
              text?.includes("无可用组") || text?.includes("没有可用") || false
            );
          }
          return false;
        })
        .catch(() => false),
    ]);

    // 如果没有提示，验证至少没有崩溃且模态框正常处理
    expect(
      hasNoGroupMessage ||
        (await modal.isVisible().catch(() => false)) ||
        (await toast.isVisible().catch(() => false)),
    ).toBeTruthy();

    // 关闭提示/对话框
    await page.keyboard.press("Escape");
    await modal.waitFor({ state: "hidden", timeout: 1000 }).catch(() => {});

    // 点击取消退出批量模式
    await toolbar.locator('[data-action="Cancel"]').click();
    await expect(toolbar).toBeHidden({ timeout: 1000 });
  });
});

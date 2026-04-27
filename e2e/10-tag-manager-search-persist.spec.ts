import { expect } from "@playwright/test";
import {
  test,
  enterImageTagManager,
  enterPromptTagManager,
  closeImageTagManager,
  closePromptTagManager,
  createImageTagsInManagerBatch,
  createPromptTagsInManagerBatch,
  createImageTagGroup,
  createPromptTagGroup,
} from "./electron-test.ts";

import { Constants } from "../src/constants.ts";

/**
 * 标签管理器搜索状态保持功能 E2E 测试
 *
 * 测试场景：
 * 1. 图像标签管理 - 搜索后单个删除保持搜索状态
 * 2. 图像标签管理 - 搜索后单个编辑保持搜索状态
 * 3. 图像标签管理 - 搜索后批量删除保持搜索状态
 * 4. 图像标签管理 - 搜索后批量移动到组保持搜索状态
 * 5. 提示词标签管理 - 搜索后单个删除保持搜索状态
 * 6. 提示词标签管理 - 搜索后单个编辑保持搜索状态
 * 7. 提示词标签管理 - 搜索后批量删除保持搜索状态
 * 8. 提示词标签管理 - 搜索后批量移动到组保持搜索状态
 */
test.describe("标签管理器搜索状态保持功能", () => {
  test.describe("图像标签管理 - 搜索状态保持", () => {
    test("搜索后单个删除保持搜索状态", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageTagManager(page);

      const searchKeyword = "persist_single_delete";
      const tagName1 = electronTest.generateE2ePrefixName(searchKeyword);
      const tagName2 = electronTest.generateE2ePrefixName(searchKeyword);
      const otherTagName = electronTest.generateE2ePrefixName("other");

      // 批量创建3个标签，减少UI操作次数
      await createImageTagsInManagerBatch(page, [tagName1, tagName2, otherTagName]);

      await page.fill(
        `#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`,
        searchKeyword,
      );

      await page.waitForFunction(
        (params: { containerId: string; keyword: string }) => {
          const items = document.querySelectorAll(
            `#${params.containerId} .tag-manager-item`,
          );
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

      // 点击第一个标签的删除按钮
      const deleteBtn = page.locator(
        `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName1}"] .tag-delete-btn`,
      );
      await deleteBtn.click();

      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      await page.waitForFunction(
        async (name: string) => {
          const tags = await window.electronAPI.getImageTags();
          return !tags.includes(name);
        },
        tagName1,
        { timeout: 1000 },
      );

      // 验证搜索状态保持
      const searchInputValue = await page.inputValue(
        `#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`,
      );
      expect(searchInputValue).toBe(searchKeyword);

      // 验证另一个匹配的标签仍然显示
      await expect(
        page.locator(
          `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName2}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });

      // 清除搜索，验证被删除的标签已消失
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

      await closeImageTagManager(page);

      // 清理测试数据
      await electronTest.cleanupImageTagsAndGroups();
    });

    test("搜索后单个编辑保持搜索状态", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageTagManager(page);

      const searchKeyword = "persist_single_edit";
      const tagName1 = electronTest.generateE2ePrefixName(searchKeyword);
      const tagName2 = electronTest.generateE2ePrefixName(searchKeyword);
      const newTagName = electronTest.generateE2ePrefixName(
        `${searchKeyword}_renamed`,
      );

      // 批量创建2个标签，减少UI操作次数
      await createImageTagsInManagerBatch(page, [tagName1, tagName2]);

      await page.fill(
        `#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`,
        searchKeyword,
      );

      await page.waitForFunction(
        (params: { containerId: string; keyword: string }) => {
          const items = document.querySelectorAll(
            `#${params.containerId} .tag-manager-item`,
          );
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

      // 点击第一个标签的编辑按钮
      const editBtn = page.locator(
        `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName1}"] .tag-edit-btn`,
      );
      await editBtn.click();

      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, newTagName);
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      await page.waitForFunction(
        async (params: { oldName: string; newName: string }) => {
          const tags = await window.electronAPI.getImageTags();
          return (
            !tags.includes(params.oldName) && tags.includes(params.newName)
          );
        },
        { oldName: tagName1, newName: newTagName },
        { timeout: 1000 },
      );

      // 验证搜索状态保持
      const searchInputValue = await page.inputValue(
        `#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`,
      );
      expect(searchInputValue).toBe(searchKeyword);

      // 清除搜索，验证重命名后的标签存在
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
          tagName: newTagName,
        },
        { timeout: 1000 },
      );

      await expect(
        page.locator(
          `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${newTagName}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });

      await closeImageTagManager(page);

      // 清理测试数据
      await electronTest.cleanupImageTagsAndGroups();
    });

    test("搜索后批量删除保持搜索状态", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageTagManager(page);

      const searchKeyword = "persist_test";
      const tagName1 = electronTest.generateE2ePrefixName(searchKeyword);
      const tagName2 = electronTest.generateE2ePrefixName(searchKeyword);
      const otherTagName = electronTest.generateE2ePrefixName("other");

      // 批量创建3个标签，减少UI操作次数
      await createImageTagsInManagerBatch(page, [tagName1, tagName2, otherTagName]);

      await page.fill(
        `#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`,
        searchKeyword,
      );

      await page.waitForFunction(
        (params: { containerId: string; keyword: string }) => {
          const items = document.querySelectorAll(
            `#${params.containerId} .tag-manager-item`,
          );
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

      await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);
      await page.waitForSelector(
        `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-batch-checkbox`,
        { state: "visible", timeout: 1000 },
      );

      const batchToolbar = page.locator(
        `#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`,
      );
      await expect(batchToolbar).toBeVisible({ timeout: 1000 });

      const selectAllBtn = batchToolbar.locator(".batch-action-select-all");
      await selectAllBtn.click();

      // 等待复选框被选中（UI 状态更新）
      await expect(
        page.locator(
          `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-batch-checkbox:checked`,
        ),
      ).toHaveCount(2, { timeout: 1000 });

      const deleteBtn = batchToolbar.locator(".batch-action-delete");
      await deleteBtn.click();

      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // 等待 UI 显示空状态（删除后搜索状态下应该无匹配标签）
      await expect(
        page.locator(`#${Constants.Ids.IMAGE_TAG_MANAGER_EMPTY}`),
      ).toBeVisible({ timeout: 1000 });

      const searchInputValue = await page.inputValue(
        `#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`,
      );
      expect(searchInputValue).toBe(searchKeyword);

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

      await closeImageTagManager(page);

      // 清理测试数据
      await electronTest.cleanupImageTagsAndGroups();
    });

    test("搜索后批量移动到组保持搜索状态", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageTagManager(page);

      const searchKeyword = "persist_move";
      const tagName1 = electronTest.generateE2ePrefixName(searchKeyword);
      const tagName2 = electronTest.generateE2ePrefixName(searchKeyword);

      const { groupId } = await createImageTagGroup(page, "测试组");
      // 批量创建2个标签，减少UI操作次数
      await createImageTagsInManagerBatch(page, [tagName1, tagName2]);

      await page.fill(
        `#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`,
        searchKeyword,
      );

      await page.waitForFunction(
        (params: { containerId: string; keyword: string }) => {
          const items = document.querySelectorAll(
            `#${params.containerId} .tag-manager-item`,
          );
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

      await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);
      await page.waitForSelector(
        `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-batch-checkbox`,
        { state: "visible", timeout: 1000 },
      );

      const batchToolbar = page.locator(
        `#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`,
      );
      await expect(batchToolbar).toBeVisible({ timeout: 1000 });

      // 选择当前测试创建的两个标签（使用全选按钮确保选中所有搜索结果）
      const selectAllBtn = batchToolbar.locator(".batch-action-select-all");
      await selectAllBtn.click();

      const moveBtn = batchToolbar.locator(".batch-action-move");
      await moveBtn.click();

      await page.waitForSelector(`#${Constants.Ids.SELECT_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.selectOption(
        `#${Constants.Ids.SELECT_MODAL_FIELD}`,
        String(groupId),
      );
      await page.click(`#${Constants.Ids.SELECT_OK_BTN}`);

      // 等待移动完成，验证两个标签都在目标组中
      await page.waitForFunction(
        async (params: { tags: string[]; groupId: number }) => {
          const groups = await window.electronAPI.getImageTagGroups();
          const group = groups.find(
            (g: { id: number; tags?: string[] }) => g.id === params.groupId,
          );
          return (
            group?.tags?.includes(params.tags[0]) &&
            group?.tags?.includes(params.tags[1])
          );
        },
        { tags: [tagName1, tagName2], groupId },
        { timeout: 1000 },
      );

      const searchInputValue = await page.inputValue(
        `#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`,
      );
      expect(searchInputValue).toBe(searchKeyword);

      // 移动后，搜索状态保持，验证目标组存在
      const groupCard = page.locator(
        `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`,
      );
      await expect(groupCard).toBeVisible({ timeout: 1000 });

      await page.click(`#${Constants.Ids.CLEAR_IMAGE_TAG_MANAGER_SEARCH_BTN}`);
      await page.waitForFunction(
        (params: { containerId: string; groupId: number }) => {
          const groupCard = document.querySelector(
            `#${params.containerId} .tag-group-card[data-group-id="${params.groupId}"]`,
          );
          if (!groupCard) return false;
          const items = groupCard.querySelectorAll(".tag-manager-item");
          return items.length >= 2;
        },
        { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, groupId },
        { timeout: 1000 },
      );

      await closeImageTagManager(page);

      // 清理测试数据
      await electronTest.cleanupImageTagsAndGroups();
    });
  });

  test.describe("提示词标签管理 - 搜索状态保持", () => {
    test("搜索后单个删除保持搜索状态", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterPromptTagManager(page);

      const searchKeyword = "persist_single_delete";
      const tagName1 = electronTest.generateE2ePrefixName(searchKeyword);
      const tagName2 = electronTest.generateE2ePrefixName(searchKeyword);
      const otherTagName = electronTest.generateE2ePrefixName("other");

      // 批量创建3个标签，减少UI操作次数
      await createPromptTagsInManagerBatch(page, [tagName1, tagName2, otherTagName]);

      await page.fill(
        `#${Constants.Ids.PROMPT_TAG_MANAGER_SEARCH_INPUT}`,
        searchKeyword,
      );

      await page.waitForFunction(
        (params: { containerId: string; keyword: string }) => {
          const items = document.querySelectorAll(
            `#${params.containerId} .tag-manager-item`,
          );
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

      // 点击第一个标签的删除按钮
      const deleteBtn = page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName1}"] .tag-delete-btn`,
      );
      await deleteBtn.click();

      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      await page.waitForFunction(
        async (name: string) => {
          const tags = await window.electronAPI.getAllTags();
          return !tags.includes(name);
        },
        tagName1,
        { timeout: 1000 },
      );

      // 验证搜索状态保持
      const searchInputValue = await page.inputValue(
        `#${Constants.Ids.PROMPT_TAG_MANAGER_SEARCH_INPUT}`,
      );
      expect(searchInputValue).toBe(searchKeyword);

      // 验证另一个匹配的标签仍然显示
      await expect(
        page.locator(
          `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName2}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });

      // 清除搜索，验证被删除的标签已消失
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

      await closePromptTagManager(page);

      // 清理测试数据
      await electronTest.cleanupPromptTagsAndGroups();
    });

    test("搜索后单个编辑保持搜索状态", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterPromptTagManager(page);

      const searchKeyword = "persist_single_edit";
      const tagName1 = electronTest.generateE2ePrefixName(searchKeyword);
      const tagName2 = electronTest.generateE2ePrefixName(searchKeyword);
      const newTagName = electronTest.generateE2ePrefixName(
        `${searchKeyword}_renamed`,
      );

      // 批量创建2个标签，减少UI操作次数
      await createPromptTagsInManagerBatch(page, [tagName1, tagName2]);

      await page.fill(
        `#${Constants.Ids.PROMPT_TAG_MANAGER_SEARCH_INPUT}`,
        searchKeyword,
      );

      await page.waitForFunction(
        (params: { containerId: string; keyword: string }) => {
          const items = document.querySelectorAll(
            `#${params.containerId} .tag-manager-item`,
          );
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

      // 点击第一个标签的编辑按钮
      const editBtn = page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName1}"] .tag-edit-btn`,
      );
      await editBtn.click();

      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, newTagName);
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      await page.waitForFunction(
        async (params: { oldName: string; newName: string }) => {
          const tags = await window.electronAPI.getAllTags();
          return (
            !tags.includes(params.oldName) && tags.includes(params.newName)
          );
        },
        { oldName: tagName1, newName: newTagName },
        { timeout: 1000 },
      );

      // 验证搜索状态保持
      const searchInputValue = await page.inputValue(
        `#${Constants.Ids.PROMPT_TAG_MANAGER_SEARCH_INPUT}`,
      );
      expect(searchInputValue).toBe(searchKeyword);

      // 清除搜索，验证重命名后的标签存在
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
          tagName: newTagName,
        },
        { timeout: 1000 },
      );

      await expect(
        page.locator(
          `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${newTagName}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });

      await closePromptTagManager(page);

      // 清理测试数据
      await electronTest.cleanupPromptTagsAndGroups();
    });

    test("搜索后批量删除保持搜索状态", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterPromptTagManager(page);

      const searchKeyword = "persist_test";
      const tagName1 = electronTest.generateE2ePrefixName(searchKeyword);
      const tagName2 = electronTest.generateE2ePrefixName(searchKeyword);
      const otherTagName = electronTest.generateE2ePrefixName("other");

      // 批量创建3个标签，减少UI操作次数
      await createPromptTagsInManagerBatch(page, [tagName1, tagName2, otherTagName]);

      await page.fill(
        `#${Constants.Ids.PROMPT_TAG_MANAGER_SEARCH_INPUT}`,
        searchKeyword,
      );

      await page.waitForFunction(
        (params: { containerId: string; keyword: string }) => {
          const items = document.querySelectorAll(
            `#${params.containerId} .tag-manager-item`,
          );
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

      await page.click(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`);
      await page.waitForSelector(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-batch-checkbox`,
        { state: "visible", timeout: 1000 },
      );

      const batchToolbar = page.locator(
        `#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`,
      );
      await expect(batchToolbar).toBeVisible({ timeout: 1000 });

      const selectAllBtn = batchToolbar.locator(".batch-action-select-all");
      await selectAllBtn.click();

      // 等待复选框被选中（UI 状态更新）
      await expect(
        page.locator(
          `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-batch-checkbox:checked`,
        ),
      ).toHaveCount(2, { timeout: 1000 });

      const deleteBtn = batchToolbar.locator(".batch-action-delete");
      await deleteBtn.click();

      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // 等待 UI 显示空状态（删除后搜索状态下应该无匹配标签）
      await expect(
        page.locator(`#${Constants.Ids.PROMPT_TAG_MANAGER_EMPTY}`),
      ).toBeVisible({ timeout: 1000 });

      const searchInputValue = await page.inputValue(
        `#${Constants.Ids.PROMPT_TAG_MANAGER_SEARCH_INPUT}`,
      );
      expect(searchInputValue).toBe(searchKeyword);

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

      await closePromptTagManager(page);

      // 清理测试数据
      await electronTest.cleanupPromptTagsAndGroups();
    });

    test("搜索后批量移动到组保持搜索状态", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterPromptTagManager(page);

      const searchKeyword = "persist_move";
      const tagName1 = electronTest.generateE2ePrefixName(searchKeyword);
      const tagName2 = electronTest.generateE2ePrefixName(searchKeyword);

      const { groupId } = await createPromptTagGroup(page, "测试组");
      // 批量创建2个标签，减少UI操作次数
      await createPromptTagsInManagerBatch(page, [tagName1, tagName2]);

      await page.fill(
        `#${Constants.Ids.PROMPT_TAG_MANAGER_SEARCH_INPUT}`,
        searchKeyword,
      );

      await page.waitForFunction(
        (params: { containerId: string; keyword: string }) => {
          const items = document.querySelectorAll(
            `#${params.containerId} .tag-manager-item`,
          );
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

      await page.click(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`);
      await page.waitForSelector(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-batch-checkbox`,
        { state: "visible", timeout: 1000 },
      );

      const batchToolbar = page.locator(
        `#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`,
      );
      await expect(batchToolbar).toBeVisible({ timeout: 1000 });

      // 选择当前测试创建的两个标签（使用全选按钮确保选中所有搜索结果）
      const selectAllBtn = batchToolbar.locator(".batch-action-select-all");
      await selectAllBtn.click();

      const moveBtn = batchToolbar.locator(".batch-action-move");
      await moveBtn.click();

      await page.waitForSelector(`#${Constants.Ids.SELECT_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.selectOption(
        `#${Constants.Ids.SELECT_MODAL_FIELD}`,
        String(groupId),
      );
      await page.click(`#${Constants.Ids.SELECT_OK_BTN}`);

      await page.waitForFunction(
        async (params: { tags: string[]; groupId: number }) => {
          const groups = await window.electronAPI.getPromptTagGroups();
          const group = groups.find(
            (g: { id: number; tags?: string[] }) => g.id === params.groupId,
          );
          return (
            group?.tags?.includes(params.tags[0]) &&
            group?.tags?.includes(params.tags[1])
          );
        },
        { tags: [tagName1, tagName2], groupId },
        { timeout: 1000 },
      );

      const searchInputValue = await page.inputValue(
        `#${Constants.Ids.PROMPT_TAG_MANAGER_SEARCH_INPUT}`,
      );
      expect(searchInputValue).toBe(searchKeyword);

      // 移动后，搜索状态保持，验证目标组存在
      const groupCard = page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`,
      );
      await expect(groupCard).toBeVisible({ timeout: 1000 });

      await page.click(`#${Constants.Ids.CLEAR_PROMPT_TAG_MANAGER_SEARCH_BTN}`);
      await page.waitForFunction(
        (params: { containerId: string; groupId: number }) => {
          const groupCard = document.querySelector(
            `#${params.containerId} .tag-group-card[data-group-id="${params.groupId}"]`,
          );
          if (!groupCard) return false;
          const items = groupCard.querySelectorAll(".tag-manager-item");
          return items.length >= 2;
        },
        { containerId: Constants.Ids.PROMPT_TAG_GROUP_CARDS, groupId },
        { timeout: 1000 },
      );

      await closePromptTagManager(page);

      // 清理测试数据
      await electronTest.cleanupPromptTagsAndGroups();
    });
  });
});

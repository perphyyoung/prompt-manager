import { expect } from "@playwright/test";
import {
  test,
  enterImageTagManager,
  enterPromptTagManager,
  closeImageTagManager,
  closePromptTagManager,
} from "./electron-test.ts";
import { Constants } from "../src/constants.ts";

/**
 * TagService 操作 E2E 测试
 * 补充测试 13-tag-input-methods.spec.ts 未覆盖的功能
 *
 * 测试场景：
 * 1. 标签组管理 - 创建、编辑、删除
 * 2. 标签分配到组
 * 3. 标签重命名
 * 4. 标签搜索（自动完成）
 * 5. 批量标签操作
 */
test.describe("TagService 操作测试", () => {
  // ========== 标签组管理测试 ==========

  test.describe("标签组管理", () => {
    test("图像标签组 - 创建、编辑、删除完整流程", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageTagManager(page);

      // 1. 创建标签组（使用 UI，因为测试目标是 UI 创建流程）
      const groupName = electronTest.generateE2ePrefixName("test_group");
      await page.click(`#${Constants.Ids.ADD_IMAGE_TAG_GROUP_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.fill(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_NAME}`, groupName);
      await page.click(`#${Constants.Ids.SAVE_IMAGE_TAG_GROUP_BTN}`);

      // 等待创建并通过 API 验证
      const groupIdHandle = await page.waitForFunction(
        async (name: string) => {
          const groups = await window.electronAPI.getImageTagGroups();
          const group = groups.find((g: { name: string; id: number }) => g.name === name);
          return group?.id;
        },
        groupName,
        { timeout: 1000 },
      );
      const groupId = await groupIdHandle.jsonValue();

      // 等待模态框关闭
      await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL}`, {
        state: "hidden",
        timeout: 1000,
      });

      // 验证标签组创建成功
      const groupElement = page.locator(
        `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`,
      );
      await expect(groupElement).toBeVisible({ timeout: 1000 });

      // 2. 编辑标签组名称（使用 UI）
      const newGroupName = electronTest.generateE2ePrefixName("group_renamed");
      await groupElement.locator(".tag-group-btn.edit").click();

      // 等待编辑对话框
      await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });

      // 清空并输入新名称
      await page.fill(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_NAME}`, newGroupName);
      await page.click(`#${Constants.Ids.SAVE_IMAGE_TAG_GROUP_BTN}`);

      // 等待更新并通过 API 验证
      await page.waitForFunction(
        async (params: { id: number | undefined; name: string }) => {
          if (!params.id) return false;
          const groups = await window.electronAPI.getImageTagGroups();
          const g = groups.find((item: { id: number; name: string }) => item.id === params.id);
          return g?.name === params.name;
        },
        { id: groupId, name: newGroupName },
        { timeout: 1000 },
      );

      // 验证标签组名称已更新
      const renamedGroup = page.locator(
        `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`,
      );
      await expect(renamedGroup).toContainText(newGroupName);

      // 3. 删除标签组（使用 UI）
      await renamedGroup.locator(".tag-group-btn.delete").click();

      // 确认删除
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // 等待删除并通过 API 验证
      await page.waitForFunction(
        async (id: number | undefined) => {
          if (!id) return false;
          const groups = await window.electronAPI.getImageTagGroups();
          return !groups.some((g: { id: number }) => g.id === id);
        },
        groupId,
        { timeout: 1000 },
      );

      // 验证标签组已删除
      await expect(renamedGroup).not.toBeVisible({ timeout: 1000 });

      await closeImageTagManager(page);
    });

    test("提示词标签组 - 创建、编辑、删除完整流程", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterPromptTagManager(page);

      // 1. 创建标签组（使用 UI，因为测试目标是 UI 创建流程）
      const groupName = electronTest.generateE2ePrefixName("prompt_test_group");
      await page.click(`#${Constants.Ids.ADD_PROMPT_TAG_GROUP_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.fill(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_NAME}`, groupName);
      await page.click(`#${Constants.Ids.SAVE_PROMPT_TAG_GROUP_BTN}`);

      // 等待创建并通过 API 验证
      const groupIdHandle = await page.waitForFunction(
        async (name: string) => {
          const groups = await window.electronAPI.getPromptTagGroups();
          const group = groups.find((g: { name: string; id: number }) => g.name === name);
          return group?.id;
        },
        groupName,
        { timeout: 1000 },
      );
      const groupId = await groupIdHandle.jsonValue();

      // 等待模态框关闭
      await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_MODAL}`, {
        state: "hidden",
        timeout: 1000,
      });

      // 验证标签组创建成功
      const groupElement = page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`,
      );
      await expect(groupElement).toBeVisible({ timeout: 1000 });

      // 2. 编辑标签组名称（使用 UI）
      const newGroupName = electronTest.generateE2ePrefixName("prompt_group_renamed");
      await groupElement.locator(".tag-group-btn.edit").click();

      // 等待编辑对话框
      await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });

      // 清空并输入新名称
      await page.fill(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_NAME}`, newGroupName);
      await page.click(`#${Constants.Ids.SAVE_PROMPT_TAG_GROUP_BTN}`);

      // 等待更新并通过 API 验证
      await page.waitForFunction(
        async (params: { id: number | undefined; name: string }) => {
          if (!params.id) return false;
          const groups = await window.electronAPI.getPromptTagGroups();
          const g = groups.find((item: { id: number; name: string }) => item.id === params.id);
          return g?.name === params.name;
        },
        { id: groupId, name: newGroupName },
        { timeout: 1000 },
      );

      // 验证标签组名称已更新
      const renamedGroup = page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`,
      );
      await expect(renamedGroup).toContainText(newGroupName);

      // 3. 删除标签组（使用 UI）
      await renamedGroup.locator(".tag-group-btn.delete").click();

      // 确认删除
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // 等待删除并通过 API 验证
      await page.waitForFunction(
        async (id: number | undefined) => {
          if (!id) return false;
          const groups = await window.electronAPI.getPromptTagGroups();
          return !groups.some((g: { id: number }) => g.id === id);
        },
        groupId,
        { timeout: 1000 },
      );

      // 验证标签组已删除
      await expect(renamedGroup).not.toBeVisible({ timeout: 1000 });

      await closePromptTagManager(page);
    });
  });

  // ========== 标签分配到组测试 ==========

  test.describe("标签分配到组", () => {
    test("图像标签 - 创建并分配到组", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageTagManager(page);

      // 1. 创建标签组（使用 UI，因为测试目标是 UI 创建流程）
      const groupName = electronTest.generateE2ePrefixName("assign_test_group");
      await page.click(`#${Constants.Ids.ADD_IMAGE_TAG_GROUP_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.fill(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_NAME}`, groupName);
      await page.click(`#${Constants.Ids.SAVE_IMAGE_TAG_GROUP_BTN}`);

      // 等待创建并通过 API 验证
      const groupIdHandle = await page.waitForFunction(
        async (name: string) => {
          const groups = await window.electronAPI.getImageTagGroups();
          const group = groups.find((g: { name: string; id: number }) => g.name === name);
          return group?.id;
        },
        groupName,
        { timeout: 1000 },
      );
      const groupId = await groupIdHandle.jsonValue();

      // 等待模态框关闭
      await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL}`, {
        state: "hidden",
        timeout: 1000,
      });

      // 2. 创建标签并指定组（使用 UI）
      const tagName = electronTest.generateE2ePrefixName("tag_with_group");
      await page.click(`#${Constants.Ids.ADD_IMAGE_TAG_IN_MANAGER_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, {
        state: "visible",
        timeout: 1000,
      });

      // 输入标签名
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, tagName);

      // 选择标签组
      await page.selectOption(`#${Constants.Ids.INPUT_MODAL_GROUP_SELECT}`, String(groupId));

      // 保存
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      // 等待标签创建成功
      await page.waitForFunction(
        async (name: string) => {
          const tags = await window.electronAPI.getImageTags();
          return tags.includes(name);
        },
        tagName,
        { timeout: 1000 },
      );

      // 验证标签创建成功
      await expect(
        page.locator(
          `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });

      // 验证标签在正确的组内
      const groupCard = page.locator(
        `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`,
      );
      await expect(groupCard.locator(`.tag-manager-item[data-tag="${tagName}"]`)).toBeVisible({
        timeout: 1000,
      });

      await closeImageTagManager(page);
    });

    test("提示词标签 - 创建并分配到组", async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterPromptTagManager(page);

      // 1. 创建标签组（使用 UI，因为测试目标是 UI 创建流程）
      const groupName = electronTest.generateE2ePrefixName("prompt_assign_group");
      await page.click(`#${Constants.Ids.ADD_PROMPT_TAG_GROUP_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.fill(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_NAME}`, groupName);
      await page.click(`#${Constants.Ids.SAVE_PROMPT_TAG_GROUP_BTN}`);

      // 等待创建并通过 API 验证
      const groupIdHandle = await page.waitForFunction(
        async (name: string) => {
          const groups = await window.electronAPI.getPromptTagGroups();
          const group = groups.find((g: { name: string; id: number }) => g.name === name);
          return group?.id;
        },
        groupName,
        { timeout: 1000 },
      );
      const groupId = await groupIdHandle.jsonValue();

      // 等待模态框关闭
      await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_MODAL}`, {
        state: "hidden",
        timeout: 1000,
      });

      // 2. 创建标签并指定组（使用 UI）
      const tagName = electronTest.generateE2ePrefixName("prompt_tag_with_group");
      await page.click(`#${Constants.Ids.ADD_PROMPT_TAG_IN_MANAGER_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, {
        state: "visible",
        timeout: 1000,
      });

      // 输入标签名
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, tagName);

      // 选择标签组
      await page.selectOption(`#${Constants.Ids.INPUT_MODAL_GROUP_SELECT}`, String(groupId));

      // 保存
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      // 等待标签创建成功
      await page.waitForFunction(
        async (name: string) => {
          const tags = await window.electronAPI.getAllTags();
          return tags.includes(name);
        },
        tagName,
        { timeout: 1000 },
      );

      // 验证标签创建成功
      await expect(
        page.locator(
          `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });

      // 验证标签在正确的组内
      const groupCard = page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`,
      );
      await expect(groupCard.locator(`.tag-manager-item[data-tag="${tagName}"]`)).toBeVisible({
        timeout: 1000,
      });

      await closePromptTagManager(page);
    });
  });

  // ========== 标签重命名测试 ==========

  test.describe("标签重命名", () => {
    test("图像标签 - 重命名标签", async ({ electronTest, page }) => {
      await electronTest.logTestStart();

      const factory = electronTest.getApiFactory();
      const imageFactory = factory.createImageFactory();

      // 1. 创建标签（使用 API 工厂，因为测试目标是重命名而非创建）
      const originalTagName = electronTest.generateE2ePrefixName("original");
      await imageFactory.createTag(originalTagName);

      await electronTest.refreshData();
      await enterImageTagManager(page);

      // 验证标签创建成功
      const tagElement = page.locator(
        `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${originalTagName}"]`,
      );
      await expect(tagElement).toBeVisible({ timeout: 1000 });

      // 2. 重命名标签（点击编辑按钮，使用 UI）
      const newTagName = electronTest.generateE2ePrefixName("renamed");
      await tagElement.locator(".tag-edit-btn").click();

      // 等待重命名对话框显示
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, {
        state: "visible",
        timeout: 1000,
      });

      // 输入新名称
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, newTagName);
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      // 等待重命名完成
      await page.waitForFunction(
        async (params: { old: string; new: string }) => {
          const tags = await window.electronAPI.getImageTags();
          return !tags.includes(params.old) && tags.includes(params.new);
        },
        { old: originalTagName, new: newTagName },
        { timeout: 1000 },
      );

      // 验证标签已重命名
      await expect(
        page.locator(
          `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${newTagName}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });
      await expect(
        page.locator(
          `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${originalTagName}"]`,
        ),
      ).not.toBeVisible({ timeout: 1000 });

      // 通过 API 验证
      const tags = await page.evaluate(async () => {
        return await window.electronAPI.getImageTags();
      });
      expect(tags).toContain(newTagName);
      expect(tags).not.toContain(originalTagName);

      await closeImageTagManager(page);
    });

    test("提示词标签 - 重命名标签", async ({ electronTest, page }) => {
      await electronTest.logTestStart();

      const factory = electronTest.getApiFactory();
      const promptFactory = factory.createPromptFactory();

      // 1. 创建标签（使用 API 工厂，因为测试目标是重命名而非创建）
      const originalTagName = electronTest.generateE2ePrefixName("prompt_original");
      await promptFactory.createTag(originalTagName);

      await electronTest.refreshData();
      await enterPromptTagManager(page);

      // 验证标签创建成功
      const tagElement = page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${originalTagName}"]`,
      );
      await expect(tagElement).toBeVisible({ timeout: 1000 });

      // 2. 重命名标签（点击编辑按钮，使用 UI）
      const newTagName = electronTest.generateE2ePrefixName("prompt_renamed");
      await tagElement.locator(".tag-edit-btn").click();

      // 等待重命名对话框显示
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, {
        state: "visible",
        timeout: 1000,
      });

      // 输入新名称
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, newTagName);
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      // 等待重命名完成
      await page.waitForFunction(
        async (params: { old: string; new: string }) => {
          const tags = await window.electronAPI.getPromptTags();
          return !tags.includes(params.old) && tags.includes(params.new);
        },
        { old: originalTagName, new: newTagName },
        { timeout: 1000 },
      );

      // 验证标签已重命名
      await expect(
        page.locator(
          `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${newTagName}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });
      await expect(
        page.locator(
          `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${originalTagName}"]`,
        ),
      ).not.toBeVisible({ timeout: 1000 });

      // 通过 API 验证
      const tags = await page.evaluate(async () => {
        return await window.electronAPI.getPromptTags();
      });
      expect(tags).toContain(newTagName);
      expect(tags).not.toContain(originalTagName);

      await closePromptTagManager(page);
    });
  });

  // ========== 标签搜索功能测试 ==========

  test.describe("标签搜索功能", () => {
    test("图像标签管理器 - 搜索标签", async ({ electronTest, page }) => {
      await electronTest.logTestStart();

      const factory = electronTest.getApiFactory();
      const imageFactory = factory.createImageFactory();

      // 创建测试标签（使用 API 工厂，因为测试目标是搜索而非创建）
      const searchTagName = electronTest.generateE2ePrefixName("search_test");
      const otherTagName = electronTest.generateE2ePrefixName("other_tag");
      await imageFactory.createTag(searchTagName);
      await imageFactory.createTag(otherTagName);

      await electronTest.refreshData();
      await enterImageTagManager(page);

      // 搜索特定标签
      await page.fill(`#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`, "search_test");

      // 验证搜索结果
      await page.waitForFunction(
        (params: { containerId: string; tagName: string; otherTag: string }) => {
          const items = document.querySelectorAll(`#${params.containerId} .tag-manager-item`);
          const hasTargetTag = Array.from(items).some((item) =>
            item.getAttribute("data-tag")?.includes("search_test"),
          );
          const hasOtherTag = Array.from(items).some(
            (item) => item.getAttribute("data-tag") === params.otherTag,
          );
          return hasTargetTag && !hasOtherTag;
        },
        {
          containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS,
          tagName: searchTagName,
          otherTag: otherTagName,
        },
        { timeout: 1000 },
      );

      // 清除搜索
      await page.click(`#${Constants.Ids.CLEAR_IMAGE_TAG_MANAGER_SEARCH_BTN}`);

      // 验证所有标签都显示
      await expect(
        page.locator(
          `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${searchTagName}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });
      await expect(
        page.locator(
          `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${otherTagName}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });

      await closeImageTagManager(page);
    });

    test("提示词标签管理器 - 搜索标签", async ({ electronTest, page }) => {
      await electronTest.logTestStart();

      const factory = electronTest.getApiFactory();
      const promptFactory = factory.createPromptFactory();

      // 创建测试标签（使用 API 工厂，因为测试目标是搜索而非创建）
      const searchTagName = electronTest.generateE2ePrefixName("prompt_search");
      const otherTagName = electronTest.generateE2ePrefixName("prompt_other");
      await promptFactory.createTag(searchTagName);
      await promptFactory.createTag(otherTagName);

      await electronTest.refreshData();
      await enterPromptTagManager(page);

      // 搜索特定标签
      await page.fill(`#${Constants.Ids.PROMPT_TAG_MANAGER_SEARCH_INPUT}`, "prompt_search");

      // 验证搜索结果
      await page.waitForFunction(
        (params: { containerId: string; tagName: string; otherTag: string }) => {
          const items = document.querySelectorAll(`#${params.containerId} .tag-manager-item`);
          const hasTargetTag = Array.from(items).some((item) =>
            item.getAttribute("data-tag")?.includes("prompt_search"),
          );
          const hasOtherTag = Array.from(items).some(
            (item) => item.getAttribute("data-tag") === params.otherTag,
          );
          return hasTargetTag && !hasOtherTag;
        },
        {
          containerId: Constants.Ids.PROMPT_TAG_GROUP_CARDS,
          tagName: searchTagName,
          otherTag: otherTagName,
        },
        { timeout: 1000 },
      );

      // 清除搜索
      await page.click(`#${Constants.Ids.CLEAR_PROMPT_TAG_MANAGER_SEARCH_BTN}`);

      // 验证所有标签都显示
      await expect(
        page.locator(
          `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${searchTagName}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });
      await expect(
        page.locator(
          `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${otherTagName}"]`,
        ),
      ).toBeVisible({ timeout: 1000 });

      await closePromptTagManager(page);
    });
  });
});

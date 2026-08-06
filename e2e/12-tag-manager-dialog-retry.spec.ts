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
 * 标签管理对话框失败重试功能 E2E 测试
 *
 * 测试场景：
 * 1. 新建标签时标签名已存在 - 对话框应保持打开，保留输入值
 * 2. 重命名标签时标签名已存在 - 对话框应保持打开，保留输入值
 * 3. 新建标签组时名称重复 - 对话框应保持打开，保留输入值
 * 4. 编辑标签组时名称重复 - 对话框应保持打开，保留输入值
 */
test.describe("标签管理对话框失败重试功能", () => {
  test.describe("图像标签管理 - 对话框失败重试", () => {
    test("新建标签时标签名已存在 - 对话框保持打开并保留输入", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();

      // 创建一个已存在的标签
      const factory = electronTest.getApiFactory();
      const existingTagName =
        electronTest.generateE2ePrefixName("img_existing");
      await factory.createImageFactory().createTag(existingTagName);

      // F5 刷新数据后打开标签管理器
      await electronTest.refreshData();
      await enterImageTagManager(page);

      // 再次尝试创建同名标签
      await page.click(`#${Constants.Ids.ADD_IMAGE_TAG_IN_MANAGER_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });

      // 输入已存在的标签名
      const newTagName = electronTest.generateE2ePrefixName("img_new");
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, existingTagName);

      // 点击确定
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      // 验证对话框仍然保持打开（因为标签已存在）
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });

      // 验证输入框保留之前的值
      const inputValue = await page.inputValue(
        `#${Constants.Ids.INPUT_MODAL_FIELD}`,
      );
      expect(inputValue).toBe(existingTagName);

      // 现在输入一个新的唯一标签名
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, newTagName);
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      // 验证标签创建成功
      await page.waitForFunction(
        async (name: string) => {
          const tags = await window.electronAPI.getImageTags();
          return tags.includes(name);
        },
        newTagName,
        { timeout: 1000 },
      );

      // 验证对话框关闭
      await expect(
        page.locator(`#${Constants.Ids.INPUT_MODAL}`),
      ).not.toBeVisible({ timeout: 1000 });

      // 验证新标签出现在列表中
      const newTagElement = page.locator(
        `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${newTagName}"]`,
      );
      await expect(newTagElement).toBeVisible({ timeout: 1000 });

      await closeImageTagManager(page);
    });

    test("重命名标签时标签名已存在 - 对话框保持打开并保留输入", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();

      // 创建两个标签
      const factory = electronTest.getApiFactory();
      const tagName1 = electronTest.generateE2ePrefixName("img_rename1");
      const tagName2 = electronTest.generateE2ePrefixName("img_rename2");
      await factory.createImageFactory().createTag(tagName1);
      await factory.createImageFactory().createTag(tagName2);

      // F5 刷新数据后打开标签管理器
      await electronTest.refreshData();
      await enterImageTagManager(page);

      // 点击编辑第一个标签
      const tagItem = page.locator(
        `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName1}"]`,
      );
      await expect(tagItem).toBeVisible({ timeout: 1000 });
      const editBtn = tagItem.locator(".tag-edit-btn");
      await editBtn.click();

      // 等待输入对话框
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });

      // 输入第二个标签的名称（已存在）
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, tagName2);

      // 点击确定
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      // 验证对话框仍然保持打开
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });

      // 验证输入框保留之前的值
      const inputValue = await page.inputValue(
        `#${Constants.Ids.INPUT_MODAL_FIELD}`,
      );
      expect(inputValue).toBe(tagName2);

      // 现在输入一个新的唯一标签名
      const newTagName = electronTest.generateE2ePrefixName(
        "img_renamed_success",
      );
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, newTagName);
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      // 验证重命名成功
      await page.waitForFunction(
        async (params: { old: string; new: string }) => {
          const tags = await window.electronAPI.getImageTags();
          return !tags.includes(params.old) && tags.includes(params.new);
        },
        { old: tagName1, new: newTagName },
        { timeout: 1000 },
      );

      // 验证对话框关闭
      await expect(
        page.locator(`#${Constants.Ids.INPUT_MODAL}`),
      ).not.toBeVisible({ timeout: 1000 });

      // 验证新标签名出现在列表中
      const renamedTag = page.locator(
        `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${newTagName}"]`,
      );
      await expect(renamedTag).toBeVisible({ timeout: 1000 });

      await closeImageTagManager(page);
    });

    test("新建标签组时名称重复 - 对话框保持打开并保留输入", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();

      // 创建一个已存在的标签组并添加一个标签（空标签组不显示）
      const factory = electronTest.getApiFactory();
      const { group, tagName: _tagName } = await factory.createImageFactory().createTagInGroup(
        "img_group_existing",
        "tag_in_group",
      );
      const existingGroupName = group.name;

      // F5 刷新数据后打开标签管理器
      await electronTest.refreshData();
      await enterImageTagManager(page);

      // 再次尝试创建同名标签组
      await page.click(`#${Constants.Ids.ADD_IMAGE_TAG_GROUP_BTN}`);
      await page.waitForSelector(
        `#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL}`,
        { state: "visible", timeout: 1000 },
      );

      // 输入已存在的标签组名
      const newGroupName = electronTest.generateE2ePrefixName("img_group_new");
      await page.fill(
        `#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_NAME}`,
        existingGroupName,
      );

      // 点击保存
      await page.click(`#${Constants.Ids.SAVE_IMAGE_TAG_GROUP_BTN}`);

      // 验证对话框仍然保持打开
      await page.waitForSelector(
        `#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL}`,
        { state: "visible", timeout: 1000 },
      );

      // 验证输入框保留之前的值
      const inputValue = await page.inputValue(
        `#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_NAME}`,
      );
      expect(inputValue).toBe(existingGroupName);

      // 现在输入一个新的唯一标签组名
      await page.fill(
        `#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_NAME}`,
        newGroupName,
      );
      await page.click(`#${Constants.Ids.SAVE_IMAGE_TAG_GROUP_BTN}`);

      // 验证标签组创建成功
      const createdGroupId = await page.waitForFunction(
        async (name: string) => {
          const groups = await window.electronAPI.getImageTagGroups();
          const group = groups.find(
            (g: { name: string; id: number }) => g.name === name,
          );
          return group?.id;
        },
        newGroupName,
        { timeout: 1000 },
      );

      expect(createdGroupId).toBeTruthy();

      // 验证对话框关闭
      await expect(
        page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL}`),
      ).not.toBeVisible({ timeout: 1000 });

      // 验证新标签组出现在列表中
      const newGroupCard = page.locator(
        `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${createdGroupId}"]`,
      );
      await expect(newGroupCard).toBeVisible({ timeout: 1000 });

      await closeImageTagManager(page);
    });

    test("编辑标签组时名称重复 - 对话框保持打开并保留输入", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();

      // 创建两个标签组（带标签才能在UI中显示）
      const factory = electronTest.getApiFactory();
      const { group: group1 } = await factory.createImageFactory().createTagInGroup(
        "img_edit_group1",
        "tag1",
      );
      const { group: group2 } = await factory.createImageFactory().createTagInGroup(
        "img_edit_group2",
        "tag2",
      );
      const groupId1 = group1.id;
      const actualGroupName2 = group2.name;

      // F5 刷新数据后打开标签管理器
      await electronTest.refreshData();
      await enterImageTagManager(page);

      // 点击编辑第一个标签组
      const groupCard = page.locator(
        `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId1}"]`,
      );
      const editBtn = groupCard.locator(".tag-group-btn.edit");
      await editBtn.click();

      // 等待编辑对话框
      await page.waitForSelector(
        `#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL}`,
        { state: "visible", timeout: 1000 },
      );

      // 输入第二个标签组的名称（已存在）
      await page.fill(
        `#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_NAME}`,
        actualGroupName2,
      );

      // 点击保存
      await page.click(`#${Constants.Ids.SAVE_IMAGE_TAG_GROUP_BTN}`);

      // 验证对话框仍然保持打开
      await page.waitForSelector(
        `#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL}`,
        { state: "visible", timeout: 1000 },
      );

      // 验证输入框保留之前的值
      const inputValue = await page.inputValue(
        `#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_NAME}`,
      );
      expect(inputValue).toBe(actualGroupName2);

      // 现在输入一个新的唯一标签组名
      const newGroupName = electronTest.generateE2ePrefixName(
        "img_group_renamed_success",
      );
      await page.fill(
        `#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_NAME}`,
        newGroupName,
      );
      await page.click(`#${Constants.Ids.SAVE_IMAGE_TAG_GROUP_BTN}`);

      // 验证标签组重命名成功
      await page.waitForFunction(
        async (params: { id: number; name: string }) => {
          const groups = await window.electronAPI.getImageTagGroups();
          const group = groups.find(
            (g: { id: number; name: string }) => g.id === params.id,
          );
          return group?.name === params.name;
        },
        { id: groupId1, name: newGroupName },
        { timeout: 1000 },
      );

      // 验证对话框关闭
      await expect(
        page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL}`),
      ).not.toBeVisible({ timeout: 1000 });

      // 验证新标签组名出现在列表中
      const renamedGroup = page.locator(
        `#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId1}"]`,
      );
      await expect(renamedGroup).toContainText(newGroupName);

      await closeImageTagManager(page);
    });
  });

  test.describe("提示词标签管理 - 对话框失败重试", () => {
    test("新建标签时标签名已存在 - 对话框保持打开并保留输入", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();

      // 创建一个已存在的标签
      const factory = electronTest.getApiFactory();
      const existingTagName =
        electronTest.generateE2ePrefixName("prompt_existing");
      await factory.createPromptFactory().createTag(existingTagName);

      // F5 刷新数据后打开标签管理器
      await electronTest.refreshData();
      await enterPromptTagManager(page);

      // 再次尝试创建同名标签
      await page.click(`#${Constants.Ids.ADD_PROMPT_TAG_IN_MANAGER_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });

      // 输入已存在的标签名
      const newTagName = electronTest.generateE2ePrefixName("prompt_new");
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, existingTagName);

      // 点击确定
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      // 验证对话框仍然保持打开
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });

      // 验证输入框保留之前的值
      const inputValue = await page.inputValue(
        `#${Constants.Ids.INPUT_MODAL_FIELD}`,
      );
      expect(inputValue).toBe(existingTagName);

      // 现在输入一个新的唯一标签名
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, newTagName);
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      // 验证标签创建成功
      await page.waitForFunction(
        async (name: string) => {
          const tags = await window.electronAPI.getAllTags();
          return tags.includes(name);
        },
        newTagName,
        { timeout: 1000 },
      );

      // 验证对话框关闭
      await expect(
        page.locator(`#${Constants.Ids.INPUT_MODAL}`),
      ).not.toBeVisible({ timeout: 1000 });

      // 验证新标签出现在列表中
      const newTagElement = page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${newTagName}"]`,
      );
      await expect(newTagElement).toBeVisible({ timeout: 1000 });

      await closePromptTagManager(page);
    });

    test("重命名标签时标签名已存在 - 对话框保持打开并保留输入", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();

      // 创建两个标签
      const factory = electronTest.getApiFactory();
      const tagName1 = electronTest.generateE2ePrefixName("prompt_rename1");
      const tagName2 = electronTest.generateE2ePrefixName("prompt_rename2");
      await factory.createPromptFactory().createTag(tagName1);
      await factory.createPromptFactory().createTag(tagName2);

      // F5 刷新数据后打开标签管理器
      await electronTest.refreshData();
      await enterPromptTagManager(page);

      // 点击编辑第一个标签
      const tagItem = page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName1}"]`,
      );
      await expect(tagItem).toBeVisible({ timeout: 1000 });
      const editBtn = tagItem.locator(".tag-edit-btn");
      await editBtn.click();

      // 等待输入对话框
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL}`, {
        state: "visible",
        timeout: 1000,
      });

      // 输入第二个标签的名称（已存在）
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, tagName2);

      // 点击确定
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      // 验证对话框仍然保持打开
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL}`, {
        state: "visible",
        timeout: 1500,
      });

      // 验证输入框保留之前的值
      const inputValue = await page.inputValue(
        `#${Constants.Ids.INPUT_MODAL_FIELD}`,
      );
      expect(inputValue).toBe(tagName2);

      // 现在输入一个新的唯一标签名
      const newTagName = electronTest.generateE2ePrefixName(
        "prompt_renamed_success",
      );
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, newTagName);
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      // 验证重命名成功
      await page.waitForFunction(
        async (params: { old: string; new: string }) => {
          const tags = await window.electronAPI.getAllTags();
          return !tags.includes(params.old) && tags.includes(params.new);
        },
        { old: tagName1, new: newTagName },
        { timeout: 1000 },
      );

      // 验证对话框关闭
      await expect(
        page.locator(`#${Constants.Ids.INPUT_MODAL}`),
      ).not.toBeVisible({ timeout: 1000 });

      // 验证新标签名出现在列表中
      const renamedTag = page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${newTagName}"]`,
      );
      await expect(renamedTag).toBeVisible({ timeout: 1000 });

      await closePromptTagManager(page);
    });

    test("新建标签组时名称重复 - 对话框保持打开并保留输入", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();

      // 创建一个已存在的标签组并添加一个标签（空标签组不显示）
      const factory = electronTest.getApiFactory();
      const { group } = await factory.createPromptFactory().createTagInGroup(
        "prompt_group_existing",
        "tag_in_group",
      );
      const existingGroupName = group.name;

      // F5 刷新数据后打开标签管理器
      await electronTest.refreshData();
      await enterPromptTagManager(page);

      // 再次尝试创建同名标签组
      await page.click(`#${Constants.Ids.ADD_PROMPT_TAG_GROUP_BTN}`);
      await page.waitForSelector(
        `#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_MODAL}`,
        { state: "visible", timeout: 1000 },
      );

      // 输入已存在的标签组名
      const newGroupName =
        electronTest.generateE2ePrefixName("prompt_group_new");
      await page.fill(
        `#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_NAME}`,
        existingGroupName,
      );

      // 点击保存
      await page.click(`#${Constants.Ids.SAVE_PROMPT_TAG_GROUP_BTN}`);

      // 验证对话框仍然保持打开
      await page.waitForSelector(
        `#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_MODAL}`,
        { state: "visible", timeout: 1000 },
      );

      // 验证输入框保留之前的值
      const inputValue = await page.inputValue(
        `#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_NAME}`,
      );
      expect(inputValue).toBe(existingGroupName);

      // 现在输入一个新的唯一标签组名
      await page.fill(
        `#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_NAME}`,
        newGroupName,
      );
      await page.click(`#${Constants.Ids.SAVE_PROMPT_TAG_GROUP_BTN}`);

      // 验证标签组创建成功
      const groupId = await page.waitForFunction(
        async (name: string) => {
          const groups = await window.electronAPI.getPromptTagGroups();
          const group = groups.find(
            (g: { name: string; id: number }) => g.name === name,
          );
          return group?.id;
        },
        newGroupName,
        { timeout: 1000 },
      );

      expect(groupId).toBeTruthy();

      // 验证对话框关闭
      await expect(
        page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_MODAL}`),
      ).not.toBeVisible({ timeout: 1000 });

      // 验证新标签组出现在列表中
      const newGroupCard = page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`,
      );
      await expect(newGroupCard).toBeVisible({ timeout: 1000 });

      await closePromptTagManager(page);
    });

    test("编辑标签组时名称重复 - 对话框保持打开并保留输入", async ({
      electronTest,
      page,
    }) => {
      await electronTest.logTestStart();

      // 创建两个标签组（带标签才能在UI中显示）
      const factory = electronTest.getApiFactory();
      const { group: group1 } = await factory.createPromptFactory().createTagInGroup(
        "prompt_edit_group1",
        "tag1",
      );
      const { group: group2 } = await factory.createPromptFactory().createTagInGroup(
        "prompt_edit_group2",
        "tag2",
      );
      const groupId1 = group1.id;
      const actualGroupName2 = group2.name;

      // F5 刷新数据后打开标签管理器
      await electronTest.refreshData();
      await enterPromptTagManager(page);

      // 点击编辑第一个标签组
      const groupCard = page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId1}"]`,
      );
      const editBtn = groupCard.locator(".tag-group-btn.edit");
      await editBtn.click();

      // 等待编辑对话框
      await page.waitForSelector(
        `#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_MODAL}`,
        { state: "visible", timeout: 1000 },
      );

      // 输入第二个标签组的名称（已存在）
      await page.fill(
        `#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_NAME}`,
        actualGroupName2,
      );

      // 点击保存
      await page.click(`#${Constants.Ids.SAVE_PROMPT_TAG_GROUP_BTN}`);

      // 验证对话框仍然保持打开
      await page.waitForSelector(
        `#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_MODAL}`,
        { state: "visible", timeout: 1000 },
      );

      // 验证输入框保留之前的值
      const inputValue = await page.inputValue(
        `#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_NAME}`,
      );
      expect(inputValue).toBe(actualGroupName2);

      // 现在输入一个新的唯一标签组名
      const newGroupName = electronTest.generateE2ePrefixName(
        "prompt_group_renamed_success",
      );
      await page.fill(
        `#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_NAME}`,
        newGroupName,
      );
      await page.click(`#${Constants.Ids.SAVE_PROMPT_TAG_GROUP_BTN}`);

      // 验证标签组重命名成功
      await page.waitForFunction(
        async (params: { id: number; name: string }) => {
          const groups = await window.electronAPI.getPromptTagGroups();
          const group = groups.find(
            (g: { id: number; name: string }) => g.id === params.id,
          );
          return group?.name === params.name;
        },
        { id: groupId1, name: newGroupName },
        { timeout: 1000 },
      );

      // 验证对话框关闭
      await expect(
        page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_MODAL}`),
      ).not.toBeVisible({ timeout: 1000 });

      // 验证新标签组名出现在列表中
      const renamedGroup = page.locator(
        `#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId1}"]`,
      );
      await expect(renamedGroup).toContainText(newGroupName);

      await closePromptTagManager(page);
    });
  });
});

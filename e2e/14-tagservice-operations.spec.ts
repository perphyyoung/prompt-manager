import { test, expect } from '@playwright/test';
import {
  createElectronTest,
  enterImageTagManager,
  enterPromptTagManager,
  closeImageTagManager,
  closePromptTagManager,
  createImageTagInManager,
  createPromptTagInManager,
  createImageTagGroup,
  createPromptTagGroup
} from './electron-test.ts';
import { Constants } from '../src/constants.ts';
import type { IElectronAPI } from '../src/preload/index.ts';

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

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
test.describe('TagService 操作测试', () => {
  const electronTest = createElectronTest();

  test.beforeAll(async () => {
    await electronTest.launch();
  });

  test.afterAll(async () => {
    await electronTest.close();
  });

  test.afterEach(async () => {
    await electronTest.cleanupAndReset();
  });

  // ========== 标签组管理测试 ==========

  test.describe('标签组管理', () => {
    test('图像标签组 - 创建、编辑、删除完整流程', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('图像标签组 - 创建、编辑、删除完整流程');
      await enterImageTagManager(page);

      // 1. 创建标签组
      const groupName = electronTest.generateTagName('group_create');
      const groupId = await createImageTagGroup(page, groupName);

      // 验证标签组创建成功
      const groupElement = page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`);
      await expect(groupElement).toBeVisible({ timeout: 5000 });

      // 2. 编辑标签组名称
      const newGroupName = electronTest.generateTagName('group_renamed');
      await groupElement.locator('.tag-group-btn.edit').click();

      // 等待编辑对话框
      await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL}`, { state: 'visible', timeout: 5000 });

      // 清空并输入新名称
      await page.fill(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_NAME}`, newGroupName);
      await page.click(`#${Constants.Ids.SAVE_IMAGE_TAG_GROUP_BTN}`);

      // 等待更新并通过 API 验证
      await page.waitForFunction(async (params: { id: number; name: string }) => {
        const groups = await window.electronAPI.getImageTagGroups();
        const group = groups.find((g: { id: number; name: string }) => g.id === params.id);
        return group?.name === params.name;
      }, { id: groupId, name: newGroupName }, { timeout: 5000 });

      // 验证标签组名称已更新
      const renamedGroup = page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`);
      await expect(renamedGroup).toContainText(newGroupName);

      // 3. 删除标签组
      await renamedGroup.locator('.tag-group-btn.delete').click();

      // 确认删除
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, { state: 'visible', timeout: 5000 });
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // 等待删除并通过 API 验证
      await page.waitForFunction(async (id: number) => {
        const groups = await window.electronAPI.getImageTagGroups();
        return !groups.some((g: { id: number }) => g.id === id);
      }, groupId, { timeout: 5000 });

      // 验证标签组已删除
      await expect(renamedGroup).not.toBeVisible({ timeout: 5000 });

      await closeImageTagManager(page);
    });

    test('提示词标签组 - 创建、编辑、删除完整流程', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('提示词标签组 - 创建、编辑、删除完整流程');
      await enterPromptTagManager(page);

      // 1. 创建标签组
      const groupName = electronTest.generateTagName('prompt_group');
      const groupId = await createPromptTagGroup(page, groupName);

      // 验证标签组创建成功
      const groupElement = page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`);
      await expect(groupElement).toBeVisible({ timeout: 5000 });

      // 2. 编辑标签组名称
      const newGroupName = electronTest.generateTagName('prompt_group_renamed');
      await groupElement.locator('.tag-group-btn.edit').click();

      // 等待编辑对话框
      await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_MODAL}`, { state: 'visible', timeout: 5000 });

      // 清空并输入新名称
      await page.fill(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_NAME}`, newGroupName);
      await page.click(`#${Constants.Ids.SAVE_PROMPT_TAG_GROUP_BTN}`);

      // 等待更新并通过 API 验证
      await page.waitForFunction(async (params: { id: number; name: string }) => {
        const groups = await window.electronAPI.getPromptTagGroups();
        const group = groups.find((g: { id: number; name: string }) => g.id === params.id);
        return group?.name === params.name;
      }, { id: groupId, name: newGroupName }, { timeout: 5000 });

      // 验证标签组名称已更新
      const renamedGroup = page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`);
      await expect(renamedGroup).toContainText(newGroupName);

      // 3. 删除标签组
      await renamedGroup.locator('.tag-group-btn.delete').click();

      // 确认删除
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, { state: 'visible', timeout: 5000 });
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // 等待删除并通过 API 验证
      await page.waitForFunction(async (id: number) => {
        const groups = await window.electronAPI.getPromptTagGroups();
        return !groups.some((g: { id: number }) => g.id === id);
      }, groupId, { timeout: 5000 });

      // 验证标签组已删除
      await expect(renamedGroup).not.toBeVisible({ timeout: 5000 });

      await closePromptTagManager(page);
    });
  });

  // ========== 标签分配到组测试 ==========

  test.describe('标签分配到组', () => {
    test('图像标签 - 创建并分配到组', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('图像标签 - 创建并分配到组');
      await enterImageTagManager(page);

      // 1. 创建标签组
      const groupName = electronTest.generateTagName('assign_group');
      const groupId = await createImageTagGroup(page, groupName);

      // 2. 创建标签并指定组
      const tagName = electronTest.generateTagName('tag_with_group');
      await page.click(`#${Constants.Ids.ADD_IMAGE_TAG_IN_MANAGER_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, { state: 'visible', timeout: 5000 });

      // 输入标签名
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, tagName);

      // 选择标签组
      await page.selectOption(`#${Constants.Ids.INPUT_MODAL_GROUP_SELECT}`, String(groupId));

      // 保存
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      // 等待标签创建成功
      await page.waitForFunction(async (name: string) => {
        const tags = await window.electronAPI.getImageTags();
        return tags.includes(name);
      }, tagName, { timeout: 5000 });

      // 验证标签创建成功
      await expect(page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName}"]`)).toBeVisible({ timeout: 5000 });

      // 验证标签在正确的组内
      const groupCard = page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`);
      await expect(groupCard.locator(`.tag-manager-item[data-tag="${tagName}"]`)).toBeVisible({ timeout: 5000 });

      await closeImageTagManager(page);
    });

    test('提示词标签 - 创建并分配到组', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('提示词标签 - 创建并分配到组');
      await enterPromptTagManager(page);

      // 1. 创建标签组
      const groupName = electronTest.generateTagName('prompt_assign_group');
      const groupId = await createPromptTagGroup(page, groupName);

      // 2. 创建标签并指定组
      const tagName = electronTest.generateTagName('prompt_tag_with_group');
      await page.click(`#${Constants.Ids.ADD_PROMPT_TAG_IN_MANAGER_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, { state: 'visible', timeout: 5000 });

      // 输入标签名
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, tagName);

      // 选择标签组
      await page.selectOption(`#${Constants.Ids.INPUT_MODAL_GROUP_SELECT}`, String(groupId));

      // 保存
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      // 等待标签创建成功
      await page.waitForFunction(async (name: string) => {
        const tags = await window.electronAPI.getAllTags();
        return tags.includes(name);
      }, tagName, { timeout: 5000 });

      // 验证标签创建成功
      await expect(page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName}"]`)).toBeVisible({ timeout: 5000 });

      // 验证标签在正确的组内
      const groupCard = page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`);
      await expect(groupCard.locator(`.tag-manager-item[data-tag="${tagName}"]`)).toBeVisible({ timeout: 5000 });

      await closePromptTagManager(page);
    });
  });

  // ========== 标签重命名测试 ==========

  test.describe('标签重命名', () => {
    test('图像标签 - 重命名标签', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('图像标签 - 重命名标签');
      await enterImageTagManager(page);

      // 1. 创建标签
      const originalTagName = electronTest.generateTagName('original');
      await createImageTagInManager(page, originalTagName);

      // 验证标签创建成功
      const tagElement = page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${originalTagName}"]`);
      await expect(tagElement).toBeVisible({ timeout: 5000 });

      // 2. 重命名标签（点击编辑按钮）
      const newTagName = electronTest.generateTagName('renamed');
      await tagElement.locator('.tag-edit-btn').click();

      // 等待重命名对话框显示
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL}`, { state: 'visible', timeout: 5000 });
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, { state: 'visible', timeout: 5000 });

      // 输入新名称
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, newTagName);
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      // 等待重命名完成
      await page.waitForFunction(async (params: { old: string; new: string }) => {
        const tags = await window.electronAPI.getImageTags();
        return !tags.includes(params.old) && tags.includes(params.new);
      }, { old: originalTagName, new: newTagName }, { timeout: 5000 });

      // 验证标签已重命名
      await expect(page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${newTagName}"]`)).toBeVisible({ timeout: 5000 });
      await expect(page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${originalTagName}"]`)).not.toBeVisible({ timeout: 5000 });

      // 通过 API 验证
      const tags = await page.evaluate(async () => {
        return await window.electronAPI.getImageTags();
      });
      expect(tags).toContain(newTagName);
      expect(tags).not.toContain(originalTagName);

      await closeImageTagManager(page);
    });

    test('提示词标签 - 重命名标签', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('提示词标签 - 重命名标签');
      await enterPromptTagManager(page);

      // 1. 创建标签
      const originalTagName = electronTest.generateTagName('prompt_original');
      await createPromptTagInManager(page, originalTagName);

      // 验证标签创建成功
      const tagElement = page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${originalTagName}"]`);
      await expect(tagElement).toBeVisible({ timeout: 5000 });

      // 2. 重命名标签（点击编辑按钮）
      const newTagName = electronTest.generateTagName('prompt_renamed');
      await tagElement.locator('.tag-edit-btn').click();

      // 等待重命名对话框显示
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL}`, { state: 'visible', timeout: 5000 });
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, { state: 'visible', timeout: 5000 });

      // 输入新名称
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, newTagName);
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      // 等待重命名完成
      await page.waitForFunction(async (params: { old: string; new: string }) => {
        const tags = await window.electronAPI.getPromptTags();
        return !tags.includes(params.old) && tags.includes(params.new);
      }, { old: originalTagName, new: newTagName }, { timeout: 5000 });

      // 验证标签已重命名
      await expect(page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${newTagName}"]`)).toBeVisible({ timeout: 5000 });
      await expect(page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${originalTagName}"]`)).not.toBeVisible({ timeout: 5000 });

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

  test.describe('标签搜索功能', () => {
    test('图像标签管理器 - 搜索标签', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('图像标签管理器 - 搜索标签');
      await enterImageTagManager(page);

      // 创建测试标签
      const searchTagName = electronTest.generateTagName('search_test');
      await createImageTagInManager(page, searchTagName);

      // 创建另一个标签作为对照
      const otherTagName = electronTest.generateTagName('other_tag');
      await createImageTagInManager(page, otherTagName);

      // 搜索特定标签
      await page.fill(`#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`, 'search_test');

      // 验证搜索结果
      await page.waitForFunction(
        (params: { containerId: string; tagName: string; otherTag: string }) => {
          const items = document.querySelectorAll(`#${params.containerId} .tag-manager-item`);
          const hasTargetTag = Array.from(items).some(item =>
            item.getAttribute('data-tag')?.includes('search_test')
          );
          const hasOtherTag = Array.from(items).some(item =>
            item.getAttribute('data-tag') === params.otherTag
          );
          return hasTargetTag && !hasOtherTag;
        },
        { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, tagName: searchTagName, otherTag: otherTagName },
        { timeout: 5000 }
      );

      // 清除搜索
      await page.click(`#${Constants.Ids.CLEAR_IMAGE_TAG_MANAGER_SEARCH_BTN}`);

      // 验证所有标签都显示
      await expect(page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${searchTagName}"]`)).toBeVisible({ timeout: 5000 });
      await expect(page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${otherTagName}"]`)).toBeVisible({ timeout: 5000 });

      await closeImageTagManager(page);
    });

    test('提示词标签管理器 - 搜索标签', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('提示词标签管理器 - 搜索标签');
      await enterPromptTagManager(page);

      // 创建测试标签
      const searchTagName = electronTest.generateTagName('prompt_search');
      await createPromptTagInManager(page, searchTagName);

      // 创建另一个标签作为对照
      const otherTagName = electronTest.generateTagName('prompt_other');
      await createPromptTagInManager(page, otherTagName);

      // 搜索特定标签
      await page.fill(`#${Constants.Ids.PROMPT_TAG_MANAGER_SEARCH_INPUT}`, 'prompt_search');

      // 验证搜索结果
      await page.waitForFunction(
        (params: { containerId: string; tagName: string; otherTag: string }) => {
          const items = document.querySelectorAll(`#${params.containerId} .tag-manager-item`);
          const hasTargetTag = Array.from(items).some(item =>
            item.getAttribute('data-tag')?.includes('prompt_search')
          );
          const hasOtherTag = Array.from(items).some(item =>
            item.getAttribute('data-tag') === params.otherTag
          );
          return hasTargetTag && !hasOtherTag;
        },
        { containerId: Constants.Ids.PROMPT_TAG_GROUP_CARDS, tagName: searchTagName, otherTag: otherTagName },
        { timeout: 5000 }
      );

      // 清除搜索
      await page.click(`#${Constants.Ids.CLEAR_PROMPT_TAG_MANAGER_SEARCH_BTN}`);

      // 验证所有标签都显示
      await expect(page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${searchTagName}"]`)).toBeVisible({ timeout: 5000 });
      await expect(page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${otherTagName}"]`)).toBeVisible({ timeout: 5000 });

      await closePromptTagManager(page);
    });
  });

  // ========== 批量标签操作测试 ==========

  test.describe('批量标签操作', () => {
    test('图像标签 - 批量删除', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('图像标签 - 批量删除');
      await enterImageTagManager(page);

      // 创建多个测试标签（使用相同前缀以便搜索）
      const searchPrefix = 'batch_delete_test';
      const tagName1 = electronTest.generateTagName(searchPrefix);
      const tagName2 = electronTest.generateTagName(searchPrefix);
      const controlTagName = electronTest.generateTagName('control_not_deleted');

      await createImageTagInManager(page, tagName1);
      await createImageTagInManager(page, tagName2);
      await createImageTagInManager(page, controlTagName);

      // 搜索特定前缀的标签
      await page.fill(`#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`, searchPrefix);

      // 等待搜索过滤完成
      await page.waitForFunction(
        (params: { containerId: string; keyword: string }) => {
          const items = document.querySelectorAll(`#${params.containerId} .tag-manager-item`);
          return items.length >= 2 && Array.from(items).every(item =>
            item.getAttribute('data-tag')?.includes(params.keyword)
          );
        },
        { containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS, keyword: searchPrefix },
        { timeout: 5000 }
      );

      // 进入批量模式
      await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-batch-checkbox`, { state: 'visible', timeout: 5000 });

      // 全选
      const batchToolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
      await batchToolbar.locator('.batch-action-select-all').click();

      // 验证选中数量
      await page.waitForFunction(
        (keyword: string) => {
          const checkedBoxes = document.querySelectorAll('.tag-batch-checkbox:checked');
          const selectedTags = Array.from(checkedBoxes).map(cb => cb.getAttribute('data-tag'));
          return selectedTags.every(tag => tag?.includes(keyword));
        },
        searchPrefix,
        { timeout: 5000 }
      );

      // 执行删除
      await batchToolbar.locator('.batch-action-delete').click();

      // 确认删除
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, { state: 'visible', timeout: 5000 });
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // 验证标签已删除
      await page.waitForFunction(async (names: string[]) => {
        const tags = await window.electronAPI.getImageTags();
        return !tags.includes(names[0]) && !tags.includes(names[1]);
      }, [tagName1, tagName2], { timeout: 5000 });

      // 清除搜索，验证对照组标签仍然存在
      await page.click(`#${Constants.Ids.CLEAR_IMAGE_TAG_MANAGER_SEARCH_BTN}`);
      await expect(page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${controlTagName}"]`)).toBeVisible({ timeout: 5000 });

      await closeImageTagManager(page);
    });

    test('提示词标签 - 批量删除', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('提示词标签 - 批量删除');
      await enterPromptTagManager(page);

      // 创建多个测试标签（使用相同前缀以便搜索）
      const searchPrefix = 'prompt_batch_delete';
      const tagName1 = electronTest.generateTagName(searchPrefix);
      const tagName2 = electronTest.generateTagName(searchPrefix);
      const controlTagName = electronTest.generateTagName('prompt_control');

      await createPromptTagInManager(page, tagName1);
      await createPromptTagInManager(page, tagName2);
      await createPromptTagInManager(page, controlTagName);

      // 搜索特定前缀的标签
      await page.fill(`#${Constants.Ids.PROMPT_TAG_MANAGER_SEARCH_INPUT}`, searchPrefix);

      // 等待搜索过滤完成
      await page.waitForFunction(
        (params: { containerId: string; keyword: string }) => {
          const items = document.querySelectorAll(`#${params.containerId} .tag-manager-item`);
          return items.length >= 2 && Array.from(items).every(item =>
            item.getAttribute('data-tag')?.includes(params.keyword)
          );
        },
        { containerId: Constants.Ids.PROMPT_TAG_GROUP_CARDS, keyword: searchPrefix },
        { timeout: 5000 }
      );

      // 进入批量模式
      await page.click(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-batch-checkbox`, { state: 'visible', timeout: 5000 });

      // 全选
      const batchToolbar = page.locator(`#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`);
      await batchToolbar.locator('.batch-action-select-all').click();

      // 验证选中数量
      await page.waitForFunction(
        (keyword: string) => {
          const checkedBoxes = document.querySelectorAll('.tag-batch-checkbox:checked');
          const selectedTags = Array.from(checkedBoxes).map(cb => cb.getAttribute('data-tag'));
          return selectedTags.every(tag => tag?.includes(keyword));
        },
        searchPrefix,
        { timeout: 5000 }
      );

      // 执行删除
      await batchToolbar.locator('.batch-action-delete').click();

      // 确认删除
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, { state: 'visible', timeout: 5000 });
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // 验证标签已删除
      await page.waitForFunction(async (names: string[]) => {
        const tags = await window.electronAPI.getAllTags();
        return !tags.includes(names[0]) && !tags.includes(names[1]);
      }, [tagName1, tagName2], { timeout: 5000 });

      // 清除搜索，验证对照组标签仍然存在
      await page.click(`#${Constants.Ids.CLEAR_PROMPT_TAG_MANAGER_SEARCH_BTN}`);
      await expect(page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${controlTagName}"]`)).toBeVisible({ timeout: 5000 });

      await closePromptTagManager(page);
    });
  });
});

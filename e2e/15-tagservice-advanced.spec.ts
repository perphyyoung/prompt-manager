import { test, expect } from '@playwright/test';
import {
  createElectronTest,
  enterImageDetailView,
  enterPromptDetailView,
  enterImageTagManager,
  enterPromptTagManager,
  closeImageTagManager,
  closePromptTagManager,
  createImageTagInManager,
  createPromptTagInManager,
  createImageTagGroup,
  createPromptTagGroup,
  getImageFromDatabase,
  getPromptFromDatabase
} from './electron-test.ts';

import { Constants } from '../src/constants.ts';
import type { IElectronAPI } from '../src/preload/index.ts';

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

/**
 * TagService 高级功能 E2E 测试
 * 补充测试 TagService 中未被其他测试文件覆盖的功能：
 * 1. unlinkTagFromItem - 从项目移除标签（详情界面删除标签）
 * 2. 标签存在检查（通过 getImageTags/getAllTags 模拟）
 * 3. 获取组内标签（通过 getImageTagGroups 模拟）
 * 4. parseTagInput - 标签输入解析
 * 5. updated_at 字段更新验证
 */
test.describe('TagService 高级功能测试', () => {
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

  // ========== 详情界面标签删除测试（unlinkTagFromItem） ==========

  test.describe('详情界面标签删除', () => {
    test('图像详情界面 - 删除已关联的标签', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('图像详情界面 - 删除已关联的标签');

      // 1. 进入图像详情界面
      const { firstImageId } = await enterImageDetailView(page);

      // 2. 创建一个测试标签并添加到当前图像
      const testTagName = electronTest.generateTagName('detail_unlink');
      await page.fill(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, testTagName);
      await page.press(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, 'Enter');

      // 等待标签添加成功
      await expect(
        page.locator(`#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${testTagName}"]`)
      ).toBeVisible({ timeout: 5000 });

      // 3. 记录添加标签前的时间戳
      const imageBefore = await getImageFromDatabase(page, firstImageId);
      const updatedAtBefore = imageBefore?.updatedAt;

      // 4. 点击标签上的删除按钮（X按钮）
      const tagElement = page.locator(`#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-removable[data-tag="${testTagName}"]`);
      await expect(tagElement).toBeVisible({ timeout: 5000 });
      const deleteBtn = tagElement.locator('.tag-remove-btn');
      await expect(deleteBtn).toBeVisible({ timeout: 5000 });
      await deleteBtn.click();

      // 5. 等待确认对话框并确认
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, { state: 'visible', timeout: 5000 });
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // 6. 验证标签已从界面移除
      await expect(
        page.locator(`#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-removable[data-tag="${testTagName}"]`)
      ).not.toBeVisible({ timeout: 5000 });

      // 7. 通过 API 验证标签已从图像移除
      const imageAfter = await getImageFromDatabase(page, firstImageId);
      expect(imageAfter?.tags).not.toContain(testTagName);

      // 8. 验证 updated_at 已更新
      expect(imageAfter?.updatedAt).not.toBe(updatedAtBefore);

      await page.screenshot({ path: 'test-results/tagservice-advanced/image-detail-tag-unlinked.png' });
    });

    test('提示词详情界面 - 删除已关联的标签', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('提示词详情界面 - 删除已关联的标签');

      // 1. 进入提示词详情界面
      const { firstPromptId } = await enterPromptDetailView(page);

      // 2. 创建一个测试标签并添加到当前提示词
      const testTagName = electronTest.generateTagName('prompt_unlink');
      await page.fill(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, testTagName);
      await page.press(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, 'Enter');

      // 等待标签添加成功
      await expect(
        page.locator(`#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${testTagName}"]`)
      ).toBeVisible({ timeout: 5000 });

      // 3. 记录添加标签前的时间戳
      const promptBefore = await getPromptFromDatabase(page, firstPromptId);
      const updatedAtBefore = promptBefore?.updatedAt;

      // 4. 点击标签上的删除按钮（X按钮）
      const tagElement = page.locator(`#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-removable[data-tag="${testTagName}"]`);
      await expect(tagElement).toBeVisible({ timeout: 5000 });
      const deleteBtn = tagElement.locator('.tag-remove-btn');
      await expect(deleteBtn).toBeVisible({ timeout: 5000 });
      await deleteBtn.click();

      // 5. 等待确认对话框并确认
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, { state: 'visible', timeout: 5000 });
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // 6. 验证标签已从界面移除
      await expect(
        page.locator(`#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-removable[data-tag="${testTagName}"]`)
      ).not.toBeVisible({ timeout: 5000 });

      // 7. 通过 API 验证标签已从提示词移除
      const promptAfter = await getPromptFromDatabase(page, firstPromptId);
      expect(promptAfter?.tags).not.toContain(testTagName);

      // 8. 验证 updated_at 已更新
      expect(promptAfter?.updatedAt).not.toBe(updatedAtBefore);

      await page.screenshot({ path: 'test-results/tagservice-advanced/prompt-detail-tag-unlinked.png' });
    });
  });

  // ========== 标签存在检查测试（通过 API 模拟 tagExists） ==========

  test.describe('标签存在检查', () => {
    test('图像标签 - 检查标签是否存在', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('图像标签 - 检查标签是否存在');

      await enterImageTagManager(page);

      // 1. 创建一个测试标签
      const existingTagName = electronTest.generateTagName('exists_test');
      await createImageTagInManager(page, existingTagName);

      // 2. 通过 API 检查标签存在性（模拟 tagExists）
      const existsResult = await page.evaluate(async (tagName: string) => {
        const tags = await window.electronAPI.getImageTags();
        return tags.includes(tagName);
      }, existingTagName);

      expect(existsResult).toBe(true);

      // 3. 检查一个不存在的标签
      const nonExistentTag = electronTest.generateTagName('non_existent');
      const notExistsResult = await page.evaluate(async (tagName: string) => {
        const tags = await window.electronAPI.getImageTags();
        return tags.includes(tagName);
      }, nonExistentTag);

      expect(notExistsResult).toBe(false);

      await closeImageTagManager(page);
    });

    test('提示词标签 - 检查标签是否存在', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('提示词标签 - 检查标签是否存在');

      await enterPromptTagManager(page);

      // 1. 创建一个测试标签
      const existingTagName = electronTest.generateTagName('prompt_exists');
      await createPromptTagInManager(page, existingTagName);

      // 2. 通过 API 检查标签存在性（模拟 tagExists）
      const existsResult = await page.evaluate(async (tagName: string) => {
        const tags = await window.electronAPI.getAllTags();
        return tags.includes(tagName);
      }, existingTagName);

      expect(existsResult).toBe(true);

      // 3. 检查一个不存在的标签
      const nonExistentTag = electronTest.generateTagName('prompt_non_existent');
      const notExistsResult = await page.evaluate(async (tagName: string) => {
        const tags = await window.electronAPI.getAllTags();
        return tags.includes(tagName);
      }, nonExistentTag);

      expect(notExistsResult).toBe(false);

      await closePromptTagManager(page);
    });
  });

  // ========== 获取组内标签测试（通过 API 模拟 getTagsByGroup） ==========

  test.describe('获取组内标签', () => {
    test('图像标签组 - 获取组内所有标签', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('图像标签组 - 获取组内所有标签');

      await enterImageTagManager(page);

      // 1. 创建标签组
      const groupName = electronTest.generateTagName('group_with_tags');
      const groupId = await createImageTagGroup(page, groupName);

      // 2. 创建多个标签并分配到该组
      const tagName1 = electronTest.generateTagName('in_group_1');
      const tagName2 = electronTest.generateTagName('in_group_2');

      await createImageTagInManager(page, tagName1, String(groupId));
      await createImageTagInManager(page, tagName2, String(groupId));

      // 3. 通过 API 获取组内标签（模拟 getTagsByGroup）
      const tagsInGroup = await page.evaluate(async (gid: number) => {
        const groups = await window.electronAPI.getImageTagGroups();
        const group = groups.find(g => g.id === gid);
        return group?.tags || [];
      }, groupId);

      // 4. 验证组内包含创建的标签
      expect(tagsInGroup).toContain(tagName1);
      expect(tagsInGroup).toContain(tagName2);

      await closeImageTagManager(page);
    });

    test('提示词标签组 - 获取组内所有标签', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('提示词标签组 - 获取组内所有标签');

      await enterPromptTagManager(page);

      // 1. 创建标签组
      const groupName = electronTest.generateTagName('prompt_group_tags');
      const groupId = await createPromptTagGroup(page, groupName);

      // 2. 创建多个标签并分配到该组
      const tagName1 = electronTest.generateTagName('prompt_in_group_1');
      const tagName2 = electronTest.generateTagName('prompt_in_group_2');

      await createPromptTagInManager(page, tagName1, String(groupId));
      await createPromptTagInManager(page, tagName2, String(groupId));

      // 3. 通过 API 获取组内标签（模拟 getTagsByGroup）
      const tagsInGroup = await page.evaluate(async (gid: number) => {
        const groups = await window.electronAPI.getPromptTagGroups();
        const group = groups.find(g => g.id === gid);
        return group?.tags || [];
      }, groupId);

      // 4. 验证组内包含创建的标签
      expect(tagsInGroup).toContain(tagName1);
      expect(tagsInGroup).toContain(tagName2);

      await closePromptTagManager(page);
    });
  });

  // ========== 标签输入解析测试（parseTagInput） ==========

  test.describe('标签输入解析', () => {
    test('图像标签 - 解析多种分隔符的输入', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('图像标签 - 解析多种分隔符的输入');

      await enterImageDetailView(page);

      // 测试用例：空格分隔
      const tag1 = electronTest.generateTagName('space');
      const tag2 = electronTest.generateTagName('space');
      await page.fill(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, `${tag1} ${tag2}`);
      await page.press(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, 'Enter');

      // 验证两个标签都被添加
      await expect(
        page.locator(`#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag1}"]`)
      ).toBeVisible({ timeout: 5000 });
      await expect(
        page.locator(`#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag2}"]`)
      ).toBeVisible({ timeout: 5000 });

      await page.screenshot({ path: 'test-results/tagservice-advanced/image-parse-space.png' });
    });

    test('提示词标签 - 解析多种分隔符的输入', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('提示词标签 - 解析多种分隔符的输入');

      await enterPromptDetailView(page);

      // 测试用例：英文逗号分隔
      const tag1 = electronTest.generateTagName('comma1');
      const tag2 = electronTest.generateTagName('comma2');
      await page.fill(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, `${tag1},${tag2}`);
      await page.press(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, 'Enter');

      // 验证两个标签都被添加
      await expect(
        page.locator(`#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag1}"]`)
      ).toBeVisible({ timeout: 5000 });
      await expect(
        page.locator(`#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag2}"]`)
      ).toBeVisible({ timeout: 5000 });

      await page.screenshot({ path: 'test-results/tagservice-advanced/prompt-parse-comma.png' });
    });

    test('图像标签 - 解析中文逗号分隔', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('图像标签 - 解析中文逗号分隔');

      await enterImageDetailView(page);

      // 测试用例：中文逗号分隔（图像标签也支持中文逗号）
      const tag1 = electronTest.generateTagName('cncomma1');
      const tag2 = electronTest.generateTagName('cncomma2');
      await page.fill(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, `${tag1}，${tag2}`);
      await page.press(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, 'Enter');

      // 验证两个标签都被添加
      await expect(
        page.locator(`#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag1}"]`)
      ).toBeVisible({ timeout: 5000 });
      await expect(
        page.locator(`#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag2}"]`)
      ).toBeVisible({ timeout: 5000 });

      await page.screenshot({ path: 'test-results/tagservice-advanced/image-parse-cn-comma.png' });
    });

    test('提示词标签 - 解析中文逗号分隔', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('提示词标签 - 解析中文逗号分隔');

      await enterPromptDetailView(page);

      // 测试用例：中文逗号分隔
      const tag1 = electronTest.generateTagName('cncomma1');
      const tag2 = electronTest.generateTagName('cncomma2');
      await page.fill(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, `${tag1}，${tag2}`);
      await page.press(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, 'Enter');

      // 验证两个标签都被添加
      await expect(
        page.locator(`#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag1}"]`)
      ).toBeVisible({ timeout: 5000 });
      await expect(
        page.locator(`#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag2}"]`)
      ).toBeVisible({ timeout: 5000 });

      await page.screenshot({ path: 'test-results/tagservice-advanced/prompt-parse-cn-comma.png' });
    });
  });

  // ========== updated_at 更新验证测试 ==========

  test.describe('updated_at 字段更新验证', () => {
    test('图像 - 添加标签时 updated_at 更新', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('图像 - 添加标签时 updated_at 更新');

      // 1. 进入图像详情界面
      const { firstImageId } = await enterImageDetailView(page);

      // 2. 获取当前 updated_at
      const imageBefore = await getImageFromDatabase(page, firstImageId);
      const updatedAtBefore = imageBefore?.updatedAt;

      // 3. 添加新标签
      const testTagName = electronTest.generateTagName('updated_at_test');
      await page.fill(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, testTagName);
      await page.press(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, 'Enter');

      // 等待标签添加成功
      await expect(
        page.locator(`#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${testTagName}"]`)
      ).toBeVisible({ timeout: 5000 });

      // 4. 验证 updated_at 已更新
      const imageAfter = await getImageFromDatabase(page, firstImageId);
      expect(imageAfter?.updatedAt).not.toBe(updatedAtBefore);
      expect(new Date(imageAfter?.updatedAt || '').getTime()).toBeGreaterThan(
        new Date(updatedAtBefore || '').getTime()
      );

      await page.screenshot({ path: 'test-results/tagservice-advanced/image-updated-at-on-add.png' });
    });

    test('提示词 - 添加标签时 updated_at 更新', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('提示词 - 添加标签时 updated_at 更新');

      // 1. 进入提示词详情界面
      const { firstPromptId } = await enterPromptDetailView(page);

      // 2. 获取当前 updated_at
      const promptBefore = await getPromptFromDatabase(page, firstPromptId);
      const updatedAtBefore = promptBefore?.updatedAt;

      // 3. 添加新标签
      const testTagName = electronTest.generateTagName('prompt_updated_at');
      await page.fill(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, testTagName);
      await page.press(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, 'Enter');

      // 等待标签添加成功
      await expect(
        page.locator(`#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${testTagName}"]`)
      ).toBeVisible({ timeout: 5000 });

      // 4. 验证 updated_at 已更新
      const promptAfter = await getPromptFromDatabase(page, firstPromptId);
      expect(promptAfter?.updatedAt).not.toBe(updatedAtBefore);
      expect(new Date(promptAfter?.updatedAt || '').getTime()).toBeGreaterThan(
        new Date(updatedAtBefore || '').getTime()
      );

      await page.screenshot({ path: 'test-results/tagservice-advanced/prompt-updated-at-on-add.png' });
    });

    test('图像 - 批量添加标签时 updated_at 更新', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('图像 - 批量添加标签时 updated_at 更新');

      // 1. 进入图像详情界面
      const { firstImageId } = await enterImageDetailView(page);

      // 2. 获取当前 updated_at
      const imageBefore = await getImageFromDatabase(page, firstImageId);
      const updatedAtBefore = imageBefore?.updatedAt;

      // 3. 批量添加多个标签（空格分隔）
      const tag1 = electronTest.generateTagName('batch1');
      const tag2 = electronTest.generateTagName('batch2');
      const tag3 = electronTest.generateTagName('batch3');
      await page.fill(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, `${tag1} ${tag2} ${tag3}`);
      await page.press(`#${Constants.Ids.IMAGE_DETAIL_TAG_INPUT}`, 'Enter');

      // 等待所有标签添加成功
      await expect(
        page.locator(`#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag1}"]`)
      ).toBeVisible({ timeout: 5000 });

      // 4. 验证 updated_at 已更新
      const imageAfter = await getImageFromDatabase(page, firstImageId);
      expect(imageAfter?.updatedAt).not.toBe(updatedAtBefore);

      // 5. 验证所有标签都已关联
      expect(imageAfter?.tags).toContain(tag1);
      expect(imageAfter?.tags).toContain(tag2);
      expect(imageAfter?.tags).toContain(tag3);

      await page.screenshot({ path: 'test-results/tagservice-advanced/image-batch-updated-at.png' });
    });

    test('提示词 - 批量添加标签时 updated_at 更新', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('提示词 - 批量添加标签时 updated_at 更新');

      // 1. 进入提示词详情界面
      const { firstPromptId } = await enterPromptDetailView(page);

      // 2. 获取当前 updated_at
      const promptBefore = await getPromptFromDatabase(page, firstPromptId);
      const updatedAtBefore = promptBefore?.updatedAt;

      // 3. 批量添加多个标签（逗号分隔）
      const tag1 = electronTest.generateTagName('pbatch1');
      const tag2 = electronTest.generateTagName('pbatch2');
      await page.fill(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, `${tag1},${tag2}`);
      await page.press(`#${Constants.Ids.PROMPT_DETAIL_TAGS_INPUT}`, 'Enter');

      // 等待所有标签添加成功
      await expect(
        page.locator(`#${Constants.Ids.PROMPT_DETAIL_TAGS_CONTAINER} .tag-editable[data-tag="${tag1}"]`)
      ).toBeVisible({ timeout: 5000 });

      // 4. 验证 updated_at 已更新
      const promptAfter = await getPromptFromDatabase(page, firstPromptId);
      expect(promptAfter?.updatedAt).not.toBe(updatedAtBefore);

      // 5. 验证所有标签都已关联
      expect(promptAfter?.tags).toContain(tag1);
      expect(promptAfter?.tags).toContain(tag2);

      await page.screenshot({ path: 'test-results/tagservice-advanced/prompt-batch-updated-at.png' });
    });
  });
});

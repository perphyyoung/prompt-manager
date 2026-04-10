import { test, expect } from '@playwright/test';
import { createElectronTest } from './electron-test.ts';
import type { IElectronAPI } from '../src/preload/index.ts';
import { Constants } from '../src/constants.ts';

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

/**
 * 标签管理功能 E2E 测试
 *
 * 测试场景：
 * 1. 图像标签管理 - 非批量功能
 *    - 打开/关闭标签管理器
 *    - 新建标签
 *    - 编辑标签（重命名）
 *    - 删除标签
 *    - 搜索标签
 *    - 排序标签
 *    - 新建标签组
 *    - 编辑标签组
 *    - 删除标签组
 * 2. 图像标签管理 - 批量功能
 *    - 进入/退出批量模式
 *    - 全选/反选标签
 *    - 批量删除标签
 *    - 批量移动到组
 * 3. 提示词标签管理 - 非批量功能
 * 4. 提示词标签管理 - 批量功能
 */
test.describe('标签管理功能', () => {
  const electronTest = createElectronTest();

  test.beforeAll(async () => {
    await electronTest.launch();
  });

  test.afterAll(async () => {
    await electronTest.close();
  });

  /**
   * 生成唯一测试标签名
   */
  function generateTestTagName(prefix: string): string {
    return `e2e_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  /**
 * 进入图像面板并打开标签管理器
 * Steps to enter target interface:
 * 1. Click imageManagerBtn to switch to image panel
 * 2. Wait for imagePanel to be visible
 * 3. Click imageTagManagerBtn to open tag manager
 * 4. Wait for imageTagManagerModal to be visible
 */
  async function enterImageTagManager(page: any) {
    await page.click(`#${Constants.Ids.IMAGE_MANAGER_BTN}`);
    await page.waitForSelector(`#${Constants.Ids.IMAGE_PANEL}`, { state: 'visible', timeout: 5000 });
    await page.screenshot({ path: 'test-results/tag-manager/image-01-panel.png' });

    await page.click(`#${Constants.Ids.IMAGE_TAG_MANAGER_BTN}`);
    await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_MANAGER_MODAL}`, { state: 'visible', timeout: 5000 });
    await page.screenshot({ path: 'test-results/tag-manager/image-02-manager-opened.png' });
  }

  /**
 * 进入提示词面板并打开标签管理器
 * Steps to enter target interface:
 * 1. Click promptManagerBtn to switch to prompt panel
 * 2. Wait for promptPanel to be visible
 * 3. Click promptTagManagerBtn to open tag manager
 * 4. Wait for promptTagManagerModal to be visible
 */
  async function enterPromptTagManager(page: any) {
    await page.click(`#${Constants.Ids.PROMPT_MANAGER_BTN}`);
    await page.waitForSelector(`#${Constants.Ids.PROMPT_PANEL}`, { state: 'visible', timeout: 5000 });
    await page.screenshot({ path: 'test-results/tag-manager/prompt-01-panel.png' });

    await page.click(`#${Constants.Ids.PROMPT_TAG_MANAGER_BTN}`);
    await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_MANAGER_MODAL}`, { state: 'visible', timeout: 5000 });
    await page.screenshot({ path: 'test-results/tag-manager/prompt-02-manager-opened.png' });
  }

  /**
 * 关闭图像标签管理器
 */
  async function closeImageTagManager(page: any) {
    await page.click(`#${Constants.Ids.CLOSE_IMAGE_TAG_MANAGER_MODAL}`);
    await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_MANAGER_MODAL}`, { state: 'hidden', timeout: 5000 });
    await page.screenshot({ path: 'test-results/tag-manager/image-manager-closed.png' });
  }

  /**
   * 关闭提示词标签管理器
   */
  async function closePromptTagManager(page: any) {
    await page.click(`#${Constants.Ids.CLOSE_PROMPT_TAG_MANAGER_MODAL}`);
    await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_MANAGER_MODAL}`, { state: 'hidden', timeout: 5000 });
    await page.screenshot({ path: 'test-results/tag-manager/prompt-manager-closed.png' });
  }

  /**
 * 在图像标签管理器中创建标签
 */
  async function createImageTagInManager(page: any, tagName: string, groupId: string = ''): Promise<void> {
    await page.click(`#${Constants.Ids.ADD_IMAGE_TAG_IN_MANAGER_BTN}`);
    await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, { state: 'visible', timeout: 5000 });
    await page.screenshot({ path: `test-results/tag-manager/image-input-dialog-${tagName.slice(0, 10)}.png` });

    await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, tagName);

    if (groupId) {
      await page.selectOption(`#${Constants.Ids.INPUT_MODAL_GROUP_SELECT}`, groupId);
    }

    await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

    // Wait for tag to be created via API
    await page.waitForFunction(async (name: string) => {
      const tags = await window.electronAPI.getImageTags();
      return tags.includes(name);
    }, tagName, { timeout: 5000 });

    await page.screenshot({ path: `test-results/tag-manager/image-tag-created-${tagName.slice(0, 10)}.png` });
  }

  /**
 * 在提示词标签管理器中创建标签
 */
  async function createPromptTagInManager(page: any, tagName: string, groupId: string = ''): Promise<void> {
    await page.click(`#${Constants.Ids.ADD_PROMPT_TAG_IN_MANAGER_BTN}`);
    await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, { state: 'visible', timeout: 5000 });
    await page.screenshot({ path: `test-results/tag-manager/prompt-input-dialog-${tagName.slice(0, 10)}.png` });

    await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, tagName);

    if (groupId) {
      await page.selectOption(`#${Constants.Ids.INPUT_MODAL_GROUP_SELECT}`, groupId);
    }

    await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

    // Wait for tag to be created via API
    await page.waitForFunction(async (name: string) => {
      const tags = await window.electronAPI.getAllTags();
      return tags.includes(name);
    }, tagName, { timeout: 5000 });

    await page.screenshot({ path: `test-results/tag-manager/prompt-tag-created-${tagName.slice(0, 10)}.png` });
  }

  /**
 * 在图像标签管理器中创建标签组
 */
  async function createImageTagGroup(page: any, groupName: string): Promise<number> {
    await page.click(`#${Constants.Ids.ADD_IMAGE_TAG_GROUP_BTN}`);
    await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL}`, { state: 'visible', timeout: 5000 });
    await page.screenshot({ path: `test-results/tag-manager/image-group-dialog-${groupName.slice(0, 10)}.png` });

    await page.fill(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_NAME}`, groupName);
    await page.click(`#${Constants.Ids.SAVE_IMAGE_TAG_GROUP_BTN}`);

    // Wait for group to be created via API
    const groupId = await page.waitForFunction(async (name: string) => {
      const groups = await window.electronAPI.getImageTagGroups();
      const group = groups.find((g: { name: string; id: number }) => g.name === name);
      return group?.id;
    }, groupName, { timeout: 5000 });

    await page.screenshot({ path: `test-results/tag-manager/image-group-created-${groupName.slice(0, 10)}.png` });

    return groupId;
  }

  /**
   * 在提示词标签管理器中创建标签组
   */
  async function createPromptTagGroup(page: any, groupName: string): Promise<number> {
    await page.click(`#${Constants.Ids.ADD_PROMPT_TAG_GROUP_BTN}`);
    await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_MODAL}`, { state: 'visible', timeout: 5000 });
    await page.screenshot({ path: `test-results/tag-manager/prompt-group-dialog-${groupName.slice(0, 10)}.png` });

    await page.fill(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_NAME}`, groupName);
    await page.click(`#${Constants.Ids.SAVE_PROMPT_TAG_GROUP_BTN}`);

    // Wait for group to be created via API
    const groupId = await page.waitForFunction(async (name: string) => {
      const groups = await window.electronAPI.getPromptTagGroups();
      const group = groups.find((g: { name: string; id: number }) => g.name === name);
      return group?.id;
    }, groupName, { timeout: 5000 });

    await page.screenshot({ path: `test-results/tag-manager/prompt-group-created-${groupName.slice(0, 10)}.png` });

    return groupId;
  }

  test.describe('图像标签管理 - 非批量功能', () => {
    test('打开和关闭标签管理器', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('打开和关闭标签管理器');
      await enterImageTagManager(page);

      // Verify modal is active
      const modal = page.locator(`#${Constants.Ids.IMAGE_TAG_MANAGER_MODAL}`);
      await expect(modal).toHaveClass(/active/);

      // Verify toolbar elements exist
      await expect(page.locator(`#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`)).toBeVisible();
      await expect(page.locator(`#${Constants.Ids.ADD_IMAGE_TAG_IN_MANAGER_BTN}`)).toBeVisible();
      await expect(page.locator(`#${Constants.Ids.ADD_IMAGE_TAG_GROUP_BTN}`)).toBeVisible();
      await expect(page.locator(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`)).toBeVisible();

      await closeImageTagManager(page);

      // Verify modal is hidden
      await expect(modal).not.toHaveClass(/active/);
    });

    test('新建标签', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('新建标签');
      await enterImageTagManager(page);

      const testTagName = generateTestTagName('img_tag');
      await createImageTagInManager(page, testTagName);

      // Verify tag appears in the list
      const tagElement = page.locator(`.tag-manager-item[data-tag="${testTagName}"]`);
      await expect(tagElement).toBeVisible({ timeout: 5000 });

      // Verify toast message
      await page.waitForSelector(`#${Constants.Ids.TOAST_CONTAINER}:has-text("标签已创建")`, { timeout: 5000 });

      await closeImageTagManager(page);
    });

    test('编辑标签（重命名）', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('编辑标签（重命名）');
      await enterImageTagManager(page);

      // Create a test tag first
      const originalTagName = generateTestTagName('img_edit');
      await createImageTagInManager(page, originalTagName);

      // Click edit button on the tag (限定在图像标签组卡片容器内)
      const tagItem = page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${originalTagName}"]`);
      await expect(tagItem).toBeVisible({ timeout: 5000 });

      const editBtn = tagItem.locator('.tag-edit-btn');
      await editBtn.click();

      // Wait for input dialog
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/tag-manager/image-edit-dialog.png' });

      // Rename the tag
      const newTagName = generateTestTagName('img_renamed');
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, newTagName);
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      // Wait for rename via API and UI refresh
      await page.waitForFunction(async (params: { old: string; new: string }) => {
        const tags = await window.electronAPI.getImageTags();
        return !tags.includes(params.old) && tags.includes(params.new);
      }, { old: originalTagName, new: newTagName }, { timeout: 5000 });

      await page.screenshot({ path: 'test-results/tag-manager/image-tag-renamed.png' });

      // Verify new tag name appears (限定在图像标签组卡片容器内)
      const renamedTag = page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${newTagName}"]`);
      await expect(renamedTag).toBeVisible({ timeout: 5000 });

      // Verify toast message
      await page.waitForSelector(`#${Constants.Ids.TOAST_CONTAINER}:has-text("标签已重命名")`, { timeout: 5000 });

      await closeImageTagManager(page);
    });

    test('删除标签', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('删除标签');
      await enterImageTagManager(page);

      // Create a test tag first
      const testTagName = generateTestTagName('img_delete');
      await createImageTagInManager(page, testTagName);

      // Click delete button on the tag
      const tagItem = page.locator(`.tag-manager-item[data-tag="${testTagName}"]`);
      await expect(tagItem).toBeVisible({ timeout: 5000 });

      const deleteBtn = tagItem.locator('.tag-delete-btn');
      await deleteBtn.click();

      // Wait for confirm dialog
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/tag-manager/image-delete-confirm.png' });

      // Confirm deletion
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // Wait for deletion via API
      await page.waitForFunction(async (name: string) => {
        const tags = await window.electronAPI.getImageTags();
        return !tags.includes(name);
      }, testTagName, { timeout: 5000 });

      await page.screenshot({ path: 'test-results/tag-manager/image-tag-deleted.png' });

      // Verify tag is removed
      await expect(tagItem).not.toBeVisible({ timeout: 5000 });

      // Verify toast message
      await page.waitForSelector(`#${Constants.Ids.TOAST_CONTAINER}:has-text("标签已删除")`, { timeout: 5000 });

      await closeImageTagManager(page);
    });

    test('排序标签', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('排序标签');
      await enterImageTagManager(page);

      // Change sort order
      await page.selectOption(`#${Constants.Ids.IMAGE_TAG_MANAGER_SORT_SELECT}`, 'name-asc');
      await page.screenshot({ path: 'test-results/tag-manager/image-sort-name-asc.png' });

      // Toggle sort direction
      await page.click(`#${Constants.Ids.IMAGE_TAG_MANAGER_ORDER_BTN}`);
      await page.screenshot({ path: 'test-results/tag-manager/image-sort-name-desc.png' });

      // Change back to count sort
      await page.selectOption(`#${Constants.Ids.IMAGE_TAG_MANAGER_SORT_SELECT}`, 'count-desc');
      await page.screenshot({ path: 'test-results/tag-manager/image-sort-count.png' });

      await closeImageTagManager(page);
    });

    test('新建标签组', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('新建标签组');
      await enterImageTagManager(page);

      const groupName = generateTestTagName('img_group');
      const groupId = await createImageTagGroup(page, groupName);

      expect(groupId).toBeTruthy();

      // Verify group appears in the list (限定在图像标签组卡片容器内)
      const groupCard = page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`);
      await expect(groupCard).toBeVisible({ timeout: 5000 });

      // Verify toast message
      await page.waitForSelector(`#${Constants.Ids.TOAST_CONTAINER}:has-text("标签组已创建")`, { timeout: 5000 });

      await closeImageTagManager(page);
    });

    test('编辑标签组', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('编辑标签组');
      await enterImageTagManager(page);

      // Create a test group first
      const originalGroupName = generateTestTagName('img_group_edit');
      const groupId = await createImageTagGroup(page, originalGroupName);

      // Click edit button on the group
      const groupCard = page.locator(`.tag-group-card[data-group-id="${groupId}"]`);
      const editBtn = groupCard.locator('.tag-group-btn.edit');
      await editBtn.click();

      // Wait for edit modal
      await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL}`, { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/tag-manager/image-group-edit-dialog.png' });

      // Rename the group
      const newGroupName = generateTestTagName('img_group_renamed');
      await page.fill(`#${Constants.Ids.IMAGE_TAG_GROUP_EDIT_NAME}`, newGroupName);
      await page.click(`#${Constants.Ids.SAVE_IMAGE_TAG_GROUP_BTN}`);

      // Wait for update via API
      await page.waitForFunction(async (params: { id: number; name: string }) => {
        const groups = await window.electronAPI.getImageTagGroups();
        const group = groups.find((g: { id: number; name: string }) => g.id === params.id);
        return group?.name === params.name;
      }, { id: groupId, name: newGroupName }, { timeout: 5000 });

      await page.screenshot({ path: 'test-results/tag-manager/image-group-renamed.png' });

      // Verify new group name appears
      const renamedGroup = page.locator(`.tag-group-card[data-group-id="${groupId}"]`);
      await expect(renamedGroup).toContainText(newGroupName);

      // Verify toast message
      await page.waitForSelector(`#${Constants.Ids.TOAST_CONTAINER}:has-text("标签组已更新")`, { timeout: 5000 });

      await closeImageTagManager(page);
    });

    test('删除标签组', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('删除标签组');
      await enterImageTagManager(page);

      // Create a test group first
      const groupName = generateTestTagName('img_group_delete');
      const groupId = await createImageTagGroup(page, groupName);

      // Click delete button on the group
      const groupCard = page.locator(`.tag-group-card[data-group-id="${groupId}"]`);
      const deleteBtn = groupCard.locator('.tag-group-btn.delete');
      await deleteBtn.click();

      // Wait for confirm dialog
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/tag-manager/image-group-delete-confirm.png' });

      // Confirm deletion
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // Wait for deletion via API
      await page.waitForFunction(async (id: number) => {
        const groups = await window.electronAPI.getImageTagGroups();
        return !groups.some((g: { id: number }) => g.id === id);
      }, groupId, { timeout: 5000 });

      await page.screenshot({ path: 'test-results/tag-manager/image-group-deleted.png' });

      // Verify group is removed
      await expect(groupCard).not.toBeVisible({ timeout: 5000 });

      // Verify toast message
      await page.waitForSelector(`#${Constants.Ids.TOAST_CONTAINER}:has-text("标签组已删除")`, { timeout: 5000 });

      await closeImageTagManager(page);
    });

    test('搜索并批量删除 e2e 标签', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('搜索并批量删除 e2e 标签');
      await enterImageTagManager(page);

      // Create multiple e2e test tags
      const testTagName1 = generateTestTagName('img_e2e');
      const testTagName2 = generateTestTagName('img_e2e');
      await createImageTagInManager(page, testTagName1);
      await createImageTagInManager(page, testTagName2);

      // Search for e2e tags
      await page.fill(`#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`, 'e2e');
      await page.screenshot({ path: 'test-results/tag-manager/image-e2e-search-input.png' });

      // Wait for search results to update - verify only e2e tags are visible
      await page.waitForFunction(
        (containerId: string) => {
          const items = document.querySelectorAll(`#${containerId} .tag-manager-item`);
          return items.length >= 2 && Array.from(items).every(item =>
            item.getAttribute('data-tag')?.includes('e2e')
          );
        },
        Constants.Ids.IMAGE_TAG_GROUP_CARDS,
        { timeout: 5000 }
      );

      await page.screenshot({ path: 'test-results/tag-manager/image-e2e-search-result.png' });

      // Click on container to ensure search input loses focus before Ctrl+A
      await page.click(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS}`);

      // Press Ctrl+A to select all visible tags and enter batch mode
      await page.keyboard.press('Control+a');
      await page.screenshot({ path: 'test-results/tag-manager/image-e2e-ctrla.png' });

      // Verify checkboxes appear (batch mode is active)
      const checkboxes = page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-batch-checkbox`);
      const checkboxCount = await checkboxes.count();
      expect(checkboxCount).toBeGreaterThanOrEqual(2);

      // Verify batch toolbar is visible
      const batchToolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
      await expect(batchToolbar).toBeVisible({ timeout: 5000 });

      // Verify all checkboxes are checked
      const checkedCount = await page.evaluate((containerId: string) => {
        const checkboxes = document.querySelectorAll(`#${containerId} .tag-batch-checkbox`);
        return Array.from(checkboxes).filter((cb) => (cb as HTMLInputElement).checked).length;
      }, Constants.Ids.IMAGE_TAG_GROUP_CARDS);
      expect(checkedCount).toBeGreaterThanOrEqual(2);

      await page.screenshot({ path: 'test-results/tag-manager/image-e2e-batch-selected.png' });

      // Click delete button
      const deleteBtn = batchToolbar.locator('.batch-action-delete');
      await deleteBtn.click();

      // Wait for confirm dialog
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/tag-manager/image-e2e-delete-confirm.png' });

      // Confirm deletion
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // Wait for deletion via API
      await page.waitForFunction(async (names: string[]) => {
        const tags = await window.electronAPI.getImageTags();
        return !tags.includes(names[0]) && !tags.includes(names[1]);
      }, [testTagName1, testTagName2], { timeout: 5000 });

      await page.screenshot({ path: 'test-results/tag-manager/image-e2e-deleted.png' });

      // Verify e2e tags are removed
      await expect(page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${testTagName1}"]`)).not.toBeVisible({ timeout: 5000 });
      await expect(page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${testTagName2}"]`)).not.toBeVisible({ timeout: 5000 });

      // Verify toast message
      await page.waitForSelector(`#${Constants.Ids.TOAST_CONTAINER}:has-text("已删除")`, { timeout: 5000 });

      await closeImageTagManager(page);
    });
  });

  test.describe('图像标签管理 - 批量功能', () => {
    test('进入和退出批量模式', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('进入和退出批量模式');
      await enterImageTagManager(page);

      // Click batch manage button
      await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);

      // Verify batch toolbar is visible
      const batchToolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
      await expect(batchToolbar).toBeVisible({ timeout: 5000 });

      // Wait for batch mode to be fully rendered (checkboxes should appear)
      await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-batch-checkbox`, { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/tag-manager/image-batch-mode-entered.png' });

      // Verify container has selection-mode class
      const container = page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS}`);
      await expect(container).toHaveClass(/selection-mode/);

      // Verify checkboxes are visible
      const checkboxes = page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-batch-checkbox`);
      const checkboxCount = await checkboxes.count();
      expect(checkboxCount).toBeGreaterThan(0);

      // Exit batch mode by clicking cancel
      const cancelBtn = batchToolbar.locator('.batch-action-cancel');
      await cancelBtn.click();
      await page.screenshot({ path: 'test-results/tag-manager/image-batch-mode-exited.png' });

      // Verify batch toolbar is hidden
      await expect(batchToolbar).not.toBeVisible({ timeout: 5000 });

      await closeImageTagManager(page);
    });

    test('批量全选和反选', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('批量全选和反选');
      await enterImageTagManager(page);

      // Create some test tags first
      const tagName1 = generateTestTagName('img_batch1');
      const tagName2 = generateTestTagName('img_batch2');
      await createImageTagInManager(page, tagName1);
      await createImageTagInManager(page, tagName2);

      // Enter batch mode
      await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);

      // Wait for batch mode to be fully rendered
      await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-batch-checkbox`, { state: 'visible', timeout: 5000 });

      // Click select all
      const batchToolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
      await expect(batchToolbar).toBeVisible({ timeout: 5000 });
      const selectAllBtn = batchToolbar.locator('.batch-action-select-all');
      await selectAllBtn.click();
      await page.screenshot({ path: 'test-results/tag-manager/image-batch-select-all.png' });

      // Verify all checkboxes are checked using JavaScript
      const checkedCountAfterSelect = await page.evaluate((containerId: string) => {
        const checkboxes = document.querySelectorAll(`#${containerId} .tag-batch-checkbox`);
        return Array.from(checkboxes).filter((cb) => (cb as HTMLInputElement).checked).length;
      }, Constants.Ids.IMAGE_TAG_GROUP_CARDS);
      expect(checkedCountAfterSelect).toBeGreaterThanOrEqual(2);

      // Click invert selection
      const invertBtn = batchToolbar.locator('.batch-action-invert');
      await invertBtn.click();
      await page.screenshot({ path: 'test-results/tag-manager/image-batch-invert.png' });

      // After invert, all should be unchecked (since all were checked)
      const uncheckedCount = await page.evaluate((containerId: string) => {
        const checkboxes = document.querySelectorAll(`#${containerId} .tag-batch-checkbox`);
        return Array.from(checkboxes).filter((cb) => !(cb as HTMLInputElement).checked).length;
      }, Constants.Ids.IMAGE_TAG_GROUP_CARDS);
      expect(uncheckedCount).toBeGreaterThanOrEqual(2);

      await closeImageTagManager(page);
    });

    test('批量删除标签', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('批量删除标签');
      await enterImageTagManager(page);

      // Create a test tag
      const tagName = generateTestTagName('img_del');
      await createImageTagInManager(page, tagName);

      // Enter batch mode
      await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);

      // Wait for batch mode to be fully rendered
      await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-batch-checkbox`, { state: 'visible', timeout: 5000 });

      // Search for the test tag to filter the list
      await page.fill(`#${Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT}`, tagName);

      // Select the test tag
      const checkbox = page.locator(`.tag-batch-checkbox[data-tag="${tagName}"]`);
      await checkbox.check();

      // Verify batch toolbar shows the correct count
      const batchToolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
      await expect(batchToolbar).toBeVisible({ timeout: 5000 });
      await expect(batchToolbar).toContainText('已选择 1 个标签');

      await page.screenshot({ path: 'test-results/tag-manager/image-batch-delete-selected.png' });

      // Click delete button
      const deleteBtn = batchToolbar.locator('.batch-action-delete');
      await deleteBtn.click();

      // Wait for confirm dialog
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/tag-manager/image-batch-delete-confirm.png' });

      // Confirm deletion
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // Wait for deletion via API
      await page.waitForFunction(async (name: string) => {
        const tags = await window.electronAPI.getImageTags();
        return !tags.includes(name);
      }, tagName, { timeout: 5000 });

      await page.screenshot({ path: 'test-results/tag-manager/image-batch-deleted.png' });

      // Clear search to verify tag is removed
      await page.click(`#${Constants.Ids.CLEAR_IMAGE_TAG_MANAGER_SEARCH_BTN}`);

      // Verify tag is removed (限定在图像标签组卡片容器内)
      await expect(page.locator(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName}"]`)).not.toBeVisible({ timeout: 5000 });

      // Verify toast message
      await page.waitForSelector(`#${Constants.Ids.TOAST_CONTAINER}:has-text("已删除")`, { timeout: 5000 });

      await closeImageTagManager(page);
    });

    test('批量移动到组', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('批量移动到组');
      await enterImageTagManager(page);

      // Create a test group
      const groupName = generateTestTagName('img_move_group');
      const groupId = await createImageTagGroup(page, groupName);

      // Create test tags
      const tagName1 = generateTestTagName('img_move1');
      const tagName2 = generateTestTagName('img_move2');
      await createImageTagInManager(page, tagName1);
      await createImageTagInManager(page, tagName2);

      // Enter batch mode
      await page.click(`#${Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN}`);

      // Wait for batch mode to be fully rendered
      await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_GROUP_CARDS} .tag-batch-checkbox`, { state: 'visible', timeout: 5000 });

      // Select the test tags
      const checkbox1 = page.locator(`.tag-batch-checkbox[data-tag="${tagName1}"]`);
      const checkbox2 = page.locator(`.tag-batch-checkbox[data-tag="${tagName2}"]`);
      await checkbox1.check();
      await checkbox2.check();
      await page.screenshot({ path: 'test-results/tag-manager/image-batch-move-selected.png' });

      // Click move button
      const batchToolbar = page.locator(`#${Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR}`);
      await expect(batchToolbar).toBeVisible({ timeout: 5000 });
      const moveBtn = batchToolbar.locator('.batch-action-move');
      await moveBtn.click();

      // Wait for select dialog
      await page.waitForSelector(`#${Constants.Ids.SELECT_MODAL}`, { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/tag-manager/image-batch-move-dialog.png' });

      // Select the target group
      await page.selectOption(`#${Constants.Ids.SELECT_MODAL_FIELD}`, String(groupId));
      await page.click(`#${Constants.Ids.SELECT_MODAL_OK_BTN}`);

      // Wait for move via API
      await page.waitForFunction(async (params: { tags: string[]; groupId: number }) => {
        const groups = await window.electronAPI.getImageTagGroups();
        const group = groups.find((g: { id: number; tags?: string[] }) => g.id === params.groupId);
        return group?.tags?.includes(params.tags[0]) && group?.tags?.includes(params.tags[1]);
      }, { tags: [tagName1, tagName2], groupId }, { timeout: 5000 });

      await page.screenshot({ path: 'test-results/tag-manager/image-batch-moved.png' });

      // Verify toast message
      await page.waitForSelector(`#${Constants.Ids.TOAST_CONTAINER}:has-text("已移动")`, { timeout: 5000 });

      await closeImageTagManager(page);
    });
  });

  test.describe('提示词标签管理 - 非批量功能', () => {
    test('打开和关闭标签管理器', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('打开和关闭标签管理器（提示词）');
      await enterPromptTagManager(page);

      // Verify modal is active
      const modal = page.locator(`#${Constants.Ids.PROMPT_TAG_MANAGER_MODAL}`);
      await expect(modal).toHaveClass(/active/);

      // Verify toolbar elements exist
      await expect(page.locator(`#${Constants.Ids.PROMPT_TAG_MANAGER_SEARCH_INPUT}`)).toBeVisible();
      await expect(page.locator(`#${Constants.Ids.ADD_PROMPT_TAG_IN_MANAGER_BTN}`)).toBeVisible();
      await expect(page.locator(`#${Constants.Ids.ADD_PROMPT_TAG_GROUP_BTN}`)).toBeVisible();
      await expect(page.locator(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`)).toBeVisible();

      await closePromptTagManager(page);

      // Verify modal is hidden
      await expect(modal).not.toHaveClass(/active/);
    });

    test('新建标签', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('新建标签（提示词）');
      await enterPromptTagManager(page);

      const testTagName = generateTestTagName('prompt_tag');
      await createPromptTagInManager(page, testTagName);

      // Verify tag appears in the list
      const tagElement = page.locator(`.tag-manager-item[data-tag="${testTagName}"]`);
      await expect(tagElement).toBeVisible({ timeout: 5000 });

      // Verify toast message
      await page.waitForSelector(`#${Constants.Ids.TOAST_CONTAINER}:has-text("标签已创建")`, { timeout: 5000 });

      await closePromptTagManager(page);
    });

    test('编辑标签（重命名）', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('编辑标签（重命名）（提示词）');
      await enterPromptTagManager(page);

      // Create a test tag first
      const originalTagName = generateTestTagName('prompt_edit');
      await createPromptTagInManager(page, originalTagName);

      // Click edit button on the tag (限定在提示词标签组卡片容器内)
      const tagItem = page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${originalTagName}"]`);
      await expect(tagItem).toBeVisible({ timeout: 5000 });

      const editBtn = tagItem.locator('.tag-edit-btn');
      await editBtn.click();

      // Wait for input dialog
      await page.waitForSelector(`#${Constants.Ids.INPUT_MODAL_FIELD}`, { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/tag-manager/prompt-edit-dialog.png' });

      // Rename the tag
      const newTagName = generateTestTagName('prompt_renamed');
      await page.fill(`#${Constants.Ids.INPUT_MODAL_FIELD}`, newTagName);
      await page.click(`#${Constants.Ids.INPUT_OK_BTN}`);

      // Wait for rename via API and UI refresh
      await page.waitForFunction(async (params: { old: string; new: string }) => {
        const tags = await window.electronAPI.getAllTags();
        return !tags.includes(params.old) && tags.includes(params.new);
      }, { old: originalTagName, new: newTagName }, { timeout: 5000 });

      await page.screenshot({ path: 'test-results/tag-manager/prompt-tag-renamed.png' });

      // Verify new tag name appears (限定在提示词标签组卡片容器内)
      const renamedTag = page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${newTagName}"]`);
      await expect(renamedTag).toBeVisible({ timeout: 5000 });

      // Verify toast message
      await page.waitForSelector(`#${Constants.Ids.TOAST_CONTAINER}:has-text("标签已重命名")`, { timeout: 5000 });

      await closePromptTagManager(page);
    });

    test('删除标签', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('删除标签（提示词）');
      await enterPromptTagManager(page);

      // Create a test tag first
      const testTagName = generateTestTagName('prompt_delete');
      await createPromptTagInManager(page, testTagName);

      // Click delete button on the tag
      const tagItem = page.locator(`.tag-manager-item[data-tag="${testTagName}"]`);
      await expect(tagItem).toBeVisible({ timeout: 5000 });

      const deleteBtn = tagItem.locator('.tag-delete-btn');
      await deleteBtn.click();

      // Wait for confirm dialog
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/tag-manager/prompt-delete-confirm.png' });

      // Confirm deletion
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // Wait for deletion via API
      await page.waitForFunction(async (name: string) => {
        const tags = await window.electronAPI.getAllTags();
        return !tags.includes(name);
      }, testTagName, { timeout: 5000 });

      await page.screenshot({ path: 'test-results/tag-manager/prompt-tag-deleted.png' });

      // Verify tag is removed
      await expect(tagItem).not.toBeVisible({ timeout: 5000 });

      // Verify toast message
      await page.waitForSelector(`#${Constants.Ids.TOAST_CONTAINER}:has-text("标签已删除")`, { timeout: 5000 });

      await closePromptTagManager(page);
    });

    test('排序标签', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('排序标签（提示词）');
      await enterPromptTagManager(page);

      // Change sort order
      await page.selectOption(`#${Constants.Ids.PROMPT_TAG_MANAGER_SORT_SELECT}`, 'name-asc');
      await page.screenshot({ path: 'test-results/tag-manager/prompt-sort-name-asc.png' });

      // Toggle sort direction
      await page.click(`#${Constants.Ids.PROMPT_TAG_MANAGER_ORDER_BTN}`);
      await page.screenshot({ path: 'test-results/tag-manager/prompt-sort-name-desc.png' });

      // Change back to count sort
      await page.selectOption(`#${Constants.Ids.PROMPT_TAG_MANAGER_SORT_SELECT}`, 'count-desc');
      await page.screenshot({ path: 'test-results/tag-manager/prompt-sort-count.png' });

      await closePromptTagManager(page);
    });

    test('新建标签组', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('新建标签组（提示词）');
      await enterPromptTagManager(page);

      const groupName = generateTestTagName('prompt_group');
      const groupId = await createPromptTagGroup(page, groupName);

      expect(groupId).toBeTruthy();

      // Verify group appears in the list (限定在提示词标签组卡片容器内)
      const groupCard = page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`);
      await expect(groupCard).toBeVisible({ timeout: 5000 });

      // Verify toast message
      await page.waitForSelector(`#${Constants.Ids.TOAST_CONTAINER}:has-text("标签组已创建")`, { timeout: 5000 });

      await closePromptTagManager(page);
    });

    test('编辑标签组', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('编辑标签组（提示词）');
      await enterPromptTagManager(page);

      // Create a test group first
      const originalGroupName = generateTestTagName('prompt_group_edit');
      const groupId = await createPromptTagGroup(page, originalGroupName);

      // Click edit button on the group (限定在提示词标签组卡片容器内)
      const groupCard = page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`);
      const editBtn = groupCard.locator('.tag-group-btn.edit');
      await editBtn.click();

      // Wait for edit modal
      await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_MODAL}`, { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/tag-manager/prompt-group-edit-dialog.png' });

      // Rename the group
      const newGroupName = generateTestTagName('prompt_group_renamed');
      await page.fill(`#${Constants.Ids.PROMPT_TAG_GROUP_EDIT_NAME}`, newGroupName);
      await page.click(`#${Constants.Ids.SAVE_PROMPT_TAG_GROUP_BTN}`);

      // Wait for update via API
      await page.waitForFunction(async (params: { id: number; name: string }) => {
        const groups = await window.electronAPI.getPromptTagGroups();
        const group = groups.find((g: { id: number; name: string }) => g.id === params.id);
        return group?.name === params.name;
      }, { id: groupId, name: newGroupName }, { timeout: 5000 });

      await page.screenshot({ path: 'test-results/tag-manager/prompt-group-renamed.png' });

      // Verify new group name appears (限定在提示词标签组卡片容器内)
      const renamedGroup = page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`);
      await expect(renamedGroup).toContainText(newGroupName);

      // Verify toast message
      await page.waitForSelector(`#${Constants.Ids.TOAST_CONTAINER}:has-text("标签组已更新")`, { timeout: 5000 });

      await closePromptTagManager(page);
    });

    test('删除标签组', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('删除标签组（提示词）');
      await enterPromptTagManager(page);

      // Create a test group first
      const groupName = generateTestTagName('prompt_group_delete');
      const groupId = await createPromptTagGroup(page, groupName);

      // Click delete button on the group (限定在提示词标签组卡片容器内)
      const groupCard = page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-group-card[data-group-id="${groupId}"]`);
      const deleteBtn = groupCard.locator('.tag-group-btn.delete');
      await deleteBtn.click();

      // Wait for confirm dialog
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/tag-manager/prompt-group-delete-confirm.png' });

      // Confirm deletion
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // Wait for deletion via API
      await page.waitForFunction(async (id: number) => {
        const groups = await window.electronAPI.getPromptTagGroups();
        return !groups.some((g: { id: number }) => g.id === id);
      }, groupId, { timeout: 5000 });

      await page.screenshot({ path: 'test-results/tag-manager/prompt-group-deleted.png' });

      // Verify group is removed (使用相同的限定选择器)
      await expect(groupCard).not.toBeVisible({ timeout: 5000 });

      // Verify toast message
      await page.waitForSelector(`#${Constants.Ids.TOAST_CONTAINER}:has-text("标签组已删除")`, { timeout: 5000 });

      await closePromptTagManager(page);
    });

    test('搜索并批量删除 e2e 标签', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('搜索并批量删除 e2e 标签（提示词）');
      await enterPromptTagManager(page);

      // Create multiple e2e test tags
      const testTagName1 = generateTestTagName('prompt_e2e');
      const testTagName2 = generateTestTagName('prompt_e2e');
      await createPromptTagInManager(page, testTagName1);
      await createPromptTagInManager(page, testTagName2);

      // Search for e2e tags
      await page.fill(`#${Constants.Ids.PROMPT_TAG_MANAGER_SEARCH_INPUT}`, 'e2e');
      await page.screenshot({ path: 'test-results/tag-manager/prompt-e2e-search-input.png' });

      // Wait for search results to update - verify only e2e tags are visible
      await page.waitForFunction(
        (containerId: string) => {
          const items = document.querySelectorAll(`#${containerId} .tag-manager-item`);
          return items.length >= 2 && Array.from(items).every(item =>
            item.getAttribute('data-tag')?.includes('e2e')
          );
        },
        Constants.Ids.PROMPT_TAG_GROUP_CARDS,
        { timeout: 5000 }
      );

      await page.screenshot({ path: 'test-results/tag-manager/prompt-e2e-search-result.png' });

      // Click on container to ensure search input loses focus before Ctrl+A
      await page.click(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS}`);

      // Press Ctrl+A to select all visible tags and enter batch mode
      await page.keyboard.press('Control+a');
      await page.screenshot({ path: 'test-results/tag-manager/prompt-e2e-ctrla.png' });

      // Verify checkboxes appear (batch mode is active)
      const checkboxes = page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-batch-checkbox`);
      const checkboxCount = await checkboxes.count();
      expect(checkboxCount).toBeGreaterThanOrEqual(2);

      // Verify batch toolbar is visible
      const batchToolbar = page.locator(`#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`);
      await expect(batchToolbar).toBeVisible({ timeout: 5000 });

      // Verify all checkboxes are checked
      const checkedCount = await page.evaluate((containerId: string) => {
        const checkboxes = document.querySelectorAll(`#${containerId} .tag-batch-checkbox`);
        return Array.from(checkboxes).filter((cb) => (cb as HTMLInputElement).checked).length;
      }, Constants.Ids.PROMPT_TAG_GROUP_CARDS);
      expect(checkedCount).toBeGreaterThanOrEqual(2);

      await page.screenshot({ path: 'test-results/tag-manager/prompt-e2e-batch-selected.png' });

      // Click delete button
      const deleteBtn = batchToolbar.locator('.batch-action-delete');
      await deleteBtn.click();

      // Wait for confirm dialog
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/tag-manager/prompt-e2e-delete-confirm.png' });

      // Confirm deletion
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // Wait for deletion via API
      await page.waitForFunction(async (names: string[]) => {
        const tags = await window.electronAPI.getAllTags();
        return !tags.includes(names[0]) && !tags.includes(names[1]);
      }, [testTagName1, testTagName2], { timeout: 5000 });

      await page.screenshot({ path: 'test-results/tag-manager/prompt-e2e-deleted.png' });

      // Verify e2e tags are removed
      await expect(page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${testTagName1}"]`)).not.toBeVisible({ timeout: 5000 });
      await expect(page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${testTagName2}"]`)).not.toBeVisible({ timeout: 5000 });

      // Verify toast message
      await page.waitForSelector(`#${Constants.Ids.TOAST_CONTAINER}:has-text("已删除")`, { timeout: 5000 });

      await closePromptTagManager(page);
    });
  });

  test.describe('提示词标签管理 - 批量功能', () => {
    test('进入和退出批量模式', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('进入和退出批量模式（提示词）');
      await enterPromptTagManager(page);

      // Click batch manage button
      await page.click(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`);

      // Verify batch toolbar is visible
      const batchToolbar = page.locator(`#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`);
      await expect(batchToolbar).toBeVisible({ timeout: 5000 });

      // Wait for batch mode to be fully rendered (checkboxes should appear)
      await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-batch-checkbox`, { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/tag-manager/prompt-batch-mode-entered.png' });

      // Verify container has selection-mode class
      const container = page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS}`);
      await expect(container).toHaveClass(/selection-mode/);

      // Verify checkboxes are visible
      const checkboxes = page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-batch-checkbox`);
      const checkboxCount = await checkboxes.count();
      expect(checkboxCount).toBeGreaterThan(0);

      // Exit batch mode by clicking cancel
      const cancelBtn = batchToolbar.locator('.batch-action-cancel');
      await cancelBtn.click();
      await page.screenshot({ path: 'test-results/tag-manager/prompt-batch-mode-exited.png' });

      // Verify batch toolbar is hidden
      await expect(batchToolbar).not.toBeVisible({ timeout: 5000 });

      await closePromptTagManager(page);
    });

    test('批量全选和反选', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('批量全选和反选（提示词）');
      await enterPromptTagManager(page);

      // Create some test tags first
      const tagName1 = generateTestTagName('prompt_batch1');
      const tagName2 = generateTestTagName('prompt_batch2');
      await createPromptTagInManager(page, tagName1);
      await createPromptTagInManager(page, tagName2);

      // Enter batch mode
      await page.click(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`);

      // Wait for batch mode to be fully rendered
      await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-batch-checkbox`, { state: 'visible', timeout: 5000 });

      // Click select all
      const batchToolbar = page.locator(`#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`);
      await expect(batchToolbar).toBeVisible({ timeout: 5000 });
      const selectAllBtn = batchToolbar.locator('.batch-action-select-all');
      await selectAllBtn.click();
      await page.screenshot({ path: 'test-results/tag-manager/prompt-batch-select-all.png' });

      // Verify all checkboxes are checked
      const checkedBoxes = page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-batch-checkbox:checked`);
      const checkedCount = await checkedBoxes.count();
      expect(checkedCount).toBeGreaterThanOrEqual(2);

      // Click invert selection
      const invertBtn = batchToolbar.locator('.batch-action-invert');
      await invertBtn.click();
      await page.screenshot({ path: 'test-results/tag-manager/prompt-batch-invert.png' });

      // After invert, all should be unchecked (since all were checked)
      const uncheckedCount = await page.evaluate((containerId: string) => {
        const checkboxes = document.querySelectorAll(`#${containerId} .tag-batch-checkbox`);
        return Array.from(checkboxes).filter((cb) => !(cb as HTMLInputElement).checked).length;
      }, Constants.Ids.PROMPT_TAG_GROUP_CARDS);
      expect(uncheckedCount).toBeGreaterThanOrEqual(2);

      await closePromptTagManager(page);
    });

    test('批量删除标签', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('批量删除标签（提示词）');
      await enterPromptTagManager(page);

      // Create a test tag
      const tagName = generateTestTagName('prompt_del');
      await createPromptTagInManager(page, tagName);

      // Enter batch mode
      await page.click(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`);

      // Wait for batch mode to be fully rendered
      await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-batch-checkbox`, { state: 'visible', timeout: 5000 });

      // Search for the test tag to filter the list
      await page.fill(`#${Constants.Ids.PROMPT_TAG_MANAGER_SEARCH_INPUT}`, tagName);

      // Select the test tag
      const checkbox = page.locator(`.tag-batch-checkbox[data-tag="${tagName}"]`);
      await checkbox.check();

      // Verify batch toolbar shows the correct count
      const batchToolbar = page.locator(`#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`);
      await expect(batchToolbar).toBeVisible({ timeout: 5000 });
      await expect(batchToolbar).toContainText('已选择 1 个标签');

      await page.screenshot({ path: 'test-results/tag-manager/prompt-batch-delete-selected.png' });

      // Click delete button
      const deleteBtn = batchToolbar.locator('.batch-action-delete');
      await deleteBtn.click();

      // Wait for confirm dialog
      await page.waitForSelector(`#${Constants.Ids.CONFIRM_MODAL}`, { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/tag-manager/prompt-batch-delete-confirm.png' });

      // Confirm deletion
      await page.click(`#${Constants.Ids.CONFIRM_OK_BTN}`);

      // Wait for deletion via API
      await page.waitForFunction(async (name: string) => {
        const tags = await window.electronAPI.getAllTags();
        return !tags.includes(name);
      }, tagName, { timeout: 5000 });

      await page.screenshot({ path: 'test-results/tag-manager/prompt-batch-deleted.png' });

      // Clear search to verify tag is removed
      await page.click(`#${Constants.Ids.CLEAR_PROMPT_TAG_MANAGER_SEARCH_BTN}`);

      // Verify tag is removed (限定在提示词标签组卡片容器内)
      await expect(page.locator(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-manager-item[data-tag="${tagName}"]`)).not.toBeVisible({ timeout: 5000 });

      // Verify toast message
      await page.waitForSelector(`#${Constants.Ids.TOAST_CONTAINER}:has-text("已删除")`, { timeout: 5000 });

      await closePromptTagManager(page);
    });

    test('批量移动到组', async () => {
      const page = electronTest.getPage();
      await electronTest.logTestStart('批量移动到组（提示词）');
      await enterPromptTagManager(page);

      // Create a test group
      const groupName = generateTestTagName('prompt_move_group');
      const groupId = await createPromptTagGroup(page, groupName);

      // Create test tags
      const tagName1 = generateTestTagName('prompt_move1');
      const tagName2 = generateTestTagName('prompt_move2');
      await createPromptTagInManager(page, tagName1);
      await createPromptTagInManager(page, tagName2);

      // Enter batch mode
      await page.click(`#${Constants.Ids.BATCH_MANAGE_PROMPT_TAGS_BTN}`);

      // Wait for batch mode to be fully rendered
      await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_GROUP_CARDS} .tag-batch-checkbox`, { state: 'visible', timeout: 5000 });

      // Select the test tags
      const checkbox1 = page.locator(`.tag-batch-checkbox[data-tag="${tagName1}"]`);
      const checkbox2 = page.locator(`.tag-batch-checkbox[data-tag="${tagName2}"]`);
      await checkbox1.check();
      await checkbox2.check();
      await page.screenshot({ path: 'test-results/tag-manager/prompt-batch-move-selected.png' });

      // Click move button
      const batchToolbar = page.locator(`#${Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR}`);
      await expect(batchToolbar).toBeVisible({ timeout: 5000 });
      const moveBtn = batchToolbar.locator('.batch-action-move');
      await moveBtn.click();

      // Wait for select dialog
      await page.waitForSelector(`#${Constants.Ids.SELECT_MODAL}`, { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/tag-manager/prompt-batch-move-dialog.png' });

      // Select the target group
      await page.selectOption(`#${Constants.Ids.SELECT_MODAL_FIELD}`, String(groupId));
      await page.click(`#${Constants.Ids.SELECT_MODAL_OK_BTN}`);

      // Wait for move via API
      await page.waitForFunction(async (params: { tags: string[]; groupId: number }) => {
        const groups = await window.electronAPI.getPromptTagGroups();
        const group = groups.find((g: { id: number; tags?: string[] }) => g.id === params.groupId);
        return group?.tags?.includes(params.tags[0]) && group?.tags?.includes(params.tags[1]);
      }, { tags: [tagName1, tagName2], groupId }, { timeout: 5000 });

      await page.screenshot({ path: 'test-results/tag-manager/prompt-batch-moved.png' });

      // Verify toast message
      await page.waitForSelector(`#${Constants.Ids.TOAST_CONTAINER}:has-text("已移动")`, { timeout: 5000 });

      await closePromptTagManager(page);
    });
  });
});

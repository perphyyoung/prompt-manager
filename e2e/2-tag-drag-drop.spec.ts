import { test, expect } from '@playwright/test';
import { createElectronTest, enterImageGridView, enterPromptGridView, ensureTagFilterExpanded } from './electron-test.ts';
import type { IElectronAPI, IImage, IPrompt } from '../src/preload/index.ts';

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

/**
 * 标签拖拽功能 E2E 测试
 *
 * 测试场景：
 * 1. 通过标签管理器创建测试标签
 * 2. 将标签拖拽到图像卡片
 * 3. 将标签拖拽到提示词卡片
 * 4. 验证标签添加成功
 * 5. 重复拖拽相同标签，验证提示"标签已存在"
 */
test.describe('标签拖拽功能', () => {
  const electronTest = createElectronTest();

  // 存储测试用图像和提示词的 ID
  let testImageId: string = '';
  let testPromptId: string = '';

  test.beforeAll(async () => {
    await electronTest.launch();

    const page = electronTest.getPage();

    // 获取测试用图像 ID
    await page.click('#imageManagerBtn');
    await page.waitForSelector('#imagePanel', { state: 'visible', timeout: 5000 });
    await page.click('#imageGridViewBtn');
    await page.waitForSelector('#imageGridViewBtn.active', { timeout: 5000 });

    const images = await page.evaluate(async () => {
      const allImages = await window.electronAPI.getImages('date', 'desc');
      return allImages[0];
    });
    testImageId = String(images.id);

    // 获取测试用提示词 ID
    await page.click('#promptManagerBtn');
    await page.waitForSelector('#promptPanel', { state: 'visible', timeout: 5000 });
    await page.click('#promptGridViewBtn');
    await page.waitForSelector('#promptGridViewBtn.active', { timeout: 5000 });

    const prompts = await page.evaluate(async () => {
      const allPrompts = await window.electronAPI.getPrompts('date', 'desc');
      return allPrompts[0];
    });
    testPromptId = String(prompts.id);
  });

  test.afterAll(async () => {
    await electronTest.close();
  });

  test.describe('图像标签拖拽', () => {
    test('标签拖拽到图像卡片 - 展开状态', async () => {
      const page = electronTest.getPage();

      await enterImageGridView(page);

      const targetCard = page.locator(`.image-card[data-id="${testImageId}"]`);
      await expect(targetCard).toBeVisible({ timeout: 5000 });

      const originalTags = await page.evaluate(async (id) => {
        const image = await window.electronAPI.getImageById(id as string);
        return (image as IImage)?.tags || [];
      }, testImageId);

      await ensureTagFilterExpanded(page, 'imageTagFilterSection', 'imageTagFilterToggleBtn');
      await page.screenshot({ path: 'test-results/drag-drop/image-04-filter-expanded.png' });

      const testTagName = `e2e_img_tag_${Date.now()}`;

      // 打开图像标签管理器
      await page.click('#imageTagManagerBtn');
      await page.waitForSelector('#imageTagManagerModal', { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/drag-drop/image-05-manager-opened.png' });

      // 新建标签
      await page.click('#addImageTagInManagerBtn');
      await page.waitForSelector('#inputModalField', { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/drag-drop/image-06-input-dialog.png' });

      const tagInputDialogInput = page.locator('#inputModalField');
      await tagInputDialogInput.fill(testTagName);

      const groupSelect = page.locator('#inputModalGroupSelect');
      await groupSelect.selectOption({ index: 1 });

      await page.click('#inputOkBtn');

      // 使用 waitForFunction 轮询检查标签是否创建成功（更可靠）
      await page.waitForFunction(async (tagName: string) => {
        const tags = await window.electronAPI.getAllTags();
        return tags.includes(tagName);
      }, testTagName, { timeout: 5000 });

      await page.screenshot({ path: 'test-results/drag-drop/image-07-tag-created.png' });

      // 关闭标签管理器
      await page.click('#closeImageTagManagerModal');
      await page.waitForSelector('#imageTagManagerModal', { state: 'hidden', timeout: 5000 });
      await page.screenshot({ path: 'test-results/drag-drop/image-08-manager-closed.png' });

      await ensureTagFilterExpanded(page, 'imageTagFilterSection', 'imageTagFilterToggleBtn');

      // 等待标签出现在筛选列表中（使用 waitForFunction 轮询检查）
      await page.waitForFunction((tagName: string) => {
        const tagElement = document.querySelector(`#imageTagFilterList .tag-filter-item[data-tag="${tagName}"]`);
        return tagElement !== null;
      }, testTagName, { timeout: 5000 });

      const newTagElement = page.locator(`#imageTagFilterList .tag-filter-item[data-tag="${testTagName}"]`);
      await expect(newTagElement).toBeVisible({ timeout: 5000 });

      // 执行拖拽操作 - 使用显式验证替代 waitForTimeout
      await newTagElement.hover();
      await expect(newTagElement).toBeVisible({ timeout: 5000 });
      await page.mouse.down();
      await targetCard.hover();
      await expect(targetCard).toBeVisible({ timeout: 5000 });
      await page.mouse.up();

      // 验证标签已添加 - 使用 waitForFunction 轮询检查
      await page.waitForFunction(async (params: { id: string; tag: string }) => {
        const image = await window.electronAPI.getImageById(params.id);
        return (image as IImage)?.tags?.includes(params.tag);
      }, { id: testImageId, tag: testTagName }, { timeout: 5000 });

      await page.screenshot({ path: 'test-results/drag-drop/image-09-tag-dropped.png' });

      // 验证标签已添加
      const newTags = await page.evaluate(async (id) => {
        const image = await window.electronAPI.getImageById(id as string);
        return (image as IImage)?.tags || [];
      }, testImageId);

      expect(newTags.length).toBeGreaterThan(originalTags.length);
      expect(newTags).toContain(testTagName);

      // 验证成功提示
      await page.waitForSelector('#toastContainer:has-text("标签已添加")', { timeout: 5000 });
      const toastContainer = page.locator('#toastContainer');

      // 第二次拖拽相同标签，应该提示"标签已存在"
      await newTagElement.hover();
      await expect(newTagElement).toBeVisible({ timeout: 5000 });
      await page.mouse.down();
      await targetCard.hover();
      await expect(targetCard).toBeVisible({ timeout: 5000 });
      await page.mouse.up();

      // 等待提示消息更新
      await page.waitForSelector('#toastContainer:has-text("该标签已存在")', { timeout: 5000 });
      const toastMessageAfterSecondDrop = await toastContainer.textContent();
      expect(toastMessageAfterSecondDrop).toContain('该标签已存在');
    });
  });

  test.describe('提示词标签拖拽', () => {
    test('标签拖拽到提示词卡片 - 展开状态', async () => {
      const page = electronTest.getPage();

      await enterPromptGridView(page);

      const targetCard = page.locator(`.prompt-card[data-id="${testPromptId}"]`);
      await expect(targetCard).toBeVisible({ timeout: 5000 });

      const originalTags = await page.evaluate(async (id) => {
        const prompt = await window.electronAPI.getPromptById(id as string);
        return (prompt as IPrompt)?.tags || [];
      }, testPromptId);

      await ensureTagFilterExpanded(page, 'promptTagFilterSection', 'promptTagFilterToggleBtn');
      await page.screenshot({ path: 'test-results/drag-drop/prompt-04-filter-expanded.png' });

      const testTagName = `e2e_prompt_tag_${Date.now()}`;

      // 打开提示词标签管理器
      await page.click('#promptTagManagerBtn');
      await page.waitForSelector('#promptTagManagerModal', { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/drag-drop/prompt-05-manager-opened.png' });

      // 新建标签
      await page.click('#addPromptTagInManagerBtn');
      await page.waitForSelector('#inputModalField', { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/drag-drop/prompt-06-input-dialog.png' });

      const tagInputDialogInput = page.locator('#inputModalField');
      await tagInputDialogInput.fill(testTagName);

      const groupSelect = page.locator('#inputModalGroupSelect');
      await groupSelect.selectOption({ index: 1 });

      await page.click('#inputOkBtn');

      // 使用 waitForFunction 轮询检查标签是否创建成功（更可靠）
      await page.waitForFunction(async (tagName: string) => {
        const tags = await window.electronAPI.getAllTags();
        return tags.includes(tagName);
      }, testTagName, { timeout: 5000 });

      await page.screenshot({ path: 'test-results/drag-drop/prompt-07-tag-created.png' });

      // 关闭标签管理器
      await page.click('#closePromptTagManagerModal');
      await page.waitForSelector('#promptTagManagerModal', { state: 'hidden', timeout: 5000 });
      await page.screenshot({ path: 'test-results/drag-drop/prompt-08-manager-closed.png' });

      await ensureTagFilterExpanded(page, 'promptTagFilterSection', 'promptTagFilterToggleBtn');

      // 等待标签出现在筛选列表中（使用 waitForFunction 轮询检查）
      await page.waitForFunction((tagName: string) => {
        const tagElement = document.querySelector(`#promptTagFilterList .tag-filter-item[data-tag="${tagName}"]`);
        return tagElement !== null;
      }, testTagName, { timeout: 5000 });

      const newTagElement = page.locator(`#promptTagFilterList .tag-filter-item[data-tag="${testTagName}"]`);
      await expect(newTagElement).toBeVisible({ timeout: 5000 });

      // 执行拖拽操作 - 使用显式验证替代 waitForTimeout
      await newTagElement.hover();
      await expect(newTagElement).toBeVisible({ timeout: 5000 });
      await page.mouse.down();
      await targetCard.hover();
      await expect(targetCard).toBeVisible({ timeout: 5000 });
      await page.mouse.up();

      // 验证标签已添加 - 使用 waitForFunction 轮询检查
      await page.waitForFunction(async (params: { id: string; tag: string }) => {
        const prompt = await window.electronAPI.getPromptById(params.id);
        return (prompt as IPrompt)?.tags?.includes(params.tag);
      }, { id: testPromptId, tag: testTagName }, { timeout: 5000 });

      await page.screenshot({ path: 'test-results/drag-drop/prompt-09-tag-dropped.png' });

      // 验证标签已添加
      const newTags = await page.evaluate(async (id) => {
        const prompt = await window.electronAPI.getPromptById(id as string);
        return (prompt as IPrompt)?.tags || [];
      }, testPromptId);

      expect(newTags.length).toBeGreaterThan(originalTags.length);
      expect(newTags).toContain(testTagName);

      // 验证成功提示
      await page.waitForSelector('#toastContainer:has-text("标签已添加")', { timeout: 5000 });
      const toastContainer = page.locator('#toastContainer');

      // 第二次拖拽相同标签，应该提示"标签已存在"
      await newTagElement.hover();
      await expect(newTagElement).toBeVisible({ timeout: 5000 });
      await page.mouse.down();
      await targetCard.hover();
      await expect(targetCard).toBeVisible({ timeout: 5000 });
      await page.mouse.up();

      // 等待提示消息更新
      await page.waitForSelector('#toastContainer:has-text("该标签已存在")', { timeout: 5000 });
      const toastMessageAfterSecondDrop = await toastContainer.textContent();
      expect(toastMessageAfterSecondDrop).toContain('该标签已存在');
    });
  });
});

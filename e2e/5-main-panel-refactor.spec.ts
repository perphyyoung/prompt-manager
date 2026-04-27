import { expect } from '@playwright/test';
import { test, enterImageGridView, enterImageListView, enterPromptGridView, enterPromptListView, restoreImageFavoriteStatus, restorePromptFavoriteStatus } from './electron-test.ts';
import type { IImage, IPrompt } from '../src/preload/index.ts';
import { Constants } from '../src/constants.ts';

/**
 * 主界面重构功能 E2E 测试
 *
 * 测试场景：
 * 1. 卡片收藏按钮功能（图像和提示词）
 * 2. 卡片复制按钮功能（图像和提示词）
 * 3. 列表视图按钮功能（图像和提示词）
 * 4. 标签筛选区域收起/展开切换（图像和提示词）
 * 5. 收藏状态在卡片和列表视图间同步（图像和提示词）
 */
test.describe('主界面重构功能', () => {

  // 存储测试用数据的 ID
  let testImageId: string = '';
  let testPromptId: string = '';

  // 辅助函数：获取测试图像ID
  async function getTestImageId(page: any): Promise<string> {
    await page.click('#imageManagerBtn');
    await page.waitForSelector('#imagePanel', { state: 'visible', timeout: 1000 });
    await page.click('#imageGridViewBtn');
    const firstImageCard = page.locator('.image-card').first();
    await expect(firstImageCard).toBeVisible({ timeout: 1000 });
    return await firstImageCard.getAttribute('data-id') || '';
  }

  // 辅助函数：获取测试提示词ID
  async function getTestPromptId(page: any): Promise<string> {
    await page.click('#promptManagerBtn');
    await page.waitForSelector('#promptPanel', { state: 'visible', timeout: 1000 });
    await page.click('#promptGridViewBtn');
    const firstPromptCard = page.locator('.prompt-card').first();
    await expect(firstPromptCard).toBeVisible({ timeout: 1000 });
    return await firstPromptCard.getAttribute('data-id') || '';
  }
  test.describe('图像面板功能', () => {
    test('图像卡片收藏按钮功能', async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      // 获取测试图像ID
      testImageId = await getTestImageId(page);

      await enterImageGridView(page);

      const targetCard = page.locator(`.image-card[data-id="${testImageId}"]`);
      await expect(targetCard).toBeVisible({ timeout: 1000 });

      const originalFavoriteStatus = await page.evaluate(async (id: string) => {
        const image = await window.electronAPI.getImageById(id);
        return !!(image as IImage)?.isFavorite;
      }, testImageId);

      await targetCard.hover();
      const favoriteBtn = targetCard.locator('.favorite-btn');
      await favoriteBtn.click();

      const newFavoriteStatus = await page.evaluate(async (id: string) => {
        const image = await window.electronAPI.getImageById(id);
        return !!(image as IImage)?.isFavorite;
      }, testImageId);

      expect(newFavoriteStatus).toBe(!originalFavoriteStatus);

      const isBtnActive = await favoriteBtn.evaluate((el: HTMLElement) => el.classList.contains('active'));
      expect(isBtnActive).toBe(!originalFavoriteStatus);

      // 恢复原始收藏状态
      if (newFavoriteStatus !== originalFavoriteStatus) {
        await restoreImageFavoriteStatus(page, testImageId, originalFavoriteStatus);
      }
    });

    test('图像卡片复制按钮功能', async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      // 获取测试图像ID
      testImageId = await getTestImageId(page);

      await enterImageGridView(page);

      const targetCard = page.locator(`.image-card[data-id="${testImageId}"]`);
      await expect(targetCard).toBeVisible({ timeout: 1000 });

      await targetCard.hover();
      const copyBtn = targetCard.locator('.copy-btn');
      await copyBtn.click();

      const toastVisible = await page.locator(`#${Constants.Ids.TOAST_CONTAINER}`).isVisible();
      expect(toastVisible).toBe(true);
    });

    test('图像列表视图收藏按钮功能', async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      // 获取测试图像ID
      testImageId = await getTestImageId(page);

      await enterImageListView(page);

      const targetItem = page.locator(`.list-item--image[data-id="${testImageId}"]`);
      await expect(targetItem).toBeVisible({ timeout: 1000 });

      const originalFavoriteStatus = await page.evaluate(async (id: string) => {
        const image = await window.electronAPI.getImageById(id);
        return !!(image as IImage)?.isFavorite;
      }, testImageId);

      const favoriteBtn = targetItem.locator('.favorite-btn');
      await favoriteBtn.click();

      const newFavoriteStatus = await page.evaluate(async (id: string) => {
        const image = await window.electronAPI.getImageById(id);
        return !!(image as IImage)?.isFavorite;
      }, testImageId);

      expect(newFavoriteStatus).toBe(!originalFavoriteStatus);

      // 恢复原始收藏状态
      if (newFavoriteStatus !== originalFavoriteStatus) {
        await restoreImageFavoriteStatus(page, testImageId, originalFavoriteStatus);
      }
    });

    test('图像列表视图复制按钮功能', async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      // 获取测试图像ID
      testImageId = await getTestImageId(page);

      await enterImageListView(page);

      const targetItem = page.locator(`.list-item--image[data-id="${testImageId}"]`);
      await expect(targetItem).toBeVisible({ timeout: 1000 });

      const copyBtn = targetItem.locator('.copy-btn');
      await copyBtn.click();

      const toastVisible = await page.locator(`#${Constants.Ids.TOAST_CONTAINER}`).isVisible();
      expect(toastVisible).toBe(true);
    });

    test('图像标签筛选区域收起/展开切换', async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterImageGridView(page);

      const tagFilterSection = page.locator(`#${Constants.Ids.IMAGE_TAG_FILTER_SECTION}`);
      let isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));

      if (isCollapsed) {
        await page.click(`#${Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN}`);
        await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_FILTER_CONTENT}`, { state: 'visible', timeout: 1000 });
      }

      isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));
      expect(isCollapsed).toBe(false);

      const isContentVisible = await page.locator(`#${Constants.Ids.IMAGE_TAG_FILTER_CONTENT}`).isVisible();
      expect(isContentVisible).toBe(true);

      await page.click(`#${Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_FILTER_CONTENT}`, { state: 'hidden', timeout: 1000 });

      isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));
      expect(isCollapsed).toBe(true);

      const isContentHidden = await page.locator(`#${Constants.Ids.IMAGE_TAG_FILTER_CONTENT}`).isHidden();
      expect(isContentHidden).toBe(true);

      await page.click(`#${Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_FILTER_CONTENT}`, { state: 'visible', timeout: 1000 });

      isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));
      expect(isCollapsed).toBe(false);
    });

    test('图像收藏状态在卡片和列表视图间同步', async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      const firstCard = await enterImageGridView(page);
      const imageId = await firstCard.getAttribute('data-id');

      await firstCard.hover();
      const favoriteBtn = firstCard.locator('.favorite-btn');
      await favoriteBtn.click();

      const favoriteStatusAfterCardClick = await page.evaluate(async (id: string) => {
        const image = await window.electronAPI.getImageById(id);
        return (image as IImage)?.isFavorite || false;
      }, imageId as string);

      await page.click('#imageListViewBtn');
      const listItem = page.locator(`.list-item--image[data-id="${imageId}"]`);
      await expect(listItem).toBeVisible({ timeout: 1000 });

      const listFavoriteBtn = listItem.locator('.favorite-btn');
      const isListBtnActive = await listFavoriteBtn.evaluate((el: HTMLElement) => el.classList.contains('active'));
      expect(isListBtnActive).toBe(favoriteStatusAfterCardClick);

      await listFavoriteBtn.click();

      await page.click('#imageGridViewBtn');
      const cardAfterSwitch = page.locator(`.image-card[data-id="${imageId}"]`);
      await expect(cardAfterSwitch).toBeVisible({ timeout: 1000 });

      const cardFavoriteBtn = cardAfterSwitch.locator('.favorite-btn');
      const isCardBtnActive = await cardFavoriteBtn.evaluate((el: HTMLElement) => el.classList.contains('active'));

      const finalFavoriteStatus = await page.evaluate(async (id: string) => {
        const image = await window.electronAPI.getImageById(id);
        return (image as IImage)?.isFavorite || false;
      }, imageId as string);

      expect(isCardBtnActive).toBe(finalFavoriteStatus);
    });
  });

  test.describe('提示词面板功能', () => {
    test('提示词卡片收藏按钮功能', async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      // 获取测试提示词ID
      testPromptId = await getTestPromptId(page);

      await enterPromptGridView(page);

      const targetCard = page.locator(`.prompt-card[data-id="${testPromptId}"]`);
      await expect(targetCard).toBeVisible({ timeout: 1000 });

      const originalFavoriteStatus = await page.evaluate(async (id: string) => {
        const prompts = await window.electronAPI.getPrompts('updatedAt', 'desc');
        const prompt = prompts.find((p: IPrompt) => String(p.id) === id);
        return !!(prompt?.isFavorite);
      }, testPromptId);

      await targetCard.hover();
      const favoriteBtn = targetCard.locator('.favorite-btn');
      await favoriteBtn.click();

      const newFavoriteStatus = await page.evaluate(async (id: string) => {
        const prompts = await window.electronAPI.getPrompts('updatedAt', 'desc');
        const prompt = prompts.find((p: IPrompt) => String(p.id) === id);
        return !!(prompt?.isFavorite);
      }, testPromptId);

      expect(newFavoriteStatus).toBe(!originalFavoriteStatus);

      const isBtnActive = await favoriteBtn.evaluate((el: HTMLElement) => el.classList.contains('active'));
      expect(isBtnActive).toBe(!originalFavoriteStatus);

      // 恢复原始收藏状态
      if (newFavoriteStatus !== originalFavoriteStatus) {
        await restorePromptFavoriteStatus(page, testPromptId, originalFavoriteStatus);
      }
    });

    test('提示词卡片复制按钮功能', async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      // 获取测试提示词ID
      testPromptId = await getTestPromptId(page);

      await enterPromptGridView(page);

      const targetCard = page.locator(`.prompt-card[data-id="${testPromptId}"]`);
      await expect(targetCard).toBeVisible({ timeout: 1000 });

      await targetCard.hover();
      const copyBtn = targetCard.locator('.copy-btn');
      await copyBtn.click();

      const toastVisible = await page.locator(`#${Constants.Ids.TOAST_CONTAINER}`).isVisible();
      expect(toastVisible).toBe(true);
    });

    test('提示词列表视图收藏按钮功能', async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      // 获取测试提示词ID
      testPromptId = await getTestPromptId(page);

      await enterPromptListView(page);

      const targetItem = page.locator(`.list-item--prompt[data-id="${testPromptId}"]`);
      await expect(targetItem).toBeVisible({ timeout: 1000 });

      const originalFavoriteStatus = await page.evaluate(async (id: string) => {
        const prompts = await window.electronAPI.getPrompts('updatedAt', 'desc');
        const prompt = prompts.find((p: IPrompt) => String(p.id) === id);
        return !!(prompt?.isFavorite);
      }, testPromptId);

      const favoriteBtn = targetItem.locator('.favorite-btn');
      await favoriteBtn.click();

      const newFavoriteStatus = await page.evaluate(async (id: string) => {
        const prompts = await window.electronAPI.getPrompts('updatedAt', 'desc');
        const prompt = prompts.find((p: IPrompt) => String(p.id) === id);
        return !!(prompt?.isFavorite);
      }, testPromptId);

      expect(newFavoriteStatus).toBe(!originalFavoriteStatus);

      // 恢复原始收藏状态
      if (newFavoriteStatus !== originalFavoriteStatus) {
        await restorePromptFavoriteStatus(page, testPromptId, originalFavoriteStatus);
      }
    });

    test('提示词列表视图复制按钮功能', async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      // 获取测试提示词ID
      testPromptId = await getTestPromptId(page);

      await enterPromptListView(page);

      const targetItem = page.locator(`.list-item--prompt[data-id="${testPromptId}"]`);
      await expect(targetItem).toBeVisible({ timeout: 1000 });

      const copyBtn = targetItem.locator('.copy-btn');
      await copyBtn.click();

      const toastVisible = await page.locator(`#${Constants.Ids.TOAST_CONTAINER}`).isVisible();
      expect(toastVisible).toBe(true);
    });

    test('提示词标签筛选区域收起/展开切换', async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      await enterPromptGridView(page);

      const tagFilterSection = page.locator(`#${Constants.Ids.PROMPT_TAG_FILTER_SECTION}`);
      let isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));

      if (isCollapsed) {
        await page.click(`#${Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN}`);
        await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_FILTER_CONTENT}`, { state: 'visible', timeout: 1000 });
      }

      isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));
      expect(isCollapsed).toBe(false);

      const isContentVisible = await page.locator(`#${Constants.Ids.PROMPT_TAG_FILTER_CONTENT}`).isVisible();
      expect(isContentVisible).toBe(true);

      await page.click(`#${Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_FILTER_CONTENT}`, { state: 'hidden', timeout: 1000 });

      isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));
      expect(isCollapsed).toBe(true);

      const isContentHidden = await page.locator(`#${Constants.Ids.PROMPT_TAG_FILTER_CONTENT}`).isHidden();
      expect(isContentHidden).toBe(true);

      await page.click(`#${Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_FILTER_CONTENT}`, { state: 'visible', timeout: 1000 });

      isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));
      expect(isCollapsed).toBe(false);
    });

    test('提示词收藏状态在卡片和列表视图间同步', async ({ electronTest, page }) => {
      await electronTest.logTestStart();
      const firstCard = await enterPromptGridView(page);
      const promptId = await firstCard.getAttribute('data-id');

      await firstCard.hover();
      const favoriteBtn = firstCard.locator('.favorite-btn');
      await favoriteBtn.click();

      const favoriteStatusAfterCardClick = await page.evaluate(async (id: string) => {
        const prompts = await window.electronAPI.getPrompts('updatedAt', 'desc');
        const prompt = prompts.find((p: IPrompt) => String(p.id) === id);
        return prompt?.isFavorite || false;
      }, promptId as string);

      await page.click('#promptListViewBtn');
      const listItem = page.locator(`.list-item--prompt[data-id="${promptId}"]`);
      await expect(listItem).toBeVisible({ timeout: 1000 });

      const listFavoriteBtn = listItem.locator('.favorite-btn');
      const isListBtnActive = await listFavoriteBtn.evaluate((el: HTMLElement) => el.classList.contains('active'));
      expect(isListBtnActive).toBe(favoriteStatusAfterCardClick);

      await listFavoriteBtn.click();

      await page.click('#promptGridViewBtn');
      const cardAfterSwitch = page.locator(`.prompt-card[data-id="${promptId}"]`);
      await expect(cardAfterSwitch).toBeVisible({ timeout: 1000 });

      const cardFavoriteBtn = cardAfterSwitch.locator('.favorite-btn');
      const isCardBtnActive = await cardFavoriteBtn.evaluate((el: HTMLElement) => el.classList.contains('active'));

      const finalFavoriteStatus = await page.evaluate(async (id: string) => {
        const prompts = await window.electronAPI.getPrompts('updatedAt', 'desc');
        const prompt = prompts.find((p: IPrompt) => String(p.id) === id);
        return prompt?.isFavorite || false;
      }, promptId as string);

      expect(isCardBtnActive).toBe(finalFavoriteStatus);
    });
  });
});

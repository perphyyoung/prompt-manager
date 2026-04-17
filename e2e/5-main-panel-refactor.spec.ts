import { test, expect } from '@playwright/test';
import { createElectronTest, enterImageGridView, enterImageListView, enterPromptGridView, enterPromptListView } from './electron-test.ts';
import type { IElectronAPI, IImage, IPrompt } from '../src/preload/index.ts';
import { Constants } from '../src/constants.ts';

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

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
  const electronTest = createElectronTest();

  // 存储测试用数据的 ID
  let testImageId: string = '';
  let testPromptId: string = '';

  test.beforeAll(async () => {
    await electronTest.launch();

    const page = electronTest.getPage();

    // 获取测试用图像 ID
    await page.click('#imageManagerBtn');
    await page.waitForSelector('#imagePanel', { state: 'visible', timeout: 5000 });
    await page.click('#imageGridViewBtn');
    const firstImageCard = page.locator('.image-card').first();
    await expect(firstImageCard).toBeVisible({ timeout: 5000 });
    testImageId = await firstImageCard.getAttribute('data-id') || '';

    // 获取测试用提示词 ID
    await page.click('#promptManagerBtn');
    await page.waitForSelector('#promptPanel', { state: 'visible', timeout: 5000 });
    await page.click('#promptGridViewBtn');
    const firstPromptCard = page.locator('.prompt-card').first();
    await expect(firstPromptCard).toBeVisible({ timeout: 5000 });
    testPromptId = await firstPromptCard.getAttribute('data-id') || '';
  });

  test.afterAll(async () => {
    await electronTest.close();
  });

  test.describe('图像面板功能', () => {
    test('图像卡片收藏按钮功能', async () => {
      const page = electronTest.getPage();
      await enterImageGridView(page);

      const targetCard = page.locator(`.image-card[data-id="${testImageId}"]`);
      await expect(targetCard).toBeVisible({ timeout: 5000 });

      const originalFavoriteStatus = await page.evaluate(async (id: string) => {
        const image = await window.electronAPI.getImageById(id);
        return (image as IImage)?.isFavorite || false;
      }, testImageId);

      await targetCard.hover();
      const favoriteBtn = targetCard.locator('.favorite-btn');
      await favoriteBtn.click();
      await page.screenshot({ path: 'test-results/refactor/image-favorite-clicked.png' });

      const newFavoriteStatus = await page.evaluate(async (id: string) => {
        const image = await window.electronAPI.getImageById(id);
        return (image as IImage)?.isFavorite || false;
      }, testImageId);

      expect(newFavoriteStatus).toBe(!originalFavoriteStatus);

      const isBtnActive = await favoriteBtn.evaluate((el: HTMLElement) => el.classList.contains('active'));
      expect(isBtnActive).toBe(!originalFavoriteStatus);
    });

    test('图像卡片复制按钮功能', async () => {
      const page = electronTest.getPage();
      await enterImageGridView(page);

      const targetCard = page.locator(`.image-card[data-id="${testImageId}"]`);
      await expect(targetCard).toBeVisible({ timeout: 5000 });

      await targetCard.hover();
      const copyBtn = targetCard.locator('.copy-btn');
      await copyBtn.click();
      await page.screenshot({ path: 'test-results/refactor/image-copy-clicked.png' });

      const toastVisible = await page.locator(`#${Constants.Ids.TOAST_CONTAINER}`).isVisible();
      expect(toastVisible).toBe(true);
    });

    test('图像列表视图收藏按钮功能', async () => {
      const page = electronTest.getPage();
      await enterImageListView(page);

      const targetItem = page.locator(`.list-item--image[data-id="${testImageId}"]`);
      await expect(targetItem).toBeVisible({ timeout: 5000 });

      const originalFavoriteStatus = await page.evaluate(async (id: string) => {
        const image = await window.electronAPI.getImageById(id);
        return (image as IImage)?.isFavorite || false;
      }, testImageId);

      const favoriteBtn = targetItem.locator('.favorite-btn');
      await favoriteBtn.click();
      await page.screenshot({ path: 'test-results/refactor/image-list-favorite-clicked.png' });

      const newFavoriteStatus = await page.evaluate(async (id: string) => {
        const image = await window.electronAPI.getImageById(id);
        return (image as IImage)?.isFavorite || false;
      }, testImageId);

      expect(newFavoriteStatus).toBe(!originalFavoriteStatus);
    });

    test('图像列表视图复制按钮功能', async () => {
      const page = electronTest.getPage();
      await enterImageListView(page);

      const targetItem = page.locator(`.list-item--image[data-id="${testImageId}"]`);
      await expect(targetItem).toBeVisible({ timeout: 5000 });

      const copyBtn = targetItem.locator('.copy-btn');
      await copyBtn.click();
      await page.screenshot({ path: 'test-results/refactor/image-list-copy-clicked.png' });

      const toastVisible = await page.locator(`#${Constants.Ids.TOAST_CONTAINER}`).isVisible();
      expect(toastVisible).toBe(true);
    });

    test('图像标签筛选区域收起/展开切换', async () => {
      const page = electronTest.getPage();
      await enterImageGridView(page);

      const tagFilterSection = page.locator(`#${Constants.Ids.IMAGE_TAG_FILTER_SECTION}`);
      let isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));

      if (isCollapsed) {
        await page.click(`#${Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN}`);
        await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_FILTER_CONTENT}`, { state: 'visible', timeout: 5000 });
      }

      isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));
      expect(isCollapsed).toBe(false);

      const isContentVisible = await page.locator(`#${Constants.Ids.IMAGE_TAG_FILTER_CONTENT}`).isVisible();
      expect(isContentVisible).toBe(true);
      await page.screenshot({ path: 'test-results/refactor/image-filter-expanded.png' });

      await page.click(`#${Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_FILTER_CONTENT}`, { state: 'hidden', timeout: 5000 });

      isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));
      expect(isCollapsed).toBe(true);

      const isContentHidden = await page.locator(`#${Constants.Ids.IMAGE_TAG_FILTER_CONTENT}`).isHidden();
      expect(isContentHidden).toBe(true);
      await page.screenshot({ path: 'test-results/refactor/image-filter-collapsed.png' });

      await page.click(`#${Constants.Ids.IMAGE_TAG_FILTER_TOGGLE_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.IMAGE_TAG_FILTER_CONTENT}`, { state: 'visible', timeout: 5000 });

      isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));
      expect(isCollapsed).toBe(false);
    });

    test('图像收藏状态在卡片和列表视图间同步', async () => {
      const page = electronTest.getPage();
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
      await expect(listItem).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: 'test-results/refactor/image-list-after-favorite.png' });

      const listFavoriteBtn = listItem.locator('.favorite-btn');
      const isListBtnActive = await listFavoriteBtn.evaluate((el: HTMLElement) => el.classList.contains('active'));
      expect(isListBtnActive).toBe(favoriteStatusAfterCardClick);

      await listFavoriteBtn.click();

      await page.click('#imageGridViewBtn');
      const cardAfterSwitch = page.locator(`.image-card[data-id="${imageId}"]`);
      await expect(cardAfterSwitch).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: 'test-results/refactor/image-grid-after-unfavorite.png' });

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
    test('提示词卡片收藏按钮功能', async () => {
      const page = electronTest.getPage();
      await enterPromptGridView(page);

      const targetCard = page.locator(`.prompt-card[data-id="${testPromptId}"]`);
      await expect(targetCard).toBeVisible({ timeout: 5000 });

      const originalFavoriteStatus = await page.evaluate(async (id: string) => {
        const prompts = await window.electronAPI.getPrompts('updatedAt', 'desc');
        const prompt = prompts.find((p: IPrompt) => String(p.id) === id);
        return prompt?.isFavorite || false;
      }, testPromptId);

      await targetCard.hover();
      const favoriteBtn = targetCard.locator('.favorite-btn');
      await favoriteBtn.click();
      await page.screenshot({ path: 'test-results/refactor/prompt-favorite-clicked.png' });

      const newFavoriteStatus = await page.evaluate(async (id: string) => {
        const prompts = await window.electronAPI.getPrompts('updatedAt', 'desc');
        const prompt = prompts.find((p: IPrompt) => String(p.id) === id);
        return prompt?.isFavorite || false;
      }, testPromptId);

      expect(newFavoriteStatus).toBe(!originalFavoriteStatus);

      const isBtnActive = await favoriteBtn.evaluate((el: HTMLElement) => el.classList.contains('active'));
      expect(isBtnActive).toBe(!originalFavoriteStatus);
    });

    test('提示词卡片复制按钮功能', async () => {
      const page = electronTest.getPage();
      await enterPromptGridView(page);

      const targetCard = page.locator(`.prompt-card[data-id="${testPromptId}"]`);
      await expect(targetCard).toBeVisible({ timeout: 5000 });

      await targetCard.hover();
      const copyBtn = targetCard.locator('.copy-btn');
      await copyBtn.click();
      await page.screenshot({ path: 'test-results/refactor/prompt-copy-clicked.png' });

      const toastVisible = await page.locator(`#${Constants.Ids.TOAST_CONTAINER}`).isVisible();
      expect(toastVisible).toBe(true);
    });

    test('提示词列表视图收藏按钮功能', async () => {
      const page = electronTest.getPage();
      await enterPromptListView(page);

      const targetItem = page.locator(`.list-item--prompt[data-id="${testPromptId}"]`);
      await expect(targetItem).toBeVisible({ timeout: 5000 });

      const originalFavoriteStatus = await page.evaluate(async (id: string) => {
        const prompts = await window.electronAPI.getPrompts('updatedAt', 'desc');
        const prompt = prompts.find((p: IPrompt) => String(p.id) === id);
        return prompt?.isFavorite || false;
      }, testPromptId);

      const favoriteBtn = targetItem.locator('.favorite-btn');
      await favoriteBtn.click();
      await page.screenshot({ path: 'test-results/refactor/prompt-list-favorite-clicked.png' });

      const newFavoriteStatus = await page.evaluate(async (id: string) => {
        const prompts = await window.electronAPI.getPrompts('updatedAt', 'desc');
        const prompt = prompts.find((p: IPrompt) => String(p.id) === id);
        return prompt?.isFavorite || false;
      }, testPromptId);

      expect(newFavoriteStatus).toBe(!originalFavoriteStatus);
    });

    test('提示词列表视图复制按钮功能', async () => {
      const page = electronTest.getPage();
      await enterPromptListView(page);

      const targetItem = page.locator(`.list-item--prompt[data-id="${testPromptId}"]`);
      await expect(targetItem).toBeVisible({ timeout: 5000 });

      const copyBtn = targetItem.locator('.copy-btn');
      await copyBtn.click();
      await page.screenshot({ path: 'test-results/refactor/prompt-list-copy-clicked.png' });

      const toastVisible = await page.locator(`#${Constants.Ids.TOAST_CONTAINER}`).isVisible();
      expect(toastVisible).toBe(true);
    });

    test('提示词标签筛选区域收起/展开切换', async () => {
      const page = electronTest.getPage();
      await enterPromptGridView(page);

      const tagFilterSection = page.locator(`#${Constants.Ids.PROMPT_TAG_FILTER_SECTION}`);
      let isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));

      if (isCollapsed) {
        await page.click(`#${Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN}`);
        await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_FILTER_CONTENT}`, { state: 'visible', timeout: 5000 });
      }

      isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));
      expect(isCollapsed).toBe(false);

      const isContentVisible = await page.locator(`#${Constants.Ids.PROMPT_TAG_FILTER_CONTENT}`).isVisible();
      expect(isContentVisible).toBe(true);
      await page.screenshot({ path: 'test-results/refactor/prompt-filter-expanded.png' });

      await page.click(`#${Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_FILTER_CONTENT}`, { state: 'hidden', timeout: 5000 });

      isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));
      expect(isCollapsed).toBe(true);

      const isContentHidden = await page.locator(`#${Constants.Ids.PROMPT_TAG_FILTER_CONTENT}`).isHidden();
      expect(isContentHidden).toBe(true);
      await page.screenshot({ path: 'test-results/refactor/prompt-filter-collapsed.png' });

      await page.click(`#${Constants.Ids.PROMPT_TAG_FILTER_TOGGLE_BTN}`);
      await page.waitForSelector(`#${Constants.Ids.PROMPT_TAG_FILTER_CONTENT}`, { state: 'visible', timeout: 5000 });

      isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));
      expect(isCollapsed).toBe(false);
    });

    test('提示词收藏状态在卡片和列表视图间同步', async () => {
      const page = electronTest.getPage();
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
      await expect(listItem).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: 'test-results/refactor/prompt-list-after-favorite.png' });

      const listFavoriteBtn = listItem.locator('.favorite-btn');
      const isListBtnActive = await listFavoriteBtn.evaluate((el: HTMLElement) => el.classList.contains('active'));
      expect(isListBtnActive).toBe(favoriteStatusAfterCardClick);

      await listFavoriteBtn.click();

      await page.click('#promptGridViewBtn');
      const cardAfterSwitch = page.locator(`.prompt-card[data-id="${promptId}"]`);
      await expect(cardAfterSwitch).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: 'test-results/refactor/prompt-grid-after-unfavorite.png' });

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

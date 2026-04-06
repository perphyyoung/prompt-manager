import { test, expect } from '@playwright/test';
import { createElectronTest } from './electron-test.ts';
import type { IElectronAPI, IImage } from '../src/preload/index.ts';

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

/**
 * 图像主界面重构功能 E2E 测试
 *
 * 测试场景：
 * 1. 卡片收藏按钮功能
 * 2. 卡片复制按钮功能（复制提示词内容）
 * 3. 列表视图按钮功能
 * 4. 标签拖拽到卡片功能
 *
 * 进入目标界面步骤：
 * 1. 点击 #imageManagerBtn 切换到图像面板
 * 2. 点击 #imageGridViewBtn 确保处于网格视图
 * 3. 等待 .image-card 元素可见
 */
test.describe('图像主界面重构功能', () => {
  const electronTest = createElectronTest();

  // 存储测试用图像的 ID
  let testImageId: string = '';

  test.beforeAll(async () => {
    await electronTest.launch();

    // 在开始所有测试前，找到第一张有提示词关联的图像
    const page = electronTest.getPage();
    await page.click('#imageManagerBtn');
    await page.waitForTimeout(100);
    await page.click('#imageGridViewBtn');
    await page.waitForTimeout(100);

    // 查找第一个有关联提示词的图像
    const images = await page.evaluate(async () => {
      const allImages = await window.electronAPI.getImages('date', 'desc');
      // 找到第一个有提示词引用的图像
      const imageWithPrompt = allImages.find(img => img.promptRefs && img.promptRefs.length > 0 && img.promptRefs[0].promptContent);
      return imageWithPrompt || allImages[0];
    });

    testImageId = String(images.id);
  });

  test.afterAll(async () => {
    await electronTest.close();
  });

  /**
   * 进入图像网格视图的辅助函数
   */
  async function enterImageGridView(page: any) {
    // 1. 切换到图像面板
    await page.click('#imageManagerBtn');
    await page.waitForTimeout(100);
    await page.screenshot({ path: 'test-results/refactor/01-image-panel.png' });

    // 2. 确保处于网格视图（点击网格视图按钮）
    const gridViewBtn = page.locator('#imageGridViewBtn');
    await gridViewBtn.click();
    await page.waitForTimeout(100);
    await page.screenshot({ path: 'test-results/refactor/02-grid-view.png' });

    // 3. 等待图像卡片加载
    const firstCard = page.locator('.image-card').first();
    await expect(firstCard).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/refactor/03-cards-loaded.png' });

    return firstCard;
  }

  /**
   * 进入图像列表视图的辅助函数
   */
  async function enterImageListView(page: any) {
    // 1. 切换到图像面板
    await page.click('#imageManagerBtn');
    await page.waitForTimeout(100);

    // 2. 切换到列表视图
    await page.click('#imageListViewBtn');
    await page.waitForTimeout(100);
    await page.screenshot({ path: 'test-results/refactor/04-list-view.png' });

    // 3. 等待列表项加载
    const firstItem = page.locator('.list-item--image').first();
    await expect(firstItem).toBeVisible({ timeout: 5000 });

    return firstItem;
  }

  test('卡片收藏按钮功能', async () => {
    const page = electronTest.getPage();

    // 进入图像网格视图
    await enterImageGridView(page);

    // 使用预先选定的测试图像
    const targetCard = page.locator(`.image-card[data-id="${testImageId}"]`);
    await expect(targetCard).toBeVisible({ timeout: 5000 });

    // 获取原始收藏状态
    const originalFavoriteStatus = await page.evaluate(async (id) => {
      const image = await window.electronAPI.getImageById(id as string);
      return (image as IImage)?.isFavorite || false;
    }, testImageId);

    // hover 卡片显示按钮
    await targetCard.hover();
    await page.waitForTimeout(100);

    // 点击收藏按钮
    const favoriteBtn = targetCard.locator('.favorite-btn');
    await favoriteBtn.click();
    await page.screenshot({ path: 'test-results/refactor/05-favorite-clicked.png' });

    // 验证收藏状态已切换
    const newFavoriteStatus = await page.evaluate(async (id) => {
      const image = await window.electronAPI.getImageById(id as string);
      return (image as IImage)?.isFavorite || false;
    }, testImageId);

    expect(newFavoriteStatus).toBe(!originalFavoriteStatus);

    // 验证按钮 UI 已更新
    const isBtnActive = await favoriteBtn.evaluate((el: HTMLElement) => el.classList.contains('active'));
    expect(isBtnActive).toBe(!originalFavoriteStatus);
  });

  test('卡片复制按钮功能 - 有提示词内容', async () => {
    const page = electronTest.getPage();

    // 进入图像网格视图
    await enterImageGridView(page);

    // 使用预先选定的测试图像
    const targetCard = page.locator(`.image-card[data-id="${testImageId}"]`);
    await expect(targetCard).toBeVisible({ timeout: 5000 });

    // hover 卡片显示按钮
    await targetCard.hover();
    await page.waitForTimeout(100);

    // 点击复制按钮
    const copyBtn = targetCard.locator('.copy-btn');
    await copyBtn.click();
    await page.screenshot({ path: 'test-results/refactor/06-copy-clicked.png' });

    // 验证提示消息
    const toastVisible = await page.locator('#toastContainer').isVisible();
    expect(toastVisible).toBe(true);
  });

  test('列表视图收藏按钮功能', async () => {
    const page = electronTest.getPage();

    // 进入图像列表视图
    await enterImageListView(page);

    // 使用预先选定的测试图像
    const targetItem = page.locator(`.list-item--image[data-id="${testImageId}"]`);
    await expect(targetItem).toBeVisible({ timeout: 5000 });

    // 获取原始收藏状态
    const originalFavoriteStatus = await page.evaluate(async (id) => {
      const image = await window.electronAPI.getImageById(id as string);
      return (image as IImage)?.isFavorite || false;
    }, testImageId);

    // 点击收藏按钮
    const favoriteBtn = targetItem.locator('.favorite-btn');
    await favoriteBtn.click();
    await page.screenshot({ path: 'test-results/refactor/07-list-favorite-clicked.png' });

    // 验证收藏状态已切换
    const newFavoriteStatus = await page.evaluate(async (id) => {
      const image = await window.electronAPI.getImageById(id as string);
      return (image as IImage)?.isFavorite || false;
    }, testImageId);

    expect(newFavoriteStatus).toBe(!originalFavoriteStatus);
  });

  test('列表视图复制按钮功能', async () => {
    const page = electronTest.getPage();

    // 进入图像列表视图
    await enterImageListView(page);

    // 使用预先选定的测试图像
    const targetItem = page.locator(`.list-item--image[data-id="${testImageId}"]`);
    await expect(targetItem).toBeVisible({ timeout: 5000 });

    // 点击复制按钮
    const copyBtn = targetItem.locator('.copy-btn');
    await copyBtn.click();
    await page.screenshot({ path: 'test-results/refactor/08-list-copy-clicked.png' });

    // 验证提示消息
    const toastVisible = await page.locator('#toastContainer').isVisible();
    expect(toastVisible).toBe(true);
  });

  test('标签筛选区域收起/展开切换', async () => {
    const page = electronTest.getPage();

    // 进入图像网格视图
    await enterImageGridView(page);

    // 初始状态：确保展开
    const tagFilterSection = page.locator('#imageTagFilterSection');
    let isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));

    if (isCollapsed) {
      await page.click('#imageTagFilterToggleBtn');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/refactor/11-tag-filter-expanded.png' });
    }

    // 验证展开状态
    isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));
    expect(isCollapsed).toBe(false);

    const isContentVisible = await page.locator('#imageTagFilterContent').isVisible();
    expect(isContentVisible).toBe(true);
    await page.screenshot({ path: 'test-results/refactor/12-filter-expanded.png' });

    // 点击收起
    await page.click('#imageTagFilterToggleBtn');
    await page.waitForTimeout(100);
    await page.screenshot({ path: 'test-results/refactor/13-filter-collapsed.png' });

    // 验证收起状态
    isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));
    expect(isCollapsed).toBe(true);

    const isContentHidden = await page.locator('#imageTagFilterContent').isHidden();
    expect(isContentHidden).toBe(true);

    // 再次点击展开
    await page.click('#imageTagFilterToggleBtn');
    await page.waitForTimeout(100);
    await page.screenshot({ path: 'test-results/refactor/14-filter-expanded-again.png' });

    // 验证再次展开
    isCollapsed = await tagFilterSection.evaluate((el: HTMLElement) => el.classList.contains('collapsed'));
    expect(isCollapsed).toBe(false);
  });

  test('收藏状态在卡片和列表视图间同步', async () => {
    const page = electronTest.getPage();

    // 进入图像网格视图
    const firstCard = await enterImageGridView(page);

    // 获取第一个图像的 ID
    const imageId = await firstCard.getAttribute('data-id');

    // hover 卡片显示按钮
    await firstCard.hover();
    await page.waitForTimeout(100);

    // 点击收藏按钮
    const favoriteBtn = firstCard.locator('.favorite-btn');
    await favoriteBtn.click();

    // 获取收藏后的状态
    const favoriteStatusAfterCardClick = await page.evaluate(async (id) => {
      const image = await window.electronAPI.getImageById(id as string);
      return (image as IImage)?.isFavorite || false;
    }, imageId);

    // 切换到列表视图
    await page.click('#imageListViewBtn');
    await page.waitForTimeout(100);
    await page.screenshot({ path: 'test-results/refactor/12-list-view-after-favorite.png' });

    // 等待列表项出现
    const listItem = page.locator(`.list-item--image[data-id="${imageId}"]`);
    await expect(listItem).toBeVisible({ timeout: 5000 });

    // 验证列表项的收藏按钮状态
    const listFavoriteBtn = listItem.locator('.favorite-btn');
    const isListBtnActive = await listFavoriteBtn.evaluate((el: HTMLElement) => el.classList.contains('active'));

    expect(isListBtnActive).toBe(favoriteStatusAfterCardClick);

    // 在列表视图中取消收藏
    await listFavoriteBtn.click();

    // 切换回网格视图
    await page.click('#imageGridViewBtn');
    await page.waitForTimeout(100);
    await page.screenshot({ path: 'test-results/refactor/13-grid-view-after-unfavorite.png' });

    // 等待卡片出现
    const cardAfterSwitch = page.locator(`.image-card[data-id="${imageId}"]`);
    await expect(cardAfterSwitch).toBeVisible({ timeout: 5000 });

    // 验证卡片收藏按钮状态
    const cardFavoriteBtn = cardAfterSwitch.locator('.favorite-btn');
    const isCardBtnActive = await cardFavoriteBtn.evaluate((el: HTMLElement) => el.classList.contains('active'));

    // 验证收藏状态已更新（应该是 false，因为刚刚取消了收藏）
    const finalFavoriteStatus = await page.evaluate(async (id) => {
      const image = await window.electronAPI.getImageById(id as string);
      return (image as IImage)?.isFavorite || false;
    }, imageId);

    expect(isCardBtnActive).toBe(finalFavoriteStatus);
  });
});

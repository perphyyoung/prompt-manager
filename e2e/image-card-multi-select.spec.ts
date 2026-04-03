import { test, expect } from '@playwright/test';
import { createElectronTest } from './electron-test.ts';
import type { IElectronAPI, IImage } from '../src/preload/index.ts';

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

/**
 * 图像主界面卡片视图多选功能 E2E 测试
 *
 * 测试场景：
 * 1. 复选框选中/取消选中
 * 2. 进入多选模式后复选框一直显示
 * 3. 批量工具栏按钮功能（反选、添加标签、收藏、删除、取消选择）
 * 4. Ctrl+A 全选
 * 5. 批量收藏功能
 * 6. 多选后切换视图保留选择状态
 *
 * 进入目标界面步骤：
 * 1. 点击 #imageManagerBtn 切换到图像面板
 * 2. 点击 #imageGridViewBtn 确保处于网格视图
 * 3. 等待 .image-card 元素可见
 */
test.describe('图像卡片视图多选功能', () => {
  const electronTest = createElectronTest();

  test.beforeEach(async () => {
    await electronTest.launch();
  });

  test.afterEach(async () => {
    await electronTest.close();
  });

  /**
   * 进入图像网格视图的辅助函数
   */
  async function enterImageGridView(page: any) {
    // 1. 切换到图像面板
    await page.click('#imageManagerBtn');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/multi-select/01-image-panel.png' });

    // 2. 确保处于网格视图（点击网格视图按钮）
    const gridViewBtn = page.locator('#imageGridViewBtn');
    await gridViewBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/multi-select/02-grid-view.png' });

    // 3. 等待图像卡片加载
    const firstCard = page.locator('.image-card').first();
    await expect(firstCard).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/multi-select/03-cards-loaded.png' });

    return firstCard;
  }

  test('复选框选中后进入多选模式', async () => {
    const page = electronTest.getPage();

    // 进入图像网格视图
    const firstCard = await enterImageGridView(page);

    // hover 第一个卡片显示复选框
    await firstCard.hover();
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'test-results/multi-select/04-hover-card.png' });

    // 点击复选框选中
    const firstCheckbox = firstCard.locator('.card-checkbox');
    await expect(firstCheckbox).toBeVisible();
    await firstCheckbox.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/multi-select/05-checkbox-checked.png' });

    // 验证批量工具栏显示
    const batchToolbar = page.locator('#imageBatchToolbar');
    await expect(batchToolbar).toBeVisible();
    await page.screenshot({ path: 'test-results/multi-select/06-batch-toolbar-visible.png' });

    // 验证选择计数显示
    const countText = page.locator('#imageBatchSelectedCount');
    await expect(countText).toContainText('已选择 1 项');

    // 验证容器有 selection-mode 类
    const hasSelectionMode = await page.evaluate(() => {
      const container = document.getElementById('imageGrid');
      return container?.classList.contains('selection-mode');
    });
    expect(hasSelectionMode).toBe(true);
  });

  test('多选模式下复选框一直显示', async () => {
    const page = electronTest.getPage();

    // 进入图像网格视图
    await enterImageGridView(page);

    // 选中第一个卡片
    const firstCard = page.locator('.image-card').first();
    await firstCard.hover();
    await firstCard.locator('.card-checkbox').click();

    // 等待进入多选模式
    await page.waitForSelector('#imageBatchToolbar', { state: 'visible' });
    await page.screenshot({ path: 'test-results/multi-select/07-selection-mode.png' });

    // 不 hover 第二个卡片，直接检查复选框是否可见
    const secondCard = page.locator('.image-card').nth(1);
    const secondCheckbox = secondCard.locator('.card-checkbox');

    // 由于 selection-mode 类，复选框应该一直显示
    await expect(secondCheckbox).toBeVisible();
    await page.screenshot({ path: 'test-results/multi-select/08-checkbox-always-visible.png' });
  });

  test('批量工具栏 - 反选功能', async () => {
    const page = electronTest.getPage();

    // 进入图像网格视图
    await enterImageGridView(page);

    // 获取图像总数
    const totalImages = await page.evaluate(async () => {
      const images = await window.electronAPI.getImages('createdAt', 'desc');
      return images.filter((img: IImage) => !img.isDeleted).length;
    });

    // 至少需要2个图像进行测试
    if (totalImages < 2) {
      test.skip();
      return;
    }

    // 选中第一个卡片
    const firstCard = page.locator('.image-card').first();
    await firstCard.hover();
    await firstCard.locator('.card-checkbox').click();

    // 等待批量工具栏显示
    await page.waitForSelector('#imageBatchToolbar', { state: 'visible' });
    await page.screenshot({ path: 'test-results/multi-select/09-before-invert.png' });

    // 点击反选按钮
    await page.click('#imageBatchInvertBtn');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/multi-select/10-after-invert.png' });

    // 验证选择数量 = 总数 - 1（原来选中的变为未选中）
    const countText = await page.locator('#imageBatchSelectedCount').textContent();
    const expectedCount = totalImages - 1;
    expect(countText).toContain(`已选择 ${expectedCount} 项`);
  });

  test('批量工具栏 - 取消选择功能', async () => {
    const page = electronTest.getPage();

    // 进入图像网格视图
    await enterImageGridView(page);

    // 选中第一个卡片
    const firstCard = page.locator('.image-card').first();
    await firstCard.hover();
    await firstCard.locator('.card-checkbox').click();

    // 等待批量工具栏显示
    await page.waitForSelector('#imageBatchToolbar', { state: 'visible' });
    await page.screenshot({ path: 'test-results/multi-select/11-before-cancel.png' });

    // 点击取消选择按钮
    await page.click('#imageBatchCancelBtn');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/multi-select/12-after-cancel.png' });

    // 验证批量工具栏隐藏
    const batchToolbar = page.locator('#imageBatchToolbar');
    await expect(batchToolbar).not.toBeVisible();

    // 验证 selection-mode 类被移除
    const hasSelectionMode = await page.evaluate(() => {
      const container = document.getElementById('imageGrid');
      return container?.classList.contains('selection-mode');
    });
    expect(hasSelectionMode).toBe(false);
  });

  test('Ctrl+A 全选功能', async () => {
    const page = electronTest.getPage();

    // 进入图像网格视图
    await enterImageGridView(page);

    // 获取图像总数
    const totalImages = await page.evaluate(async () => {
      const images = await window.electronAPI.getImages('createdAt', 'desc');
      return images.filter((img: IImage) => !img.isDeleted).length;
    });

    if (totalImages === 0) {
      test.skip();
      return;
    }

    // 点击图像面板确保焦点在面板内
    await page.click('#imageGrid');
    await page.waitForTimeout(200);

    // 按 Ctrl+A 全选
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/multi-select/13-ctrl-a-select-all.png' });

    // 等待批量工具栏显示并更新计数
    await page.waitForSelector('#imageBatchToolbar', { state: 'visible' });
    await page.waitForTimeout(300);

    // 验证批量工具栏显示
    const batchToolbar = page.locator('#imageBatchToolbar');
    await expect(batchToolbar).toBeVisible();

    // 验证选择数量等于总数（等待文本更新）
    await page.waitForFunction((expectedCount) => {
      const countElement = document.getElementById('imageBatchSelectedCount');
      return countElement?.textContent?.includes(`已选择 ${expectedCount} 项`);
    }, totalImages, { timeout: 2000 });

    const countText = await page.locator('#imageBatchSelectedCount').textContent();
    expect(countText).toContain(`已选择 ${totalImages} 项`);

    // 验证全选复选框被选中
    const isSelectAllChecked = await page.evaluate(() => {
      const checkbox = document.getElementById('imageBatchSelectAllCheckbox') as HTMLInputElement;
      return checkbox?.checked;
    });
    expect(isSelectAllChecked).toBe(true);
  });

  test('批量收藏功能', async () => {
    const page = electronTest.getPage();

    // 进入图像网格视图
    await enterImageGridView(page);

    // 选中第一个卡片
    const firstCard = page.locator('.image-card').first();
    await firstCard.hover();
    await firstCard.locator('.card-checkbox').click();

    // 等待批量工具栏显示
    await page.waitForSelector('#imageBatchToolbar', { state: 'visible' });

    // 获取第一个图像的原始收藏状态
    const firstImageId = await firstCard.getAttribute('data-id');
    const originalFavoriteStatus = await page.evaluate(async (id) => {
      const image = await window.electronAPI.getImageById(id as string);
      return (image as IImage)?.isFavorite || false;
    }, firstImageId);

    // 点击批量收藏按钮
    await page.click('#imageBatchFavoriteBtn');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/multi-select/14-batch-favorite.png' });

    // 验证收藏状态已切换
    const newFavoriteStatus = await page.evaluate(async (id) => {
      const image = await window.electronAPI.getImageById(id as string);
      return (image as IImage)?.isFavorite || false;
    }, firstImageId);

    expect(newFavoriteStatus).toBe(!originalFavoriteStatus);
  });

  test('多选后切换视图保留选择状态', async () => {
    const page = electronTest.getPage();

    // 进入图像网格视图
    await enterImageGridView(page);

    // 选中第一个卡片
    const firstCard = page.locator('.image-card').first();
    await firstCard.hover();
    await firstCard.locator('.card-checkbox').click();

    // 等待批量工具栏显示
    await page.waitForSelector('#imageBatchToolbar', { state: 'visible' });
    await page.screenshot({ path: 'test-results/multi-select/15-grid-view-selected.png' });

    // 切换到列表视图
    await page.click('#imageListViewBtn');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/multi-select/16-list-view-selected.png' });

    // 验证批量工具栏仍然显示
    const batchToolbar = page.locator('#imageBatchToolbar');
    await expect(batchToolbar).toBeVisible();

    // 验证选择计数仍然显示 1
    const countText = page.locator('#imageBatchSelectedCount');
    await expect(countText).toContainText('已选择 1 项');

    // 切换回网格视图
    await page.click('#imageGridViewBtn');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/multi-select/17-back-to-grid-selected.png' });

    // 验证选择状态仍然保留
    await expect(batchToolbar).toBeVisible();
    await expect(countText).toContainText('已选择 1 项');
  });
});

import { test, expect } from '@playwright/test';
import { createElectronTest } from './electron-test.ts';
import type { IElectronAPI, IImage } from '../src/preload/index.ts';

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

/**
 * 图像视图 Shift 范围选择功能 E2E 测试
 *
 * 测试场景：
 * 1. 列表视图 - Shift+ 点击范围选择
 *
 * 前置条件：
 * - 数据库中至少有 5 张图像
 *
 * 进入目标界面步骤：
 * 1. 点击 #imageManagerBtn 切换到图像面板
 * 2. 点击 #imageListViewBtn 切换到列表视图
 * 3. 等待 .list-item--image 元素可见
 */
test.describe('图像视图 Shift 范围选择', () => {
  const electronTest = createElectronTest();

  test.beforeEach(async () => {
    await electronTest.launch();
  });

  test.afterEach(async () => {
    await electronTest.close();
  });

  /**
   * 进入图像列表视图的辅助函数
   */
  async function enterImageListView(page: any) {
    // 1. 切换到图像面板
    await page.click('#imageManagerBtn');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/shift-select/01-image-panel.png' });

    // 2. 切换到列表视图（点击列表视图按钮）
    const listViewBtn = page.locator('#imageListViewBtn');
    await listViewBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/shift-select/02-list-view.png' });

    // 3. 等待列表项加载
    const firstRow = page.locator('.list-item--image').first();
    await expect(firstRow).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/shift-select/03-list-loaded.png' });

    return firstRow;
  }

  test('列表视图 - Shift+ 点击范围选择', async () => {
    const page = electronTest.getPage();

    // 验证有图像数据
    const totalImages = await page.evaluate(async () => {
      const images = await window.electronAPI.getImages('createdAt', 'desc');
      return images.filter((img: IImage) => !img.isDeleted).length;
    });

    if (totalImages < 5) {
      test.skip();
      console.log(`跳过测试：只有 ${totalImages} 张图像，需要至少 5 张`);
      return;
    }

    // 进入图像列表视图
    await enterImageListView(page);

    // 点击第一个复选框选中（建立 lastSelectedIndex）
    const firstCheckbox = page.locator('.list-item--image').first().locator('.list-item__checkbox');
    await firstCheckbox.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/shift-select/04-first-row-selected.png' });

    // 验证第一个复选框被选中
    await expect(firstCheckbox).toBeChecked();
    await page.waitForTimeout(500);

    // 验证选择计数为 1（通过检查复选框状态）
    const checkedCount = await page.evaluate(() => {
      return document.querySelectorAll('.list-item__checkbox:checked').length;
    });
    expect(checkedCount).toBe(1);

    // Shift+ 点击第三个行进行范围选择
    const thirdRow = page.locator('.list-item--image').nth(2);
    await page.keyboard.down('Shift');
    await thirdRow.click();
    await page.keyboard.up('Shift');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/shift-select/05-shift-click-list.png' });

    // 验证选择计数为 3（通过检查复选框状态）
    const finalCheckedCount = await page.evaluate(() => {
      return document.querySelectorAll('.list-item__checkbox:checked').length;
    });
    expect(finalCheckedCount).toBe(3);

    // 验证每行的选中状态
    for (let i = 0; i <= 2; i++) {
      const checkbox = page.locator('.list-item--image').nth(i).locator('.list-item__checkbox');
      await expect(checkbox).toBeChecked();
    }
    await page.screenshot({ path: 'test-results/shift-select/06-three-rows-selected.png' });
  });
});

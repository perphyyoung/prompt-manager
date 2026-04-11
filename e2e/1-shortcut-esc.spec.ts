import { test, expect } from '@playwright/test';
import { createElectronTest, enterImageGridView, enterPromptGridView, openImageDetail, openPromptDetail } from './electron-test.ts';
import type { IElectronAPI } from '../src/preload/index.ts';

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

test.describe('Esc 键快捷键功能', () => {
  const electronTest = createElectronTest();

  test.beforeEach(async () => {
    await electronTest.launch();
  });

  test.afterEach(async () => {
    await electronTest.close();
  });

  // ==================== 通用功能测试（同时测试图像和提示词面板）====================

  test.describe('Esc 关闭统计视图', () => {
    test('图像面板 - Esc 关闭统计视图', async () => {
      const page = electronTest.getPage();

      await enterImageGridView(page);
      await page.click('#statisticsBtn');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/image-statistics-open.png' });

      const statisticsModal = page.locator('#statisticsModal');
      await expect(statisticsModal).toHaveClass(/active/);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/image-statistics-closed.png' });

      await expect(statisticsModal).not.toHaveClass(/active/);
    });

    test('提示词面板 - Esc 关闭统计视图', async () => {
      const page = electronTest.getPage();

      await enterPromptGridView(page);
      await page.click('#statisticsBtn');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/prompt-statistics-open.png' });

      const statisticsModal = page.locator('#statisticsModal');
      await expect(statisticsModal).toHaveClass(/active/);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/prompt-statistics-closed.png' });

      await expect(statisticsModal).not.toHaveClass(/active/);
    });
  });

  test.describe('Esc 关闭设置视图', () => {
    test('图像面板 - Esc 关闭设置视图', async () => {
      const page = electronTest.getPage();

      await enterImageGridView(page);
      await page.click('#settingsBtn');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/image-settings-open.png' });

      const settingsModal = page.locator('#settingsModal');
      await expect(settingsModal).toHaveClass(/active/);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/image-settings-closed.png' });

      await expect(settingsModal).not.toHaveClass(/active/);
    });

    test('提示词面板 - Esc 关闭设置视图', async () => {
      const page = electronTest.getPage();

      await enterPromptGridView(page);
      await page.click('#settingsBtn');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/prompt-settings-open.png' });

      const settingsModal = page.locator('#settingsModal');
      await expect(settingsModal).toHaveClass(/active/);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/prompt-settings-closed.png' });

      await expect(settingsModal).not.toHaveClass(/active/);
    });
  });

  test.describe('Esc 关闭详情视图', () => {
    test('图像面板 - Esc 关闭图像详情视图', async () => {
      const page = electronTest.getPage();

      await enterImageGridView(page);
      await openImageDetail(page);
      await page.screenshot({ path: 'test-results/esc/image-detail-open.png' });

      const detailModal = page.locator('#imageDetailModal');
      await expect(detailModal).toHaveClass(/active/);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/image-detail-closed.png' });

      await expect(detailModal).not.toHaveClass(/active/);
    });

    test('提示词面板 - Esc 关闭提示词详情视图', async () => {
      const page = electronTest.getPage();

      await enterPromptGridView(page);
      await openPromptDetail(page);
      await page.screenshot({ path: 'test-results/esc/prompt-detail-open.png' });

      const detailModal = page.locator('#promptDetailModal');
      await expect(detailModal).toHaveClass(/active/);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/prompt-detail-closed.png' });

      await expect(detailModal).not.toHaveClass(/active/);
    });
  });

  test.describe('Esc 在批量标签模式下先退出批量模式', () => {
    test('图像详情 - Esc 先退出批量模式，不关闭详情视图', async () => {
      const page = electronTest.getPage();

      await enterImageGridView(page);
      await openImageDetail(page);

      const batchTagBtn = page.locator('#imageDetailBatchTagBtn');
      await batchTagBtn.click();
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/image-batch-mode-open.png' });

      const batchToolbar = page.locator('.batch-toolbar.visible');
      await expect(batchToolbar).toBeVisible();

      const detailModal = page.locator('#imageDetailModal');
      await expect(detailModal).toHaveClass(/active/);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/image-batch-mode-closed.png' });

      await expect(batchToolbar).not.toBeVisible();
      await expect(detailModal).toHaveClass(/active/);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/image-detail-closed-after-batch.png' });

      await expect(detailModal).not.toHaveClass(/active/);
    });

    test('提示词详情 - Esc 先退出批量模式，不关闭详情视图', async () => {
      const page = electronTest.getPage();

      await enterPromptGridView(page);
      await openPromptDetail(page);

      const batchTagBtn = page.locator('#promptDetailBatchTagBtn');
      await batchTagBtn.click();
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/prompt-batch-mode-open.png' });

      const batchToolbar = page.locator('.batch-toolbar.visible');
      await expect(batchToolbar).toBeVisible();

      const detailModal = page.locator('#promptDetailModal');
      await expect(detailModal).toHaveClass(/active/);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/prompt-batch-mode-closed.png' });

      await expect(batchToolbar).not.toBeVisible();
      await expect(detailModal).toHaveClass(/active/);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/prompt-detail-closed-after-batch.png' });

      await expect(detailModal).not.toHaveClass(/active/);
    });
  });

  test.describe('Esc 清除主界面批量选择', () => {
    test('图像面板 - Esc 清除批量选择', async () => {
      const page = electronTest.getPage();

      await enterImageGridView(page);

      const firstCard = page.locator('.image-card').first();
      await firstCard.hover();
      await firstCard.locator('.card-checkbox').click();
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/image-main-batch-mode.png' });

      const batchToolbar = page.locator('.batch-toolbar.visible');
      await expect(batchToolbar).toBeVisible();

      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/image-main-batch-cleared.png' });

      await expect(batchToolbar).not.toBeVisible();

      const hasSelectionMode = await page.evaluate(() => {
        const container = document.getElementById('imageGrid');
        return container?.classList.contains('selection-mode');
      });
      expect(hasSelectionMode).toBe(false);
    });

    test('提示词面板 - Esc 清除批量选择', async () => {
      const page = electronTest.getPage();

      await enterPromptGridView(page);

      const firstCard = page.locator('.prompt-card').first();
      await firstCard.hover();
      await firstCard.locator('.card-checkbox').click();
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/prompt-main-batch-mode.png' });

      const batchToolbar = page.locator('.batch-toolbar.visible');
      await expect(batchToolbar).toBeVisible();

      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/prompt-main-batch-cleared.png' });

      await expect(batchToolbar).not.toBeVisible();

      const hasSelectionMode = await page.evaluate(() => {
        const container = document.getElementById('promptGrid');
        return container?.classList.contains('selection-mode');
      });
      expect(hasSelectionMode).toBe(false);
    });
  });

  // ==================== 对话框功能测试（独立于面板）====================

  test('Esc 关闭对话框', async () => {
    const page = electronTest.getPage();

    await enterImageGridView(page);

    const firstCard = page.locator('.image-card').first();
    await firstCard.hover();
    await firstCard.locator('.card-checkbox').click();
    await page.waitForTimeout(100);

    const batchToolbar = page.locator('.batch-toolbar.visible');
    const deleteBtn = batchToolbar.locator('[data-action="Delete"]');
    await deleteBtn.click();
    await page.waitForTimeout(100);
    await page.screenshot({ path: 'test-results/esc/dialog-open.png' });

    const confirmModalVisible = await page.evaluate(() => {
      const modal = document.getElementById('confirmModal');
      return modal && modal.style.display !== 'none';
    });
    expect(confirmModalVisible).toBe(true);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await page.screenshot({ path: 'test-results/esc/dialog-closed.png' });

    const confirmModalHidden = await page.evaluate(() => {
      const modal = document.getElementById('confirmModal');
      return !modal || modal.style.display === 'none';
    });
    expect(confirmModalHidden).toBe(true);

    await expect(batchToolbar).toBeVisible();
  });

  // ==================== 回收站功能测试（独立于面板）====================

  test.describe('Esc 关闭回收站视图', () => {
    test('图像回收站 - Esc 关闭回收站视图', async () => {
      const page = electronTest.getPage();

      await enterImageGridView(page);
      await page.click('#imageTrashBtn');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/image-trash-open.png' });

      const trashModalVisible = await page.evaluate(() => {
        const modal = document.getElementById('imageTrashModal');
        return modal && modal.style.display !== 'none';
      });
      expect(trashModalVisible).toBe(true);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/image-trash-closed.png' });

      const trashModalHidden = await page.evaluate(() => {
        const modal = document.getElementById('imageTrashModal');
        return !modal || modal.style.display === 'none';
      });
      expect(trashModalHidden).toBe(true);
    });

    test('提示词回收站 - Esc 关闭回收站视图', async () => {
      const page = electronTest.getPage();

      await enterPromptGridView(page);
      await page.click('#promptTrashBtn');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/prompt-trash-open.png' });

      const trashModalVisible = await page.evaluate(() => {
        const modal = document.getElementById('promptTrashModal');
        return modal && modal.style.display !== 'none';
      });
      expect(trashModalVisible).toBe(true);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/prompt-trash-closed.png' });

      const trashModalHidden = await page.evaluate(() => {
        const modal = document.getElementById('promptTrashModal');
        return !modal || modal.style.display === 'none';
      });
      expect(trashModalHidden).toBe(true);
    });
  });

  // ==================== 图像特有功能测试 ====================

  test('Esc 关闭全屏查看器', async () => {
    const page = electronTest.getPage();

    await enterImageGridView(page);
    await openImageDetail(page);

    const image = page.locator('#imageDetailImg');
    await image.dblclick();
    await page.waitForTimeout(100);
    await page.screenshot({ path: 'test-results/esc/fullscreen-open.png' });

    const fullscreenViewer = page.locator('#imageFullscreenViewer');
    await expect(fullscreenViewer).toHaveClass(/active/);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await page.screenshot({ path: 'test-results/esc/fullscreen-closed.png' });

    await expect(fullscreenViewer).not.toHaveClass(/active/);

    const detailModal = page.locator('#imageDetailModal');
    await expect(detailModal).toHaveClass(/active/);
  });

  // ==================== 自动完成功能测试（同时测试图像和提示词）====================

  test.describe('Esc 关闭标签自动完成下拉', () => {
    test('图像详情 - Esc 关闭标签自动完成下拉', async () => {
      const page = electronTest.getPage();

      await enterImageGridView(page);
      await openImageDetail(page);

      const tagInput = page.locator('#imageDetailTagInput');
      await tagInput.click();

      const tagPrefix = await page.evaluate(() => {
        const cache = (window as unknown as { tagCache?: Map<string, unknown> }).tagCache;
        if (cache && cache.size > 0) {
          const firstTag = Array.from(cache.keys())[0];
          return firstTag.slice(0, 1);
        }
        return 'a';
      });

      await tagInput.fill(tagPrefix);
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/image-autocomplete-open.png' });

      const autocompleteDropdown = page.locator('#imageDetailTagAutocomplete');
      const isVisible = await autocompleteDropdown.evaluate((el: HTMLElement) => el.classList.contains('active'));
      expect(isVisible).toBe(true);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/image-autocomplete-closed.png' });

      const isHidden = await autocompleteDropdown.evaluate((el: HTMLElement) => !el.classList.contains('active'));
      expect(isHidden).toBe(true);

      const detailModal = page.locator('#imageDetailModal');
      await expect(detailModal).toHaveClass(/active/);
    });

    test('提示词详情 - Esc 关闭标签自动完成下拉', async () => {
      const page = electronTest.getPage();

      await enterPromptGridView(page);
      await openPromptDetail(page);

      const tagInput = page.locator('#promptDetailTagsInput');
      await tagInput.click();

      const tagPrefix = await page.evaluate(() => {
        const cache = (window as unknown as { tagCache?: Map<string, unknown> }).tagCache;
        if (cache && cache.size > 0) {
          const firstTag = Array.from(cache.keys())[0];
          return firstTag.slice(0, 1);
        }
        return 'a';
      });

      await tagInput.fill(tagPrefix);
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/prompt-autocomplete-open.png' });

      const autocompleteDropdown = page.locator('#promptDetailTagAutocomplete');
      const isVisible = await autocompleteDropdown.evaluate((el: HTMLElement) => el.classList.contains('active'));
      expect(isVisible).toBe(true);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'test-results/esc/prompt-autocomplete-closed.png' });

      const isHidden = await autocompleteDropdown.evaluate((el: HTMLElement) => !el.classList.contains('active'));
      expect(isHidden).toBe(true);

      const detailModal = page.locator('#promptDetailModal');
      await expect(detailModal).toHaveClass(/active/);
    });
  });
});

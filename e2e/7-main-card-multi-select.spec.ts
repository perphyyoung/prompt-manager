import { test, expect } from '@playwright/test';
import { createElectronTest, enterImageGridView, enterPromptGridView } from './electron-test.ts';
import type { IElectronAPI, IImage, IPrompt } from '../src/preload/index.ts';
import { Constants } from '../src/constants.ts';

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

/**
 * 主界面卡片视图多选功能 E2E 测试
 *
 * 测试场景：
 * 1. 复选框选中/取消选中（图像和提示词）
 * 2. 进入多选模式后复选框一直显示（图像和提示词）
 * 3. 批量工具栏按钮功能（反选、添加标签、收藏、删除、取消选择）（图像和提示词）
 * 4. Ctrl+A 全选（图像和提示词）
 * 5. 批量收藏功能（图像和提示词）
 * 6. 多选后切换视图保留选择状态（图像和提示词）
 */
test.describe('主界面卡片视图多选功能', () => {
  const electronTest = createElectronTest();

  test.beforeAll(async () => {
    await electronTest.launch();
  });

  test.afterEach(async () => {
    await electronTest.cleanupAndReset();
  });

  test.afterAll(async () => {
    await electronTest.close();
  });

  test.describe('图像面板多选功能', () => {
    test('图像复选框选中后进入多选模式', async () => {
      await electronTest.logTestStart('图像复选框选中后进入多选模式 - 验证点击复选框后显示批量工具栏并进入多选模式');
      const page = electronTest.getPage();
      const firstCard = await enterImageGridView(page);

      await firstCard.hover();
      await page.screenshot({ path: 'test-results/multi-select/image-hover-card.png' });

      const firstCheckbox = firstCard.locator('.card-checkbox');
      await expect(firstCheckbox).toBeVisible();
      await firstCheckbox.click();
      await page.screenshot({ path: 'test-results/multi-select/image-checkbox-checked.png' });

      const batchToolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
      await expect(batchToolbar).toBeVisible();
      await page.screenshot({ path: 'test-results/multi-select/image-batch-toolbar-visible.png' });

      const countText = batchToolbar.locator('.batch-toolbar-count');
      await expect(countText).toContainText('1');

      const hasSelectionMode = await page.evaluate((containerId) => {
        const container = document.getElementById(containerId);
        return container?.classList.contains('selection-mode');
      }, Constants.Ids.IMAGE_GRID);
      expect(hasSelectionMode).toBe(true);
    });

    test('图像多选模式下复选框一直显示', async () => {
      await electronTest.logTestStart('图像多选模式下复选框一直显示 - 验证进入多选模式后复选框始终可见');
      const page = electronTest.getPage();
      await enterImageGridView(page);

      const firstCard = page.locator('.image-card').first();
      await firstCard.hover();
      await firstCard.locator('.card-checkbox').click();

      await page.waitForSelector(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`, { state: 'visible' });
      await page.screenshot({ path: 'test-results/multi-select/image-selection-mode.png' });

      const secondCard = page.locator('.image-card').nth(1);
      const secondCheckbox = secondCard.locator('.card-checkbox');
      await expect(secondCheckbox).toBeVisible();
      await page.screenshot({ path: 'test-results/multi-select/image-checkbox-always-visible.png' });
    });

    test('图像批量工具栏 - 反选功能', async () => {
      await electronTest.logTestStart('图像批量工具栏 - 反选功能 - 验证反选按钮正确切换选择状态');
      const page = electronTest.getPage();
      await enterImageGridView(page);

      const searchInput = page.locator(`#${Constants.Ids.IMAGE_SEARCH_INPUT}`);
      await searchInput.fill('');

      const filterActionBtn = page.locator(`#${Constants.Ids.IMAGE_TAG_FILTER_ACTION_BTN}`);
      const btnText = await filterActionBtn.textContent();
      if (btnText === '清除筛选') {
        await filterActionBtn.click();
        await page.waitForFunction((btnId) => {
          const btn = document.getElementById(btnId);
          return btn?.textContent === '标签筛选';
        }, Constants.Ids.IMAGE_TAG_FILTER_ACTION_BTN, { timeout: 3000 });
      }

      const visibleCards = await page.locator('.image-card').count();

      if (visibleCards < 2) {
        test.skip();
        return;
      }

      const firstCard = page.locator('.image-card').first();
      await firstCard.hover();
      await firstCard.locator('.card-checkbox').click();

      await page.waitForSelector(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`, { state: 'visible' });
      await page.screenshot({ path: 'test-results/multi-select/image-before-invert.png' });

      const batchToolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
      await batchToolbar.locator('[data-action="Invert"]').click();
      await page.screenshot({ path: 'test-results/multi-select/image-after-invert.png' });

      const expectedCount = visibleCards - 1;

      if (expectedCount === 0) {
        await expect(batchToolbar).not.toBeVisible();
      } else {
        await page.waitForFunction(({ count, toolbarId }: { count: number; toolbarId: string }) => {
          const toolbar = document.getElementById(toolbarId);
          const countElement = toolbar?.querySelector('.batch-toolbar-count');
          return countElement?.textContent?.includes(`${count}`);
        }, { count: expectedCount, toolbarId: Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR }, { timeout: 2000 });

        const countText = await batchToolbar.locator('.batch-toolbar-count').textContent();
        expect(countText).toContain(`${expectedCount}`);
      }
    });

    test('图像批量工具栏 - 取消选择功能', async () => {
      await electronTest.logTestStart('图像批量工具栏 - 取消选择功能 - 验证取消按钮清除选择并退出多选模式');
      const page = electronTest.getPage();
      await enterImageGridView(page);

      const firstCard = page.locator('.image-card').first();
      await firstCard.hover();
      await firstCard.locator('.card-checkbox').click();

      await page.waitForSelector(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`, { state: 'visible' });
      await page.screenshot({ path: 'test-results/multi-select/image-before-cancel.png' });

      const batchToolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
      await batchToolbar.locator('[data-action="Cancel"]').click();
      await page.screenshot({ path: 'test-results/multi-select/image-after-cancel.png' });

      await expect(batchToolbar).not.toBeVisible();

      const hasSelectionMode = await page.evaluate((containerId) => {
        const container = document.getElementById(containerId);
        return container?.classList.contains('selection-mode');
      }, Constants.Ids.IMAGE_GRID);
      expect(hasSelectionMode).toBe(false);
    });

    test('图像 Ctrl+A 全选功能', async () => {
      await electronTest.logTestStart('图像 Ctrl+A 全选功能 - 验证 Ctrl+A 快捷键全选所有可见图像');
      const page = electronTest.getPage();
      await enterImageGridView(page);

      const totalImages = await page.evaluate(async () => {
        const images = await window.electronAPI.getImages('createdAt', 'desc');
        return images.filter((img: IImage) => !img.isDeleted).length;
      });

      if (totalImages === 0) {
        test.skip();
        return;
      }

      await page.focus('#imageGrid');
      await page.keyboard.press('Control+a');
      await page.screenshot({ path: 'test-results/multi-select/image-ctrl-a-select-all.png' });

      await page.waitForSelector(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`, { state: 'visible' });

      const batchToolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
      await expect(batchToolbar).toBeVisible();

      await page.waitForFunction(({ count, toolbarId }: { count: number; toolbarId: string }) => {
        const toolbar = document.getElementById(toolbarId);
        const countElement = toolbar?.querySelector('.batch-toolbar-count');
        return countElement?.textContent?.includes(`${count}`);
      }, { count: totalImages, toolbarId: Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR }, { timeout: 2000 });

      const countText = await batchToolbar.locator('.batch-toolbar-count').textContent();
      expect(countText).toContain(`${totalImages}`);
    });

    test('图像批量收藏功能', async () => {
      await electronTest.logTestStart('图像批量收藏功能 - 验证批量收藏按钮切换图像收藏状态');
      const page = electronTest.getPage();

      // 先清除可能遗留的选择状态
      await page.keyboard.press('Escape');
      // 等待批量工具栏消失（如果存在）
      const batchToolbarBefore = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
      await batchToolbarBefore.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

      await enterImageGridView(page);

      // 获取第一个图像的ID和当前收藏状态
      const firstCard = page.locator('.image-card').first();
      const firstImageId = await firstCard.getAttribute('data-id');

      // 记录当前收藏状态（受上一个测试影响）
      const originalFavoriteStatus = await page.evaluate(async (id: string) => {
        const image = await window.electronAPI.getImageById(id);
        return (image as IImage)?.isFavorite || false;
      }, firstImageId as string);

      await firstCard.hover();
      await firstCard.locator('.card-checkbox').click();

      await page.waitForSelector(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`, { state: 'visible' });

      const batchToolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
      await batchToolbar.locator('[data-action="Favorite"]').click();

      // 等待批量工具栏消失（操作完成后会清除选择）
      await expect(batchToolbar).not.toBeVisible();

      // 等待收藏操作完成 - 使用 waitForFunction 检查状态变化
      await page.waitForFunction(async (args: { id: string; originalStatus: number | boolean }) => {
        const image = await window.electronAPI.getImageById(args.id);
        const currentStatus = image?.isFavorite || false;
        return currentStatus !== (args.originalStatus as boolean);
      }, { id: firstImageId as string, originalStatus: originalFavoriteStatus }, { timeout: 5000 });

      await page.screenshot({ path: 'test-results/multi-select/image-batch-favorite.png' });

      // 验证状态已切换
      const newFavoriteStatus = await page.evaluate(async (id: string) => {
        const image = await window.electronAPI.getImageById(id);
        return (image as IImage)?.isFavorite || false;
      }, firstImageId as string);

      expect(newFavoriteStatus).toBe(!originalFavoriteStatus);
    });

    test('图像多选后切换视图保留选择状态', async () => {
      await electronTest.logTestStart('图像多选后切换视图保留选择状态 - 验证网格视图和列表视图之间切换时保留选择状态');
      const page = electronTest.getPage();
      await enterImageGridView(page);

      const firstCard = page.locator('.image-card').first();
      await firstCard.hover();
      await firstCard.locator('.card-checkbox').click();

      await page.waitForSelector(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`, { state: 'visible' });
      await page.screenshot({ path: 'test-results/multi-select/image-grid-view-selected.png' });

      await page.click('#imageListViewBtn');
      await page.waitForSelector('.list-item--image', { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/multi-select/image-list-view-selected.png' });

      const batchToolbar = page.locator(`#${Constants.Ids.IMAGE_MAIN_BATCH_TOOLBAR}`);
      await expect(batchToolbar).toBeVisible();

      const countText = batchToolbar.locator('.batch-toolbar-count');
      await expect(countText).toContainText('1');

      await page.click('#imageGridViewBtn');
      await page.waitForSelector('.image-card', { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/multi-select/image-back-to-grid-selected.png' });

      await expect(batchToolbar).toBeVisible();
      await expect(countText).toContainText('1');
    });
  });

  test.describe('提示词面板多选功能', () => {
    test('提示词复选框选中后进入多选模式', async () => {
      await electronTest.logTestStart('提示词复选框选中后进入多选模式 - 验证点击复选框后显示批量工具栏并进入多选模式');
      const page = electronTest.getPage();
      const firstCard = await enterPromptGridView(page);

      await firstCard.hover();
      await page.screenshot({ path: 'test-results/multi-select/prompt-hover-card.png' });

      const firstCheckbox = firstCard.locator('.card-checkbox');
      await expect(firstCheckbox).toBeVisible();
      await firstCheckbox.click();
      await page.screenshot({ path: 'test-results/multi-select/prompt-checkbox-checked.png' });

      const batchToolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
      await expect(batchToolbar).toBeVisible();
      await page.screenshot({ path: 'test-results/multi-select/prompt-batch-toolbar-visible.png' });

      const countText = batchToolbar.locator('.batch-toolbar-count');
      await expect(countText).toContainText('1');

      const hasSelectionMode = await page.evaluate((containerId) => {
        const container = document.getElementById(containerId);
        return container?.classList.contains('selection-mode');
      }, Constants.Ids.PROMPT_GRID);
      expect(hasSelectionMode).toBe(true);
    });

    test('提示词多选模式下复选框一直显示', async () => {
      await electronTest.logTestStart('提示词多选模式下复选框一直显示 - 验证进入多选模式后复选框始终可见');
      const page = electronTest.getPage();
      await enterPromptGridView(page);

      const firstCard = page.locator('.prompt-card').first();
      await firstCard.hover();
      await firstCard.locator('.card-checkbox').click();

      await page.waitForSelector(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`, { state: 'visible' });
      await page.screenshot({ path: 'test-results/multi-select/prompt-selection-mode.png' });

      const secondCard = page.locator('.prompt-card').nth(1);
      const secondCheckbox = secondCard.locator('.card-checkbox');
      await expect(secondCheckbox).toBeVisible();
      await page.screenshot({ path: 'test-results/multi-select/prompt-checkbox-always-visible.png' });
    });

    test('提示词批量工具栏 - 反选功能', async () => {
      await electronTest.logTestStart('提示词批量工具栏 - 反选功能 - 验证反选按钮正确切换选择状态');
      const page = electronTest.getPage();
      await enterPromptGridView(page);

      const searchInput = page.locator(`#${Constants.Ids.PROMPT_SEARCH_INPUT}`);
      await searchInput.fill('');

      const filterActionBtn = page.locator(`#${Constants.Ids.PROMPT_TAG_FILTER_ACTION_BTN}`);
      const btnText = await filterActionBtn.textContent();
      if (btnText === '清除筛选') {
        await filterActionBtn.click();
        await page.waitForFunction((btnId) => {
          const btn = document.getElementById(btnId);
          return btn?.textContent === '标签筛选';
        }, Constants.Ids.PROMPT_TAG_FILTER_ACTION_BTN, { timeout: 3000 });
      }

      const visibleCards = await page.locator('.prompt-card').count();

      if (visibleCards < 2) {
        test.skip();
        return;
      }

      const firstCard = page.locator('.prompt-card').first();
      await firstCard.hover();
      await firstCard.locator('.card-checkbox').click();

      await page.waitForSelector(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`, { state: 'visible' });
      await page.screenshot({ path: 'test-results/multi-select/prompt-before-invert.png' });

      const batchToolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
      await batchToolbar.locator('[data-action="Invert"]').click();
      await page.screenshot({ path: 'test-results/multi-select/prompt-after-invert.png' });

      const expectedCount = visibleCards - 1;

      if (expectedCount === 0) {
        await expect(batchToolbar).not.toBeVisible();
      } else {
        await page.waitForFunction(({ count, toolbarId }: { count: number; toolbarId: string }) => {
          const toolbar = document.getElementById(toolbarId);
          const countElement = toolbar?.querySelector('.batch-toolbar-count');
          return countElement?.textContent?.includes(`${count}`);
        }, { count: expectedCount, toolbarId: Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR }, { timeout: 2000 });

        const countText = await batchToolbar.locator('.batch-toolbar-count').textContent();
        expect(countText).toContain(`${expectedCount}`);
      }
    });

    test('提示词批量工具栏 - 取消选择功能', async () => {
      await electronTest.logTestStart('提示词批量工具栏 - 取消选择功能 - 验证取消按钮清除选择并退出多选模式');
      const page = electronTest.getPage();
      await enterPromptGridView(page);

      const firstCard = page.locator('.prompt-card').first();
      await firstCard.hover();
      await firstCard.locator('.card-checkbox').click();

      await page.waitForSelector(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`, { state: 'visible' });
      await page.screenshot({ path: 'test-results/multi-select/prompt-before-cancel.png' });

      const batchToolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
      await batchToolbar.locator('[data-action="Cancel"]').click();
      await page.screenshot({ path: 'test-results/multi-select/prompt-after-cancel.png' });

      await expect(batchToolbar).not.toBeVisible();

      const hasSelectionMode = await page.evaluate((containerId) => {
        const container = document.getElementById(containerId);
        return container?.classList.contains('selection-mode');
      }, Constants.Ids.PROMPT_GRID);
      expect(hasSelectionMode).toBe(false);
    });

    test('提示词 Ctrl+A 全选功能', async () => {
      await electronTest.logTestStart('提示词 Ctrl+A 全选功能 - 验证 Ctrl+A 快捷键全选所有可见提示词');
      const page = electronTest.getPage();
      await enterPromptGridView(page);

      const totalPrompts = await page.evaluate(async () => {
        const prompts = await window.electronAPI.getPrompts('createdAt', 'desc');
        return prompts.filter((p: IPrompt) => !p.isDeleted).length;
      });

      if (totalPrompts === 0) {
        test.skip();
        return;
      }

      await page.focus('#promptGrid');
      await page.keyboard.press('Control+a');
      await page.screenshot({ path: 'test-results/multi-select/prompt-ctrl-a-select-all.png' });

      await page.waitForSelector(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`, { state: 'visible' });

      const batchToolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
      await expect(batchToolbar).toBeVisible();

      await page.waitForFunction(({ count, toolbarId }: { count: number; toolbarId: string }) => {
        const toolbar = document.getElementById(toolbarId);
        const countElement = toolbar?.querySelector('.batch-toolbar-count');
        return countElement?.textContent?.includes(`${count}`);
      }, { count: totalPrompts, toolbarId: Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR }, { timeout: 2000 });

      const countText = await batchToolbar.locator('.batch-toolbar-count').textContent();
      expect(countText).toContain(`${totalPrompts}`);
    });

    test('提示词批量收藏功能', async () => {
      await electronTest.logTestStart('提示词批量收藏功能 - 验证批量收藏按钮切换提示词收藏状态');
      const page = electronTest.getPage();

      // 先切换到提示词面板，再清除可能遗留的选择状态
      await page.click('#promptManagerBtn');
      await page.waitForSelector('#promptPanel', { state: 'visible', timeout: 5000 });
      await page.keyboard.press('Escape');
      // 等待批量工具栏消失（如果存在）
      const batchToolbarBefore = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
      await batchToolbarBefore.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

      await enterPromptGridView(page);

      const firstCard = page.locator('.prompt-card').first();
      await firstCard.hover();
      await firstCard.locator('.card-checkbox').click();

      await page.waitForSelector(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`, { state: 'visible' });

      const firstPromptId = await firstCard.getAttribute('data-id');

      // 记录当前收藏状态（受上一个测试影响）
      const originalFavoriteStatus = await page.evaluate(async (id: string) => {
        const prompts = await window.electronAPI.getPrompts('updatedAt', 'desc');
        const prompt = prompts.find((p: IPrompt) => String(p.id) === id);
        return prompt?.isFavorite || false;
      }, firstPromptId as string);

      const batchToolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
      await batchToolbar.locator('[data-action="Favorite"]').click();

      // 等待批量工具栏消失（操作完成后会清除选择）
      await expect(batchToolbar).not.toBeVisible();

      // 等待收藏操作完成 - 使用 waitForFunction 检查状态变化
      await page.waitForFunction(async (args: { id: string; originalStatus: number | boolean }) => {
        const prompts = await window.electronAPI.getPrompts('updatedAt', 'desc');
        const prompt = prompts.find((p: IPrompt) => String(p.id) === args.id);
        const currentStatus = prompt?.isFavorite || false;
        return currentStatus !== (args.originalStatus as boolean);
      }, { id: firstPromptId as string, originalStatus: originalFavoriteStatus }, { timeout: 5000 });

      await page.screenshot({ path: 'test-results/multi-select/prompt-batch-favorite.png' });

      // 验证状态已切换
      const newFavoriteStatus = await page.evaluate(async (id: string) => {
        const prompts = await window.electronAPI.getPrompts('updatedAt', 'desc');
        const prompt = prompts.find((p: IPrompt) => String(p.id) === id);
        return prompt?.isFavorite || false;
      }, firstPromptId as string);

      expect(newFavoriteStatus).toBe(!originalFavoriteStatus);
    });

    test('提示词多选后切换视图保留选择状态', async () => {
      await electronTest.logTestStart('提示词多选后切换视图保留选择状态 - 验证网格视图和列表视图之间切换时保留选择状态');
      const page = electronTest.getPage();
      await enterPromptGridView(page);

      const firstCard = page.locator('.prompt-card').first();
      await firstCard.hover();
      await firstCard.locator('.card-checkbox').click();

      await page.waitForSelector(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`, { state: 'visible' });
      await page.screenshot({ path: 'test-results/multi-select/prompt-grid-view-selected.png' });

      await page.click('#promptListViewBtn');
      await page.waitForSelector('.list-item--prompt', { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/multi-select/prompt-list-view-selected.png' });

      const batchToolbar = page.locator(`#${Constants.Ids.PROMPT_MAIN_BATCH_TOOLBAR}`);
      await expect(batchToolbar).toBeVisible();

      const countText = batchToolbar.locator('.batch-toolbar-count');
      await expect(countText).toContainText('1');

      await page.click('#promptGridViewBtn');
      await page.waitForSelector('.prompt-card', { state: 'visible', timeout: 5000 });
      await page.screenshot({ path: 'test-results/multi-select/prompt-back-to-grid-selected.png' });

      await expect(batchToolbar).toBeVisible();
      await expect(countText).toContainText('1');
    });
  });
});

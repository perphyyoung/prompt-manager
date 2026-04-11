import { test, expect } from '@playwright/test';
import { createElectronTest, enterPromptDetailView, getPromptFromDatabase } from './electron-test.ts';
import type { IElectronAPI, IPrompt } from '../src/preload/index.ts';

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

/**
 * 提示词详情界面数据库字段读取 E2E 测试
 *
 * 测试目标：验证提示词详情界面正确读取并显示所有数据库字段
 *
 * 测试的数据库字段：
 * - 提示词基本信息：id, title, content, contentTranslate, note, isSafe, isFavorite, tags
 * - 关联图像信息：images (通过 prompt_image_relations 关联)
 * - 时间戳：createdAt, updatedAt
 *
 * 进入目标界面步骤：
 * 1. 点击 #promptManagerBtn 切换到提示词面板
 * 2. 等待 .prompt-card 元素可见
 * 3. 点击第一个提示词卡片打开详情模态框
 * 4. 等待 #promptDetailModal 显示
 */
test.describe('提示词详情界面数据库字段读取', () => {
  const electronTest = createElectronTest();

  test.beforeEach(async () => {
    await electronTest.launch();
  });

  test.afterEach(async () => {
    await electronTest.close();
  });

  test('ID 字段正确显示', async () => {
    const page = electronTest.getPage();
    const { firstPromptId } = await enterPromptDetailView(page);

    // 从数据库获取提示词信息
    const dbPrompt = await getPromptFromDatabase(page, firstPromptId);
    expect(dbPrompt).toBeTruthy();

    // 验证 ID 隐藏输入框值正确
    const idInput = page.locator('#promptDetailId');
    await expect(idInput).toBeAttached();
    const displayedId = await idInput.inputValue();
    expect(displayedId).toBe(dbPrompt!.id);

    await page.screenshot({ path: 'test-results/prompt-detail/04-id-field.png' });
  });

  test('标题 (title) 字段正确显示', async () => {
    const page = electronTest.getPage();
    const { firstPromptId } = await enterPromptDetailView(page);

    // 从数据库获取提示词信息
    const dbPrompt = await getPromptFromDatabase(page, firstPromptId);
    expect(dbPrompt).toBeTruthy();

    // 验证标题输入框显示正确
    const titleInput = page.locator('#promptDetailTitle');
    await expect(titleInput).toBeVisible();
    const displayedTitle = await titleInput.inputValue();
    expect(displayedTitle).toBe(dbPrompt!.title);

    await page.screenshot({ path: 'test-results/prompt-detail/05-title-field.png' });
  });

  test('内容 (content) 字段正确显示', async () => {
    const page = electronTest.getPage();
    const { firstPromptId } = await enterPromptDetailView(page);

    // 从数据库获取提示词信息
    const dbPrompt = await getPromptFromDatabase(page, firstPromptId);
    expect(dbPrompt).toBeTruthy();

    // 验证内容文本域显示正确
    const contentInput = page.locator('#promptDetailContent');
    await expect(contentInput).toBeVisible();
    const displayedContent = await contentInput.inputValue();
    expect(displayedContent).toBe(dbPrompt!.content);

    await page.screenshot({ path: 'test-results/prompt-detail/06-content-field.png' });
  });

  test('翻译 (contentTranslate) 字段正确显示', async () => {
    const page = electronTest.getPage();
    const { firstPromptId } = await enterPromptDetailView(page);

    // 从数据库获取提示词信息
    const dbPrompt = await getPromptFromDatabase(page, firstPromptId);
    expect(dbPrompt).toBeTruthy();

    // 验证翻译文本域显示正确
    const translateInput = page.locator('#promptDetailTranslate');
    await expect(translateInput).toBeVisible();
    const displayedTranslate = await translateInput.inputValue();
    expect(displayedTranslate).toBe(dbPrompt!.contentTranslate || '');

    await page.screenshot({ path: 'test-results/prompt-detail/07-translate-field.png' });
  });

  test('备注 (note) 字段正确显示', async () => {
    const page = electronTest.getPage();
    const { firstPromptId } = await enterPromptDetailView(page);

    // 从数据库获取提示词信息
    const dbPrompt = await getPromptFromDatabase(page, firstPromptId);
    expect(dbPrompt).toBeTruthy();

    // 验证备注文本域显示正确
    const noteInput = page.locator('#promptDetailNote');
    await expect(noteInput).toBeVisible();
    const displayedNote = await noteInput.inputValue();
    expect(displayedNote).toBe(dbPrompt!.note || '');

    await page.screenshot({ path: 'test-results/prompt-detail/08-note-field.png' });
  });

  test('标签 (tags) 字段正确显示', async () => {
    const page = electronTest.getPage();
    const { firstPromptId } = await enterPromptDetailView(page);

    // 从数据库获取提示词信息
    const dbPrompt = await getPromptFromDatabase(page, firstPromptId);
    expect(dbPrompt).toBeTruthy();

    // 验证标签容器存在
    const tagsContainer = page.locator('#promptDetailTags');
    await expect(tagsContainer).toBeVisible();

    // 获取显示的标签（去除删除按钮文本）
    const displayedTags = await page.evaluate(() => {
      const container = document.getElementById('promptDetailTags');
      if (!container) return [];
      return Array.from(container.querySelectorAll('.tag-editable'))
        .map(el => {
          const text = el.textContent || '';
          return text.replace(/[\s×]+$/, '').trim();
        });
    });

    // 验证标签数量匹配
    const dbTags = dbPrompt!.tags || [];
    expect(displayedTags.length).toBe(dbTags.length);

    // 如果有标签，验证标签内容
    if (dbTags.length > 0) {
      for (let i = 0; i < dbTags.length; i++) {
        expect(displayedTags[i]).toBe(dbTags[i]);
      }
    }

    await page.screenshot({ path: 'test-results/prompt-detail/09-tags-field.png' });
  });

  test('关联图像 (images) 字段正确显示', async () => {
    const page = electronTest.getPage();
    const { firstPromptId } = await enterPromptDetailView(page);

    // 从数据库获取提示词信息
    const dbPrompt = await getPromptFromDatabase(page, firstPromptId);
    expect(dbPrompt).toBeTruthy();

    // 验证图像上传区域存在
    const imageUploadArea = page.locator('#imageUploadArea');
    await expect(imageUploadArea).toBeVisible();

    // 获取显示的图像数量
    const imageElements = page.locator('.image-preview-item');
    const displayedImageCount = await imageElements.count();

    // 验证图像数量匹配
    const dbImageCount = dbPrompt!.images?.length || 0;
    expect(displayedImageCount).toBe(dbImageCount);

    await page.screenshot({ path: 'test-results/prompt-detail/10-images-field.png' });
  });

  test('所有数据库字段一致性验证', async () => {
    const page = electronTest.getPage();
    const { firstPromptId } = await enterPromptDetailView(page);

    // 从数据库获取完整提示词信息
    const dbPrompt = await getPromptFromDatabase(page, firstPromptId);
    expect(dbPrompt).toBeTruthy();

    // 收集所有界面显示的值
    const uiValues = await page.evaluate(() => {
      const getValue = (id: string): string => {
        const el = document.getElementById(id);
        if (!el) return '';
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          return el.value;
        }
        return el.textContent || '';
      };

      const getTags = (): string[] => {
        const container = document.getElementById('promptDetailTags');
        if (!container) return [];
        return Array.from(container.querySelectorAll('.tag-editable'))
          .map(el => {
            const text = el.textContent || '';
            return text.replace(/[\s×]+$/, '').trim();
          });
      };

      const getImageCount = (): number => {
        return document.querySelectorAll('.image-preview-item').length;
      };

      return {
        id: (document.getElementById('promptDetailId') as HTMLInputElement)?.value || '',
        title: getValue('promptDetailTitle'),
        content: getValue('promptDetailContent'),
        contentTranslate: getValue('promptDetailTranslate'),
        note: getValue('promptDetailNote'),
        tags: getTags(),
        imageCount: getImageCount()
      };
    });

    // 验证所有字段一致性
    expect(uiValues.id).toBe(dbPrompt!.id);
    expect(uiValues.title).toBe(dbPrompt!.title);
    expect(uiValues.content).toBe(dbPrompt!.content);
    expect(uiValues.contentTranslate).toBe(dbPrompt!.contentTranslate || '');
    expect(uiValues.note).toBe(dbPrompt!.note || '');

    // 验证标签
    const dbTags = dbPrompt!.tags || [];
    expect(uiValues.tags).toEqual(dbTags);

    // 验证图像数量
    const dbImageCount = dbPrompt!.images?.length || 0;
    expect(uiValues.imageCount).toBe(dbImageCount);

    await page.screenshot({ path: 'test-results/prompt-detail/11-all-fields-consistency.png' });
  });
});

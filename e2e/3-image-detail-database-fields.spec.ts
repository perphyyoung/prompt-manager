import { test, expect } from '@playwright/test';
import { Constants } from '../src/constants.ts';
import { createElectronTest, enterImageDetailView, getImageFromDatabase } from './electron-test.ts';
import type { IElectronAPI, IImage } from '../src/preload/index.ts';

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

/**
 * 图像详情界面数据库字段读取 E2E 测试
 *
 * 测试目标：验证图像详情界面正确读取并显示所有数据库字段
 *
 * 测试的数据库字段：
 * - 图像基本信息：id, fileName, fileSize, width, height, createdAt, updatedAt, note, tags
 * - 关联提示词信息：promptRefs (包含 title, content, contentTranslate, note, tags)
 *
 * 注意：isSafe 和 isFavorite 是特殊标签，不是直接的数据库字段显示，不在本测试范围内
 *
 * 进入目标界面步骤：
 * 1. 点击 #imageManagerBtn 切换到图像面板
 * 2. 等待 .image-card 元素可见
 * 3. 点击第一个图像卡片打开详情模态框
 * 4. 等待 #imageDetailModal 显示
 */
test.describe('图像详情界面数据库字段读取', () => {
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

  test('文件名 (fileName) 字段正确显示', async () => {
    const page = electronTest.getPage();
    const { firstImageId } = await enterImageDetailView(page);

    // 从数据库获取图像信息
    const dbImage = await getImageFromDatabase(page, firstImageId);
    expect(dbImage).toBeTruthy();

    // 验证文件名输入框显示正确
    const fileNameInput = page.locator('#imageDetailFileName');
    await expect(fileNameInput).toBeVisible();
    const displayedFileName = await fileNameInput.inputValue();
    expect(displayedFileName).toBe(dbImage!.fileName);

    await page.screenshot({ path: 'test-results/image-detail/04-filename-field.png' });
  });

  test('文件大小 (fileSize) 字段正确显示', async () => {
    const page = electronTest.getPage();
    const { firstImageId } = await enterImageDetailView(page);

    // 从数据库获取图像信息
    const dbImage = await getImageFromDatabase(page, firstImageId);
    expect(dbImage).toBeTruthy();

    // 验证文件大小显示正确
    const fileSizeEl = page.locator('#imageDetailFileSize');
    await expect(fileSizeEl).toBeVisible();
    const displayedFileSize = await fileSizeEl.textContent();

    // 如果数据库有文件大小，应该显示格式化后的值
    if (dbImage!.fileSize && dbImage!.fileSize > 0) {
      expect(displayedFileSize).not.toBe('-');
      expect(displayedFileSize).toContain('B'); // 应该包含 B/KB/MB 等单位
    } else {
      expect(displayedFileSize).toBe('-');
    }

    await page.screenshot({ path: 'test-results/image-detail/05-filesize-field.png' });
  });

  test('图像尺寸 (width/height) 字段正确显示', async () => {
    const page = electronTest.getPage();
    const { firstImageId } = await enterImageDetailView(page);

    // 从数据库获取图像信息
    const dbImage = await getImageFromDatabase(page, firstImageId);
    expect(dbImage).toBeTruthy();

    // 验证图像尺寸显示正确
    const dimensionsEl = page.locator('#imageDetailDimensions');
    await expect(dimensionsEl).toBeVisible();
    const displayedDimensions = await dimensionsEl.textContent();

    // 如果数据库有尺寸信息，应该显示 width × height
    if (dbImage!.width && dbImage!.height) {
      expect(displayedDimensions).toContain('×');
      expect(displayedDimensions).toContain(String(dbImage!.width));
      expect(displayedDimensions).toContain(String(dbImage!.height));
    } else {
      expect(displayedDimensions).toBe('-');
    }

    await page.screenshot({ path: 'test-results/image-detail/06-dimensions-field.png' });
  });

  test('上传时间 (createdAt) 字段正确显示', async () => {
    const page = electronTest.getPage();
    const { firstImageId } = await enterImageDetailView(page);

    // 从数据库获取图像信息
    const dbImage = await getImageFromDatabase(page, firstImageId);
    expect(dbImage).toBeTruthy();

    // 验证上传时间显示正确
    const createdAtEl = page.locator('#imageDetailCreatedAt');
    await expect(createdAtEl).toBeVisible();
    const displayedCreatedAt = await createdAtEl.textContent();

    // 如果数据库有时间信息，应该显示日期时间
    if (dbImage!.createdAt) {
      expect(displayedCreatedAt).not.toBe('-');
      expect(displayedCreatedAt).toBe(dbImage!.createdAt);
    } else {
      expect(displayedCreatedAt).toBe('-');
    }

    await page.screenshot({ path: 'test-results/image-detail/07-createdat-field.png' });
  });

  test('更新时间 (updatedAt) 字段正确显示', async () => {
    const page = electronTest.getPage();
    const { firstImageId } = await enterImageDetailView(page);

    // 从数据库获取图像信息
    const dbImage = await getImageFromDatabase(page, firstImageId);
    expect(dbImage).toBeTruthy();

    // 验证更新时间显示正确
    const updatedAtEl = page.locator('#imageDetailUpdatedAt');
    await expect(updatedAtEl).toBeVisible();
    const displayedUpdatedAt = await updatedAtEl.textContent();

    // 如果数据库有时间信息，应该显示日期时间
    if (dbImage!.updatedAt) {
      expect(displayedUpdatedAt).not.toBe('-');
      expect(displayedUpdatedAt).toBe(dbImage!.updatedAt);
    } else {
      expect(displayedUpdatedAt).toBe('-');
    }

    await page.screenshot({ path: 'test-results/image-detail/08-updatedat-field.png' });
  });

  test('备注 (note) 字段正确显示', async () => {
    const page = electronTest.getPage();
    const { firstImageId } = await enterImageDetailView(page);

    // 从数据库获取图像信息
    const dbImage = await getImageFromDatabase(page, firstImageId);
    expect(dbImage).toBeTruthy();

    // 验证备注输入框显示正确
    const noteInput = page.locator('#imageDetailNote');
    await expect(noteInput).toBeVisible();
    const displayedNote = await noteInput.inputValue();

    // 备注可能为空
    expect(displayedNote).toBe(dbImage!.note || '');

    await page.screenshot({ path: 'test-results/image-detail/09-note-field.png' });
  });

  test('图像标签 (tags) 字段正确显示', async () => {
    const page = electronTest.getPage();
    const { firstImageId } = await enterImageDetailView(page);

    // 从数据库获取图像信息
    const dbImage = await getImageFromDatabase(page, firstImageId);
    expect(dbImage).toBeTruthy();

    // 验证标签容器存在
    const tagsContainer = page.locator(`#${Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER}`);
    await expect(tagsContainer).toBeVisible();

    // 获取显示的标签（使用更精确的选择器，只获取标签文本部分）
    const displayedTags = await page.evaluate((containerId) => {
      const container = document.getElementById(containerId);
      if (!container) return [];
      // 只获取标签文本，排除删除按钮
      return Array.from(container.querySelectorAll('.tag-editable'))
        .map(el => {
          // 获取标签文本内容，去除删除按钮的文本
          const text = el.textContent || '';
          // 去除末尾的 '×' 和空白字符
          return text.replace(/[\s×]+$/, '').trim();
        });
    }, Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER);

    // 验证标签数量匹配
    const dbTags = dbImage!.tags || [];
    expect(displayedTags.length).toBe(dbTags.length);

    // 如果有标签，验证标签内容
    if (dbTags.length > 0) {
      for (let i = 0; i < dbTags.length; i++) {
        expect(displayedTags[i]).toBe(dbTags[i]);
      }
    }

    await page.screenshot({ path: 'test-results/image-detail/10-tags-field.png' });
  });

  test('关联提示词信息正确显示', async () => {
    const page = electronTest.getPage();
    const { firstImageId } = await enterImageDetailView(page);

    // 从数据库获取图像信息（包含关联提示词）
    // 注意：promptRefs 中的字段在映射到 IPrompt 时会转换为 contentTranslate
    const dbImage = await page.evaluate(async (id: string) => {
      try {
        // 获取图像详情，包含关联的提示词信息
        const image = await window.electronAPI.getImageById(id);
        return image as IImage & { promptRefs?: Array<{ promptId: string; promptTitle?: string; promptContent?: string; promptContentTranslate?: string; promptNote?: string }> };
      } catch (error) {
        console.error('Failed to get image:', error);
        return null;
      }
    }, firstImageId);

    expect(dbImage).toBeTruthy();

    // 验证提示词标题区域
    const promptTitleEl = page.locator('#imageDetailPromptTitle');
    await expect(promptTitleEl).toBeVisible();

    // 验证提示词内容区域
    const promptContentEl = page.locator('#imageDetailPromptContent');
    await expect(promptContentEl).toBeVisible();

    // 验证提示词翻译区域
    const promptTranslateEl = page.locator('#imageDetailPromptTranslate');
    await expect(promptTranslateEl).toBeVisible();

    // 验证提示词备注区域
    const promptNoteEl = page.locator('#imageDetailPromptNote');
    await expect(promptNoteEl).toBeVisible();

    // 验证提示词标签区域
    const promptTagsEl = page.locator('#imageDetailTags');
    await expect(promptTagsEl).toBeVisible();

    // 如果有关联提示词，验证信息显示
    if (dbImage!.promptRefs && dbImage!.promptRefs.length > 0) {
      const firstPrompt = dbImage!.promptRefs[0];

      // 验证提示词标题
      const promptTitleText = await promptTitleEl.textContent();
      expect(promptTitleText).not.toBe('-');

      // 验证提示词内容
      const promptContentText = await promptContentEl.textContent();
      if (firstPrompt.promptContent) {
        expect(promptContentText).toBe(firstPrompt.promptContent);
      }

      // 验证提示词翻译
      // 注意：IPrompt 中使用的是 contentTranslate 字段
      const promptTranslateText = await promptTranslateEl.textContent();
      const translateContent = (firstPrompt as any).contentTranslate || firstPrompt.promptContentTranslate;
      // 确保转换为字符串进行比较
      const expectedTranslate = translateContent ? String(translateContent) : '-';
      expect(promptTranslateText).toBe(expectedTranslate);
    } else {
      // 没有关联提示词时，应该显示 '-'
      const promptTitleText = await promptTitleEl.textContent();
      expect(promptTitleText).toBe('-');
    }

    await page.screenshot({ path: 'test-results/image-detail/11-prompt-refs.png' });
  });

  test('图像预览正确加载', async () => {
    const page = electronTest.getPage();
    const { firstImageId } = await enterImageDetailView(page);

    // 从数据库获取图像信息
    const dbImage = await getImageFromDatabase(page, firstImageId);
    expect(dbImage).toBeTruthy();

    // 验证图像元素存在
    const imgEl = page.locator('#imageDetailImg');
    await expect(imgEl).toBeVisible();

    // 验证图像 src 不为空
    const imgSrc = await imgEl.getAttribute('src');
    expect(imgSrc).toBeTruthy();
    expect(imgSrc).toContain('file://');

    // 验证图像 alt 文本
    const imgAlt = await imgEl.getAttribute('alt');
    expect(imgAlt).toBe(dbImage!.fileName || '图像');

    await page.screenshot({ path: 'test-results/image-detail/12-image-preview.png' });
  });

  test('所有数据库字段一致性验证', async () => {
    const page = electronTest.getPage();
    const { firstImageId } = await enterImageDetailView(page);

    // 从数据库获取完整图像信息
    const dbImage = await getImageFromDatabase(page, firstImageId);
    expect(dbImage).toBeTruthy();

    // 收集所有界面显示的值
    const uiValues = await page.evaluate((containerId) => {
      const getValue = (id: string): string => {
        const el = document.getElementById(id);
        if (!el) return '';
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          return el.value;
        }
        return el.textContent || '';
      };

      const getTags = (): string[] => {
        const container = document.getElementById(containerId);
        if (!container) return [];
        return Array.from(container.querySelectorAll('.tag-editable'))
          .map(el => {
            // 去除末尾的 '×' 和空白字符
            const text = el.textContent || '';
            return text.replace(/[\s×]+$/, '').trim();
          });
      };

      return {
        fileName: getValue('imageDetailFileName'),
        note: getValue('imageDetailNote'),
        fileSize: getValue('imageDetailFileSize'),
        dimensions: getValue('imageDetailDimensions'),
        createdAt: getValue('imageDetailCreatedAt'),
        updatedAt: getValue('imageDetailUpdatedAt'),
        tags: getTags()
      };
    }, Constants.Ids.IMAGE_DETAIL_TAGS_CONTAINER);

    // 验证所有字段一致性（不包含 isSafe，因为它是特殊标签）
    expect(uiValues.fileName).toBe(dbImage!.fileName || '');
    expect(uiValues.note).toBe(dbImage!.note || '');
    expect(uiValues.createdAt).toBe(dbImage!.createdAt || '-');
    expect(uiValues.updatedAt).toBe(dbImage!.updatedAt || '-');

    // 验证标签
    const dbTags = dbImage!.tags || [];
    expect(uiValues.tags).toEqual(dbTags);

    // 验证文件大小格式
    if (dbImage!.fileSize && dbImage!.fileSize > 0) {
      expect(uiValues.fileSize).not.toBe('-');
    }

    // 验证尺寸格式
    if (dbImage!.width && dbImage!.height) {
      expect(uiValues.dimensions).toContain(String(dbImage!.width));
      expect(uiValues.dimensions).toContain(String(dbImage!.height));
    }

    await page.screenshot({ path: 'test-results/image-detail/13-all-fields-consistency.png' });
  });
});

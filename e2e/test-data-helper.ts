import type { Page } from '@playwright/test';

/**
 * 测试数据帮助类
 * 统一管理测试数据的生成和清理
 */
export class TestDataHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ========== 标签名称生成 ==========

  /**
   * 生成单个测试标签名
   */
  generateTagName(suffix: string): string {
    return `e2e_${suffix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  /**
   * 生成多个测试标签名
   */
  generateTagNames(count: number, prefix: string): string[] {
    return Array.from({ length: count }, (_, i) =>
      this.generateTagName(`${prefix}_${i}`)
    );
  }

  // ========== 图像标签创建 ==========

  /**
   * 创建单个图像标签
   */
  async createImageTag(suffix: string): Promise<string> {
    const tagName = this.generateTagName(suffix);
    await this.page.evaluate(async (tag) => {
      await window.electronAPI.addImageTag(tag);
    }, tagName);
    return tagName;
  }

  /**
   * 批量创建图像标签
   */
  async createImageTags(count: number, prefix: string): Promise<string[]> {
    const tagNames = this.generateTagNames(count, prefix);
    await this.page.evaluate(async (tags) => {
      await window.electronAPI.addImageTags('', tags);
    }, tagNames);
    return tagNames;
  }

  // ========== 提示词标签创建 ==========

  /**
   * 创建单个提示词标签
   */
  async createPromptTag(suffix: string): Promise<string> {
    const tagName = this.generateTagName(suffix);
    await this.page.evaluate(async (tag) => {
      await window.electronAPI.addPromptTag(tag);
    }, tagName);
    return tagName;
  }

  /**
   * 批量创建提示词标签
   */
  async createPromptTags(count: number, prefix: string): Promise<string[]> {
    const tagNames = this.generateTagNames(count, prefix);
    await this.page.evaluate(async (tags) => {
      await window.electronAPI.addPromptTags('', tags);
    }, tagNames);
    return tagNames;
  }

  // ========== 标签清理 ==========

  /**
   * 清理所有测试标签（图像和提示词）
   */
  async cleanupAllTags(): Promise<void> {
    await this.page.evaluate(async () => {
      // 批量清理图像标签
      const imageTags = await window.electronAPI.getImageTags();
      const testImageTags = imageTags.filter(tag => tag.startsWith('e2e_'));
      if (testImageTags.length > 0) {
        await window.electronAPI.deleteImageTags(testImageTags);
      }

      // 批量清理提示词标签
      const promptTags = await window.electronAPI.getPromptTags();
      const testPromptTags = promptTags.filter(tag => tag.startsWith('e2e_'));
      if (testPromptTags.length > 0) {
        await window.electronAPI.deletePromptTags(testPromptTags);
      }
    });
  }

  // ========== 验证 ==========

  /**
   * 验证标签是否存在
   */
  async tagExists(tagName: string, type: 'image' | 'prompt'): Promise<boolean> {
    const tags = await this.page.evaluate(async (t) => {
      return t === 'image'
        ? await window.electronAPI.getImageTags()
        : await window.electronAPI.getPromptTags();
    }, type);
    return tags.includes(tagName);
  }
}

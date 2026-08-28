import type { Page } from "@playwright/test";
import type { IImage, IPrompt } from "../../src/types/entities.ts";
import { BaseTestDataFactory } from "./base-factory.ts";
import type { ImageCreateData } from "./interfaces.ts";
import { generateTempImage } from "./image-utils.ts";

/**
 * 图像 API 数据工厂
 */
export class ImageApiFactory extends BaseTestDataFactory<IImage> {
  constructor(page: Page) {
    super(page);
  }

  /**
   * 生成测试图像文件名
   */
  private generateFileName(label: string): string {
    return `e2e_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.png`;
  }

  /**
   * 创建图像
   */
  async create(data: ImageCreateData): Promise<IImage> {
    const fileName = data.fileName || this.generateFileName(data.label);
    const tempPath = await generateTempImage();

    const result = await this.page.evaluate(
      async (params: { path: string; fileName: string }) => {
        return await window.electronAPI.saveImageFile(params.path, params.fileName);
      },
      { path: tempPath, fileName },
    );

    if (!result || !result.id) {
      throw new Error(`Failed to create image with label: ${data.label}`);
    }

    const image = await this.page.evaluate(async (id: string) => {
      return await window.electronAPI.getImageById(id);
    }, result.id);

    if (!image) {
      throw new Error(`Failed to get image by id: ${result.id}`);
    }

    return image;
  }

  /**
   * 批量创建图像
   */
  async createBatch(count: number, label: string): Promise<IImage[]> {
    return this._batchCreate(count, label, (l) => this.create({ label: l }));
  }

  /**
   * 创建独立图像标签
   */
  async createTag(tagName: string): Promise<void> {
    await this.page.evaluate(async (name: string) => {
      await window.electronAPI.addImageTag(name);
    }, tagName);
  }

  /**
   * 批量创建独立图像标签
   */
  async createTags(count: number, label: string): Promise<string[]> {
    return this._createTags(count, label, (name) => this.createTag(name));
  }

  /**
   * 实现基类抽象方法：获取现有标签组列表
   */
  protected async _getTagGroups(): Promise<Array<{ id: number; name: string; sortOrder: number }>> {
    return await this.page.evaluate(async () => {
      return await window.electronAPI.getImageTagGroups();
    });
  }

  /**
   * 实现基类抽象方法：调用创建标签组 API
   */
  protected async _createTagGroupApi(
    name: string,
    sortOrder: number,
  ): Promise<{ id: number; name: string; sortOrder: number } | null> {
    return await this.page.evaluate(
      async (params: { name: string; sortOrder: number }) => {
        return await window.electronAPI.createImageTagGroup(params.name, params.sortOrder);
      },
      { name, sortOrder },
    );
  }

  /**
   * 实现基类抽象方法：将标签分配到标签组
   */
  protected async _assignTagToGroup(tagName: string, groupId: number): Promise<void> {
    await this.page.evaluate(
      async (params: { tag: string; groupId: number }) => {
        await window.electronAPI.assignImageTagToBelongGroup(params.tag, params.groupId);
      },
      { tag: tagName, groupId },
    );
  }

  /**
   * 创建带标签的图像
   */
  async createWithTags(data: ImageCreateData, tagNames: string[]): Promise<IImage> {
    const image = await this.create(data);
    await this._linkTagsToEntity(image.id, tagNames);
    return image;
  }

  /**
   * 创建带指定数量提示词的图像
   */
  async createWithPromptCount(
    label: string,
    promptCount: number,
    promptLabelPrefix?: string,
  ): Promise<{ image: IImage; prompts: IPrompt[] }> {
    const image = await this.create({ label });

    if (promptCount === 0) {
      return { image, prompts: [] };
    }

    const prefix = promptLabelPrefix || label;
    const prompts: IPrompt[] = [];

    for (let i = 0; i < promptCount; i++) {
      const promptLabel = `${prefix}_${i}`;
      const prompt = await this._createPromptDirect(promptLabel, image.id);
      prompts.push(prompt);
    }

    return { image, prompts };
  }

  /**
   * 直接创建提示词（通过 API，不依赖提示词工厂）
   */
  private async _createPromptDirect(label: string, imageId: string): Promise<IPrompt> {
    const title = this.generateName(label);
    const prompt = await this.page.evaluate(
      async (params: { title: string; imageId: string }) => {
        return await window.electronAPI.addPrompt({
          title: params.title,
          content: `e2e_${params.title}`,
          contentTranslate: "",
          note: "",
          isSafe: 1,
          isFavorite: false,
          tags: [],
          images: [{ id: params.imageId }],
        });
      },
      { title, imageId },
    );

    if (!prompt) {
      throw new Error(`Failed to create prompt with label: ${label}`);
    }

    return prompt;
  }

  /**
   * 实现基类抽象方法：关联标签到图像
   */
  protected async _linkTagsToEntity(imageId: string, tagNames: string[]): Promise<void> {
    await this.page.evaluate(
      async (params: { imageId: string; tags: string[] }) => {
        await window.electronAPI.addImageTags(params.imageId, params.tags);
      },
      { imageId, tags: tagNames },
    );
  }
}

import type { Page } from "@playwright/test";
import type { IPrompt } from "../../src/types/entities.ts";
import { BaseTestDataFactory } from "./base-factory.ts";
import type { PromptCreateData } from "./interfaces.ts";
import { generateTempImage } from "./image-utils.ts";

/**
 * 提示词 API 数据工厂
 */
export class PromptApiFactory extends BaseTestDataFactory<IPrompt> {
  constructor(page: Page) {
    super(page);
  }

  /**
   * 创建提示词
   */
  async create(data: PromptCreateData): Promise<IPrompt> {
    const title = data.title || this.generateName(data.label);

    const promptData: Omit<IPrompt, "id"> = {
      title,
      content: data.content || `e2e_${title}`,
      contentTranslate: data.contentTranslate || "",
      note: data.note || "",
      isSafe: data.isSafe ?? 1,
      isFavorite: data.isFavorite ?? 0,
      tags: data.tags || [],
      images: data.images || [],
      isDeleted: false,
    };

    const prompt = await this.page.evaluate(async (pd) => {
      return await window.electronAPI.addPrompt(pd);
    }, promptData);

    if (!prompt) {
      throw new Error(`Failed to create prompt with label: ${data.label}`);
    }

    return prompt;
  }

  /**
   * 批量创建提示词
   */
  async createBatch(count: number, label: string): Promise<IPrompt[]> {
    return this._batchCreate(count, label, (l) => this.create({ label: l }));
  }

  /**
   * 创建独立提示词标签
   */
  async createTag(tagName: string): Promise<void> {
    await this.page.evaluate(async (name: string) => {
      await window.electronAPI.addPromptTag(name);
    }, tagName);
  }

  /**
   * 批量创建独立提示词标签
   */
  async createTags(count: number, label: string): Promise<string[]> {
    return this._createTags(count, label, (name) => this.createTag(name));
  }

  /**
   * 实现基类抽象方法：获取现有标签组列表
   */
  protected async _getTagGroups(): Promise<Array<{ id: number; name: string; sortOrder: number }>> {
    return await this.page.evaluate(async () => {
      return await window.electronAPI.getPromptTagGroups();
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
        return await window.electronAPI.createPromptTagGroup(params.name, params.sortOrder);
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
        await window.electronAPI.assignPromptTagToBelongGroup(params.tag, params.groupId);
      },
      { tag: tagName, groupId },
    );
  }

  /**
   * 创建带标签的提示词
   */
  async createWithTags(data: PromptCreateData, tagNames: string[]): Promise<IPrompt> {
    const prompt = await this.create(data);
    await this._linkTagsToEntity(prompt.id, tagNames);
    return prompt;
  }

  /**
   * 创建带图像的提示词
   */
  async createWithImages(data: PromptCreateData, imageIds: string[]): Promise<IPrompt> {
    const promptData: PromptCreateData = {
      ...data,
      images: imageIds.map((id) => ({ id })),
    };
    return this.create(promptData);
  }

  /**
   * 创建带指定数量图像的提示词
   */
  async createWithImageCount(
    label: string,
    imageCount: number,
    imageLabelPrefix?: string,
  ): Promise<IPrompt> {
    if (imageCount === 0) {
      return this.create({ label });
    }

    const prefix = imageLabelPrefix || label;
    const imageIds: string[] = [];

    for (let i = 0; i < imageCount; i++) {
      const imgLabel = `${prefix}_${i}`;
      const image = await this._createImageDirect(imgLabel);
      imageIds.push(String(image.id));
    }

    return this.createWithImages({ label }, imageIds);
  }

  /**
   * 直接创建图像（通过 API，不依赖图像工厂）
   */
  private async _createImageDirect(label: string): Promise<{ id: string }> {
    const fileName = `e2e_${label}_${Date.now()}.png`;
    const tempPath = await generateTempImage();

    return await this.page.evaluate(
      async (params: { path: string; fileName: string }) => {
        return await window.electronAPI.saveImageFile(params.path, params.fileName);
      },
      { path: tempPath, fileName },
    );
  }

  /**
   * 实现基类抽象方法：关联标签到提示词
   */
  protected async _linkTagsToEntity(promptId: string, tagNames: string[]): Promise<void> {
    await this.page.evaluate(
      async (params: { promptId: string; tags: string[] }) => {
        await window.electronAPI.addPromptTags(params.promptId, params.tags);
      },
      { promptId, tags: tagNames },
    );
  }
}

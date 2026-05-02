import type { Page } from "@playwright/test";
import type { IPrompt } from "../../src/types/entities.ts";
import { BaseTestDataFactory } from "./base-factory.ts";
import type { PromptCreateData } from "./interfaces.ts";

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
   * 创建带标签的提示词
   */
  async createWithTags(
    data: PromptCreateData,
    tagNames: string[],
  ): Promise<IPrompt> {
    const prompt = await this.create(data);
    await this._linkTagsToEntity(prompt.id, tagNames);
    return prompt;
  }

  /**
   * 创建带图像的提示词
   */
  async createWithImages(
    data: PromptCreateData,
    imageIds: string[],
  ): Promise<IPrompt> {
    const promptData: PromptCreateData = {
      ...data,
      images: imageIds.map((id) => ({ id })),
    };
    return this.create(promptData);
  }

  /**
   * 实现基类抽象方法：关联标签到提示词
   */
  protected async _linkTagsToEntity(
    promptId: string,
    tagNames: string[],
  ): Promise<void> {
    await this.page.evaluate(
      async (params: { promptId: string; tags: string[] }) => {
        await window.electronAPI.addPromptTags(params.promptId, params.tags);
      },
      { promptId, tags: tagNames },
    );
  }
}

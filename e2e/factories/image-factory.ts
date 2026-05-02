import { mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Page } from "@playwright/test";
import sharp from "sharp";
import type { IImage, IPrompt } from "../../src/types/entities.ts";
import { BaseTestDataFactory } from "./base-factory.ts";
import type { ImageCreateData, PromptCreateData } from "./interfaces.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
   * 生成临时测试图像文件
   */
  private async generateTempImage(): Promise<string> {
    const testDir = join(__dirname, "..", "..", "test-data");
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }

    const uniqueId = Math.random().toString(36).slice(2, 8);
    const fileName = `e2e_${Date.now()}_${uniqueId}.png`;
    const outputPath = join(testDir, fileName);

    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);

    await sharp({
      create: {
        width: 200,
        height: 100,
        channels: 3,
        background: `rgb(${r}, ${g}, ${b})`,
      },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
              <text x="100" y="55" font-size="12" fill="white" text-anchor="middle" font-family="monospace">
                ${Date.now()}-${uniqueId}
              </text>
            </svg>`,
          ),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toFile(outputPath);

    if (!existsSync(outputPath)) {
      throw new Error(`Failed to generate test image: ${outputPath}`);
    }

    return outputPath;
  }

  /**
   * 创建图像
   */
  async create(data: ImageCreateData): Promise<IImage> {
    const fileName = data.fileName || this.generateFileName(data.label);
    const tempPath = await this.generateTempImage();

    const result = await this.page.evaluate(
      async (params: { path: string; fileName: string }) => {
        return await window.electronAPI.saveImageFile(
          params.path,
          params.fileName,
        );
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
   * 创建带标签的图像
   */
  async createWithTags(
    data: ImageCreateData,
    tagNames: string[],
  ): Promise<IImage> {
    const image = await this.create(data);
    await this._linkTagsToEntity(image.id, tagNames);
    return image;
  }

  /**
   * 创建带提示词的图像
   */
  async createWithPrompts(
    data: ImageCreateData,
    promptDataList: PromptCreateData[],
  ): Promise<{ image: IImage; prompts: IPrompt[] }> {
    const image = await this.create(data);

    const prompts: IPrompt[] = [];
    for (const promptData of promptDataList) {
      const prompt = await this.page.evaluate(
        async (pd: Omit<IPrompt, "id">) => {
          return await window.electronAPI.addPrompt(pd);
        },
        {
          title: promptData.title || this.generateName(promptData.label),
          content: promptData.content || `e2e_${promptData.label}`,
          contentTranslate: promptData.contentTranslate || "",
          note: promptData.note || "",
          isSafe: promptData.isSafe ?? 1,
          isFavorite: promptData.isFavorite ?? 0,
          tags: promptData.tags || [],
          images: [{ id: image.id }],
          isDeleted: false,
        },
      );

      if (!prompt) {
        throw new Error(
          `Failed to create prompt with label: ${promptData.label}`,
        );
      }

      prompts.push(prompt);
    }

    return { image, prompts };
  }

  /**
   * 实现基类抽象方法：关联标签到图像
   */
  protected async _linkTagsToEntity(
    imageId: string,
    tagNames: string[],
  ): Promise<void> {
    await this.page.evaluate(
      async (params: { imageId: string; tags: string[] }) => {
        await window.electronAPI.addImageTags(params.imageId, params.tags);
      },
      { imageId, tags: tagNames },
    );
  }
}

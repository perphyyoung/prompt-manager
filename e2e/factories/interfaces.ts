import type { IPrompt, IImage } from "../../src/types/entities.ts";

/**
 * 提示词创建数据
 */
export interface PromptCreateData {
  label: string;
  title?: string;
  content?: string;
  contentTranslate?: string;
  note?: string;
  isSafe?: number;
  isFavorite?: number;
  tags?: string[];
  images?: Array<{ id: string; thumbnailPath?: string }>;
}

/**
 * 图像创建数据
 */
export interface ImageCreateData {
  label: string;
  fileName?: string;
  isSafe?: number;
  isFavorite?: number;
  note?: string;
  tags?: string[];
  prompts?: Array<{ id: string }>;
}

/**
 * 提示词数据工厂接口
 */
export interface IPromptDataFactory {
  create(data: PromptCreateData): Promise<IPrompt>;
  createBatch(count: number, label: string): Promise<IPrompt[]>;
  createTag(tagName: string): Promise<void>;
  createTags(count: number, label: string): Promise<string[]>;
  createTagGroup(name: string, isTop?: boolean): Promise<{ id: number; name: string; sortOrder: number }>;
  createTagInGroup(groupName: string, tagLabel: string, isTop?: boolean): Promise<string>;
  createWithTags(data: PromptCreateData, tagNames: string[]): Promise<IPrompt>;
  createWithImages(data: PromptCreateData, imageIds: string[]): Promise<IPrompt>;
}

/**
 * 图像数据工厂接口
 */
export interface IImageDataFactory {
  create(data: ImageCreateData): Promise<IImage>;
  createBatch(count: number, label: string): Promise<IImage[]>;
  createTag(tagName: string): Promise<void>;
  createTags(count: number, label: string): Promise<string[]>;
  createTagGroup(name: string, isTop?: boolean): Promise<{ id: number; name: string; sortOrder: number }>;
  createTagInGroup(groupName: string, tagLabel: string, isTop?: boolean): Promise<string>;
  createWithTags(data: ImageCreateData, tagNames: string[]): Promise<IImage>;
  createWithPrompts(
    data: ImageCreateData,
    promptDataList: PromptCreateData[],
  ): Promise<{ image: IImage; prompts: IPrompt[] }>;
}

/**
 * 抽象工厂接口
 */
export interface ITestDataFactory {
  createPromptFactory(): IPromptDataFactory;
  createImageFactory(): IImageDataFactory;
}

/**
 * 详情页数据服务
 *
 * 从 PromptDetailManager / ImageDetailManager 中抽取的「纯数据」关注点：
 * 关联图像/提示词的持久化、安全评级同步、全局缓存失效与列表刷新事件。
 * 不触碰任何 DOM 与 Manager 本地状态（promptRefImagesCache、uploadStrategy 等），因此可被独立单测，
 *
 * 端口注入：`api`（electronAPI 子集）与 `eventBus` 均可被 fake 替换（见 tests/services）。
 */

import { cacheManager } from "../../utils/index.ts";
import { Events } from "../constants.ts";
import { IPrompt, IImage, PromptRefView } from "../../types/entities.ts";

/** electronAPI 数据访问子集，便于单测替换为 fake */
export interface DetailDataApiPort {
  updatePrompt(id: string, updates: Partial<IPrompt>): Promise<void>;
  updateImage(id: string, updates: Partial<IImage>): Promise<void>;
  getPromptById(id: string): Promise<IPrompt | null>;
  getImageById(id: string): Promise<IImage | null>;
  logError(module: string, message: string, ...args: unknown[]): void;
}

/** 事件总线子集 */
export interface DetailEventBusPort {
  emit(event: string, data?: unknown): void;
}

export interface DetailDataServiceDeps {
  eventBus: DetailEventBusPort;
  api: DetailDataApiPort;
}

export class DetailDataService {
  constructor(private readonly deps: DetailDataServiceDeps) {}

  /** 保存提示词的关联图像列表，并通知图像/提示词列表刷新 */
  async savePromptImages(promptId: string, images: IImage[]): Promise<void> {
    await this.deps.api.updatePrompt(promptId, { images });
    this.deps.eventBus.emit(Events.IMAGES_CHANGED);
    this.deps.eventBus.emit(Events.PROMPTS_CHANGED);
  }

  /**
   * 将安全评级同步到多个关联图像。
   * 更新数据库与全局缓存，并在有成功项时通知图像列表刷新。
   * @returns 成功同步的图像 ID 列表（供调用方刷新对开界面 UI）
   */
  async syncImagesSafety(imageIds: string[], isSafe: number): Promise<string[]> {
    const synced: string[] = [];
    for (const imageId of imageIds) {
      try {
        await this.deps.api.updateImage(imageId, { isSafe });
        const cached = cacheManager.getCachedImage(imageId);
        if (cached) cached.isSafe = isSafe;
        synced.push(imageId);
      } catch (error) {
        this.deps.api.logError(
          "DetailDataService",
          `Failed to sync safety to image ${imageId}: ${error}`,
        );
      }
    }
    if (synced.length > 0) this.deps.eventBus.emit(Events.IMAGES_CHANGED);
    return synced;
  }

  /** 保存图像的关联提示词列表，并通知刷新 */
  async saveImagePrompts(imageId: string, prompts: PromptRefView[]): Promise<void> {
    const promptsForUpdate = prompts.map((p) => ({ id: p.promptId }));
    await this.deps.api.updateImage(imageId, { prompts: promptsForUpdate });
    const cached = cacheManager.getCachedImage(imageId);
    if (cached) cached.promptRefs = prompts;
    this.deps.eventBus.emit(Events.PROMPTS_CHANGED);
    this.deps.eventBus.emit(Events.IMAGES_CHANGED);
  }

  /**
   * 将安全评级同步到多个关联提示词。
   * @returns 成功同步的提示词 ID 列表（供调用方刷新对开界面 UI）
   */
  async syncPromptsSafety(promptIds: string[], isSafe: number): Promise<string[]> {
    const synced: string[] = [];
    for (const promptId of promptIds) {
      try {
        await this.deps.api.updatePrompt(promptId, { isSafe });
        const cached = cacheManager.getCachedPrompt(promptId);
        if (cached) cached.isSafe = isSafe;
        synced.push(promptId);
      } catch (error) {
        this.deps.api.logError(
          "DetailDataService",
          `Failed to sync safety to prompt ${promptId}: ${error}`,
        );
      }
    }
    if (synced.length > 0) this.deps.eventBus.emit(Events.PROMPTS_CHANGED);
    return synced;
  }

  async getPromptById(id: string): Promise<IPrompt | null> {
    return this.deps.api.getPromptById(id);
  }

  async getImageById(id: string): Promise<IImage | null> {
    return this.deps.api.getImageById(id);
  }
}

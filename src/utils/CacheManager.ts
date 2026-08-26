import { LRUCache } from './LRUCache.js';
import { logger } from './Logger.ts';
import type { IPrompt, IImage } from '../types/entities.js';

/**
 * 全局缓存管理器
 * 集中管理应用中的所有缓存，提供统一的缓存接口
 */
export class CacheManager {
  private caches: Map<string, LRUCache>;
  private defaultMaxSize: number;

  constructor() {
    this.caches = new Map();
    this.defaultMaxSize = 100;
  }

  /**
   * 创建或获取命名缓存
   * 注意：幂等设计——已存在的同名缓存不会应用新的 maxSize（容量调整需重启会话）
   * @param name - 缓存名称
   * @param maxSize - 最大缓存条目数
   * @returns LRU 缓存实例
   */
  createCache(name: string, maxSize: number = this.defaultMaxSize): LRUCache {
    if (!this.caches.has(name)) {
      const cache = new LRUCache(maxSize);
      this.caches.set(name, cache);
    }
    return this.caches.get(name)!;
  }

  /**
   * 获取已存在的缓存
   * @param name - 缓存名称
   * @returns 缓存实例或 undefined
   */
  getCache(name: string): LRUCache | undefined {
    return this.caches.get(name);
  }

  /**
   * 删除指定缓存
   * @param name - 缓存名称
   * @returns 是否成功删除
   */
  deleteCache(name: string): boolean {
    const cache = this.caches.get(name);
    if (cache) {
      cache.clear();
      return this.caches.delete(name);
    }
    return false;
  }

  /**
   * 清空所有缓存
   */
  clearAll(): void {
    this.caches.forEach(cache => cache.clear());
  }

  /**
   * 获取缓存统计信息
   * @returns 各缓存的大小统计
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.caches.forEach((cache, name) => {
      stats[name] = cache.size;
    });
    return stats;
  }

  // ==================== 图像路径缓存快捷方法 ====================
  // 缩略图路径高频读取（每张卡片渲染都需要），容量放大；
  // 原图路径缓存当前仅覆盖 hover 预览的高频访问——两个详情界面
  // （ImageDetailManager / PromptDetailManager）与全屏查看为低频单次查询，
  // 直接经 electronAPI.getImagePath(relativePath) 获取，不经过本缓存。
  // 两个独立 LRU 避免互相挤占；键为纯 imageId；
  // 读取统一用 peek，不扰动淘汰顺序。

  /** 缩略图路径缓存（高频） */
  private getThumbnailPathCache(): LRUCache {
    return this.createCache('thumbnailPaths', 5000);
  }

  /** 原图路径缓存（低频，仅 hover 预览） */
  private getOriginalPathCache(): LRUCache {
    return this.createCache('originalPaths', 1000);
  }

  private getPathCache(type: 'original' | 'thumbnail'): LRUCache {
    return type === 'thumbnail' ? this.getThumbnailPathCache() : this.getOriginalPathCache();
  }

  /**
   * 获取图像完整路径
   * @param imageId - 图像 ID
   * @param type - 路径类型: 'original' | 'thumbnail'
   * @returns 完整路径或 undefined
   */
  getImagePath(imageId: string, type: 'original' | 'thumbnail' = 'original'): string | undefined {
    return this.getPathCache(type).peek(imageId) as string | undefined;
  }

  /**
   * 设置图像完整路径
   * @param imageId - 图像 ID
   * @param type - 路径类型: 'original' | 'thumbnail'
   * @param path - 完整路径
   */
  setImagePath(imageId: string, type: 'original' | 'thumbnail', path: string): void {
    this.getPathCache(type).set(imageId, path);
  }

  /**
   * 清除图像路径缓存
   * @param imageId - 图像 ID（可选，不提供则清除所有）
   */
  clearImagePathCache(imageId?: string): void {
    for (const cache of [this.getThumbnailPathCache(), this.getOriginalPathCache()]) {
      if (imageId) {
        cache.delete(imageId);
      } else {
        cache.clear();
      }
    }
  }

  /**
   * 批量预写入图像路径（保持 LRU 顺序：保留已存在的，追加新的）
   * @param entries - 图像 ID 与完整路径的对应关系
   * @param type - 路径类型: 'original' | 'thumbnail'
   */
  setImagePaths(
    entries: Array<{ imageId: string; fullPath: string }>,
    type: 'original' | 'thumbnail'
  ): void {
    if (entries.length === 0) return;
    const cache = this.getPathCache(type);
    for (const { imageId, fullPath } of entries) {
      if (imageId && fullPath) {
        cache.set(imageId, fullPath);
      }
    }
  }

  /**
   * 预缓存一批图像的完整路径（原图 + 缩略图）
   * 仅写入缓存缺失的项。主要预填充入口（分页加载后调用）；
   * 各渲染兜底路径（如 loadCardBackgroundsForItems 未命中批量查询）也会写入
   * @param images - 图像列表
   * @param electronAPI - 渲染进程的 electronAPI（用于 getImagesPaths）
   * @returns 是否有新项写入
   */
  async prefetchImagePaths(
    images: Array<{ id: string | number; relativePath?: string; thumbnailPath?: string }>,
    electronAPI: { getImagesPaths: (relativePaths: string[]) => Promise<string[]> }
  ): Promise<void> {
    if (images.length === 0) return;

    const originalEntries: Array<{ imageId: string; fullPath: string }> = [];
    const thumbnailEntries: Array<{ imageId: string; fullPath: string }> = [];
    const needOriginalRelative: string[] = [];
    const needThumbnailRelative: string[] = [];

    for (const img of images) {
      const id = String(img.id);
      if (img.relativePath && !this.getImagePath(id, 'original')) {
        needOriginalRelative.push(img.relativePath);
        originalEntries.push({ imageId: id, fullPath: '' });
      }
      const thumbPath = img.thumbnailPath || img.relativePath;
      if (thumbPath && !this.getImagePath(id, 'thumbnail')) {
        needThumbnailRelative.push(thumbPath);
        thumbnailEntries.push({ imageId: id, fullPath: '' });
      }
    }

    try {
      if (needOriginalRelative.length > 0) {
        const fullPaths = await electronAPI.getImagesPaths(needOriginalRelative);
        needOriginalRelative.forEach((_, i) => {
          originalEntries[i].fullPath = fullPaths[i] || '';
        });
        const valid = originalEntries.filter(e => e.fullPath);
        this.setImagePaths(valid, 'original');
      }
      if (needThumbnailRelative.length > 0) {
        const fullPaths = await electronAPI.getImagesPaths(needThumbnailRelative);
        needThumbnailRelative.forEach((_, i) => {
          thumbnailEntries[i].fullPath = fullPaths[i] || '';
        });
        const valid = thumbnailEntries.filter(e => e.fullPath);
        this.setImagePaths(valid, 'thumbnail');
      }
    } catch (error) {
      logger.error('CacheManager', 'Failed to prefetch image paths:', error);
    }
  }

  // ==================== 数据对象缓存快捷方法 ====================

  /**
   * 获取提示词缓存
   * @returns LRU 缓存实例
   */
  getPromptCache(): LRUCache {
    return this.createCache('prompts', 500);
  }

  /**
   * 获取图像缓存
   * @returns LRU 缓存实例
   */
  getImageCache(): LRUCache {
    return this.createCache('images', 500);
  }

  /**
   * 缓存单个提示词
   * @param prompt - 提示词对象
   */
  cachePrompt(prompt: IPrompt): void {
    if (prompt && prompt.id) {
      this.getPromptCache().set(String(prompt.id), prompt);
    }
  }

  /**
   * 缓存单个图像
   * @param image - 图像对象
   */
  cacheImage(image: IImage): void {
    if (image && image.id) {
      this.getImageCache().set(String(image.id), image);
    }
  }

  /**
   * 批量缓存提示词
   * @param prompts - 提示词数组
   */
  cachePrompts(prompts: IPrompt[]): void {
    const cache = this.getPromptCache();
    cache.clear();
    prompts.forEach(prompt => {
      if (prompt && prompt.id) {
        cache.set(String(prompt.id), prompt);
      }
    });
  }

  /**
   * 批量缓存图像
   * 注意：会先清空缓存再写入（全量替换语义）
   * @param images - 图像数组
   */
  cacheImages(images: IImage[]): void {
    const cache = this.getImageCache();
    cache.clear();
    images.forEach(image => {
      if (image && image.id) {
        cache.set(String(image.id), image);
      }
    });
  }

  /**
   * 追加式批量缓存图像
   * 不清空现有缓存，仅写入/覆盖给定项——用于局部场景（如详情页选择图像）
   * 需要向全局缓存补充数据、且不能破坏主列表已缓存的元数据
   * @param images - 图像数组
   */
  cacheImagesAppend(images: IImage[]): void {
    for (const image of images) {
      this.cacheImage(image);
    }
  }

  /**
   * 从缓存获取提示词
   * @param id - 提示词 ID
   * @returns 提示词对象或 undefined
   */
  getCachedPrompt(id: string): IPrompt | undefined {
    return this.getPromptCache().get(String(id)) as IPrompt | undefined;
  }

  /**
   * 从缓存获取图像
   * @param id - 图像 ID
   * @returns 图像对象或 undefined
   */
  getCachedImage(id: string): IImage | undefined {
    return this.getImageCache().get(String(id)) as IImage | undefined;
  }

  // ==================== 通用缓存更新方法 ====================

  /**
   * 更新缓存中的项目
   * 根据类型自动选择对应的缓存，并应用更新
   * @param id - 项目 ID
   * @param type - 项目类型 ('prompt' | 'image')
   * @param updates - 要更新的字段对象
   * @returns 更新后的项目，如果缓存中不存在则返回 undefined
   */
  updateCachedItem<T extends IPrompt | IImage>(
    id: string,
    type: 'prompt' | 'image',
    updates: Partial<T>
  ): T | undefined {
    const cache = type === 'prompt' ? this.getPromptCache() : this.getImageCache();
    const item = cache.get(String(id)) as T | undefined;
    if (item) {
      Object.assign(item, updates);
      cache.set(String(id), item);
      return item;
    }
    return undefined;
  }

  /**
   * 原地更新缓存中的项目，不改变缓存顺序
   * 适用于只需更新对象内部字段、不希望影响界面排序的场景
   * @param id - 项目 ID
   * @param type - 项目类型 ('prompt' | 'image')
   * @param updater - 更新回调，接收当前缓存对象并直接修改
   * @returns 是否成功更新
   */
  updateCachedItemInPlace<T extends IPrompt | IImage>(
    id: string,
    type: 'prompt' | 'image',
    updater: (item: T) => void
  ): boolean {
    const cache = type === 'prompt' ? this.getPromptCache() : this.getImageCache();
    return cache.updateValue(String(id), updater as (value: IPrompt | IImage) => void);
  }

  /**
   * 从缓存中删除项目
   * @param id - 项目 ID
   * @param type - 项目类型 ('prompt' | 'image')
   * @returns 是否成功删除
   */
  removeCachedItem(id: string, type: 'prompt' | 'image'): boolean {
    const cache = type === 'prompt' ? this.getPromptCache() : this.getImageCache();
    return cache.delete(String(id));
  }

  /**
   * 检查项目是否在缓存中
   * @param id - 项目 ID
   * @param type - 项目类型 ('prompt' | 'image')
   * @returns 是否在缓存中
   */
  hasCachedItem(id: string, type: 'prompt' | 'image'): boolean {
    const cache = type === 'prompt' ? this.getPromptCache() : this.getImageCache();
    return cache.has(String(id));
  }
}

// 导出单例实例
export const cacheManager = new CacheManager();

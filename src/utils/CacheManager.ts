import { LRUCache } from './LRUCache.js';
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

  /**
   * 获取图像路径缓存
   * @returns LRU 缓存实例
   */
  getImagePathCache(): LRUCache {
    return this.createCache('imagePaths', 200);
  }

  /**
   * 获取图像完整路径
   * @param imageId - 图像 ID
   * @param type - 路径类型: 'original' | 'thumbnail'
   * @returns 完整路径或 undefined
   */
  getImagePath(imageId: string, type: 'original' | 'thumbnail' = 'original'): string | undefined {
    const cache = this.getImagePathCache();
    return cache.get(`${type}_${imageId}`) as string | undefined;
  }

  /**
   * 设置图像完整路径
   * @param imageId - 图像 ID
   * @param type - 路径类型: 'original' | 'thumbnail'
   * @param path - 完整路径
   */
  setImagePath(imageId: string, type: 'original' | 'thumbnail', path: string): void {
    const cache = this.getImagePathCache();
    cache.set(`${type}_${imageId}`, path);
  }

  /**
   * 清除图像路径缓存
   * @param imageId - 图像 ID（可选，不提供则清除所有）
   */
  clearImagePathCache(imageId?: string): void {
    const cache = this.getImagePathCache();
    if (imageId) {
      cache.delete(`original_${imageId}`);
      cache.delete(`thumbnail_${imageId}`);
    } else {
      cache.clear();
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
    prompts.forEach(prompt => {
      if (prompt && prompt.id) {
        cache.set(String(prompt.id), prompt);
      }
    });
  }

  /**
   * 批量缓存图像
   * @param images - 图像数组
   */
  cacheImages(images: IImage[]): void {
    const cache = this.getImageCache();
    images.forEach(image => {
      if (image && image.id) {
        cache.set(String(image.id), image);
      }
    });
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

export default CacheManager;

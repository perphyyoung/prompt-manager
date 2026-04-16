/**
 * LRU (Least Recently Used) 缓存实现
 * 限制缓存大小，自动淘汰最久未使用的数据
 */
export class LRUCache<T = any> {
  private maxSize: number;
  private cache: Map<string, T>;

  /**
   * @param maxSize - 最大缓存条目数
   */
  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  /**
   * 获取缓存值
   * @param key - 缓存键
   * @returns 缓存值或 undefined
   */
  get(key: string): T | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return undefined;
  }

  /**
   * 设置缓存值
   * @param key - 缓存键
   * @param value - 缓存值
   */
  set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  /**
   * 检查键是否存在
   * @param key - 缓存键
   * @returns 是否存在
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * 删除指定键
   * @param key - 缓存键
   * @returns 是否成功删除
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取当前缓存大小
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 获取所有键
   */
  keys(): IterableIterator<string> {
    return this.cache.keys();
  }

  /**
   * 获取所有值
   */
  values(): IterableIterator<T> {
    return this.cache.values();
  }

  /**
   * 遍历缓存
   * @param callback - 回调函数 (value, key) => void
   */
  forEach(callback: (value: T, key: string) => void): void {
    this.cache.forEach((value, key) => callback(value, key));
  }
}
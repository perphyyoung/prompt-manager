import { logger } from './Logger.ts';
/**
 * LocalStorage 管理器
 * 提供类型安全的 LocalStorage 访问 API
 * 集中管理所有 LocalStorage 配置项，避免重复代码
 */

/**
 * 配置项定义接口
 */
export interface ConfigItem<T> {
  key: string;
  defaultValue: T;
  parser?: (value: string) => T;
  serializer?: (value: T) => string;
  validator?: (value: T) => boolean;
}

/**
 * LocalStorage 管理器
 * 提供类型安全的 LocalStorage 访问 API
 */
export class LocalStorageManager {
  private configs: Map<string, ConfigItem<unknown>> = new Map();

  /**
   * 注册配置项
   */
  registerConfig<T>(config: ConfigItem<T>): void {
    this.configs.set(config.key, config as ConfigItem<unknown>);
  }

  /**
   * 批量注册配置项
   */
  registerConfigs<T>(configs: ConfigItem<T>[]): void {
    configs.forEach(config => this.registerConfig(config));
  }

  /**
   * 获取配置值
   * @param key - 配置键
   * @returns 配置值
   * @throws 如果配置未注册则抛出异常
   */
  get<T>(key: string): T {
    const config = this.configs.get(key);
    if (!config) {
      throw new Error(`Config not registered: ${key}`);
    }

    try {
      const stored = localStorage.getItem(key);
      if (stored === null) {
        return config.defaultValue as T;
      }

      const parsed: T = config.parser
        ? config.parser(stored) as T
        : stored as T;

      // 验证值
      if (config.validator && !config.validator(parsed)) {
        logger.warn('LocalStorageManager', `Invalid value for ${key}, using default`);
        return config.defaultValue as T;
      }

      return parsed;
    } catch (error) {
      logger.error('LocalStorageManager', `Failed to get config ${key}:`, error);
      return config.defaultValue as T;
    }
  }

  /**
   * 设置配置值
   * @param key - 配置键
   * @param value - 配置值
   * @throws 如果配置未注册或验证失败则抛出异常
   */
  set<T>(key: string, value: T): void {
    const config = this.configs.get(key);
    if (!config) {
      throw new Error(`Config not registered: ${key}`);
    }

    // 验证值
    if (config.validator && !config.validator(value)) {
      throw new Error(`Invalid value for ${key}`);
    }

    try {
      const serialized = config.serializer
        ? config.serializer(value)
        : String(value);

      localStorage.setItem(key, serialized);
    } catch (error) {
      logger.error('LocalStorageManager', `Failed to set config ${key}:`, error);
      throw error;
    }
  }

  /**
   * 重置配置为默认值
   * @param key - 配置键
   */
  reset(key: string): void {
    const config = this.configs.get(key);
    if (config) {
      this.set(key, config.defaultValue);
    }
  }

  /**
   * 重置所有配置
   */
  resetAll(): void {
    this.configs.forEach((_, key) => {
      this.reset(key);
    });
  }

  /**
   * 清除所有配置（删除所有 LocalStorage 项）
   */
  clearAll(): void {
    localStorage.clear();
  }
}

// 导出单例
export const localStorageManager = new LocalStorageManager();

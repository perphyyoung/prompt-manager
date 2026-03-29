import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 配置对象接口
 */
export interface AppConfig {
  rootDir: string;
  dataDir: string;
  [key: string]: unknown;
}

/**
 * 配置管理器
 * 负责应用配置的加载、保存和更新
 */
export class ConfigManager {
  private configPath: string;
  private defaultRootDir: string;
  private currentDataDir: string;

  /**
   * @param configPath - 配置文件路径
   * @param defaultRootDir - 默认根目录
   */
  constructor(configPath: string, defaultRootDir: string) {
    this.configPath = configPath;
    this.defaultRootDir = defaultRootDir;
    this.currentDataDir = path.resolve(defaultRootDir, './py-data');
  }

  /**
   * 获取配置文件路径
   * @returns 配置文件路径
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * 加载应用配置
   * @returns 解析后的配置对象
   */
  async loadConfig(): Promise<AppConfig> {
    const defaultConfig: AppConfig = {
      rootDir: this.defaultRootDir,
      dataDir: './py-data'
    };

    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      const config = JSON.parse(data) as Partial<AppConfig>;

      // 处理 rootDir
      let rootDir = defaultConfig.rootDir;
      if (config.rootDir) {
        rootDir = path.isAbsolute(config.rootDir)
          ? config.rootDir
          : path.resolve(path.dirname(this.configPath), config.rootDir);
      }

      // 处理 dataDir
      let dataDir = defaultConfig.dataDir;
      if (config.dataDir) {
        dataDir = path.isAbsolute(config.dataDir)
          ? config.dataDir
          : path.resolve(rootDir, config.dataDir);
      }

      this.currentDataDir = dataDir;

      // 返回完整配置（包含自定义字段）
      return {
        ...config,
        rootDir,
        dataDir
      } as AppConfig;
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      // 配置文件不存在或读取失败，创建默认配置
      if (error.code === 'ENOENT') {
        await this.saveConfig(defaultConfig);
      } else {
        throw err;
      }

      this.currentDataDir = path.resolve(defaultConfig.rootDir, defaultConfig.dataDir);
      return { ...defaultConfig, dataDir: this.currentDataDir };
    }
  }

  /**
   * 保存应用配置
   * @param config - 配置对象
   * @param merge - 是否合并现有配置，默认为 false
   */
  async saveConfig(config: Partial<AppConfig>, merge = false): Promise<void> {
    // 确保配置目录存在
    const configDir = path.dirname(this.configPath);
    try {
      await fs.access(configDir);
    } catch {
      await fs.mkdir(configDir, { recursive: true });
    }

    let configToSave = config;

    // 如果需要合并，先读取现有配置
    if (merge) {
      try {
        const existingData = await fs.readFile(this.configPath, 'utf8');
        const existingConfig = JSON.parse(existingData);
        configToSave = { ...existingConfig, ...config };
      } catch {
        // 读取失败，使用传入的配置
      }
    }

    await fs.writeFile(this.configPath, JSON.stringify(configToSave, null, 2), 'utf8');

    // 更新缓存的 dataDir
    if (config.dataDir) {
      this.currentDataDir = config.dataDir;
    }
  }

  /**
   * 更新数据目录
   * @param newDataDir - 新的数据目录路径
   * @returns 是否成功
   */
  async updateDataDir(newDataDir: string): Promise<boolean> {
    try {
      // 读取现有配置
      let existingConfig: Partial<AppConfig> = {};
      try {
        const data = await fs.readFile(this.configPath, 'utf8');
        existingConfig = JSON.parse(data);
      } catch {
        // 配置文件不存在或读取失败，使用空对象
      }

      // 合并更新
      await this.saveConfig({
        ...existingConfig,
        dataDir: newDataDir
      });

      this.currentDataDir = newDataDir;
      return true;
    } catch (error) {
      console.error('Failed to update data directory:', error);
      return false;
    }
  }

  /**
   * 获取当前数据目录
   * @returns 当前数据目录路径
   */
  getCurrentDataDir(): string {
    return this.currentDataDir;
  }
}

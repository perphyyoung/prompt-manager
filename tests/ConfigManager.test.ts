import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from '../src/main/ConfigManager';
import * as fs from 'fs/promises';
import * as path from 'path';

// 模拟 fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn()
}));

describe('ConfigManager', () => {
  const mockConfigPath = '/mock/config.json';
  const mockRootDir = '/mock/root';
  let configManager: ConfigManager;

  beforeEach(() => {
    vi.resetAllMocks();
    configManager = new ConfigManager(mockConfigPath, mockRootDir);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loadConfig', () => {
    it('should return default config when config file does not exist', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const config = await configManager.loadConfig();

      expect(config.rootDir).toBe(mockRootDir);
      expect(config.dataDir).toBe(path.resolve(mockRootDir, './py-data'));
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockConfigPath,
        expect.stringContaining('"rootDir"'),
        'utf8'
      );
    });

    it('should load existing config and resolve relative paths', async () => {
      const existingConfig = {
        rootDir: './custom-root',
        dataDir: './custom-data'
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingConfig));

      const config = await configManager.loadConfig();

      expect(config.rootDir).toBe(path.resolve(path.dirname(mockConfigPath), './custom-root'));
      expect(config.dataDir).toBe(path.resolve(path.dirname(mockConfigPath), './custom-root', './custom-data'));
    });

    it('should use absolute paths directly without resolving', async () => {
      const existingConfig = {
        rootDir: '/absolute/root',
        dataDir: '/absolute/data'
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingConfig));

      const config = await configManager.loadConfig();

      expect(config.rootDir).toBe('/absolute/root');
      expect(config.dataDir).toBe('/absolute/data');
    });

    it('should use default values when config fields are missing', async () => {
      const existingConfig = {};
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingConfig));

      const config = await configManager.loadConfig();

      expect(config.rootDir).toBe(mockRootDir);
      // 当配置文件中 dataDir 为空时，返回默认的相对路径
      expect(config.dataDir).toBe('./py-data');
    });

    it('should handle invalid JSON gracefully', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('invalid json');

      await expect(configManager.loadConfig()).rejects.toThrow();
    });
  });

  describe('saveConfig', () => {
    it('should save config to file', async () => {
      // 模拟目录不存在，需要创建
      vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const config = {
        rootDir: '/test/root',
        dataDir: '/test/data'
      };

      await configManager.saveConfig(config);

      expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(mockConfigPath), { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockConfigPath,
        JSON.stringify(config, null, 2),
        'utf8'
      );
    });

    it('should create directory if it does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const config = { rootDir: '/test', dataDir: './data' };
      await configManager.saveConfig(config);

      expect(fs.mkdir).toHaveBeenCalled();
    });

    it('should merge with existing config when merge option is true', async () => {
      const existingConfig = {
        rootDir: '/existing/root',
        dataDir: '/existing/data',
        customField: 'custom-value'
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingConfig));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await configManager.saveConfig({ dataDir: '/new/data' }, true);

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenContent = writeCall[1] as string;
      const parsed = JSON.parse(writtenContent);

      expect(parsed.rootDir).toBe('/existing/root');
      expect(parsed.customField).toBe('custom-value');
      expect(parsed.dataDir).toBe('/new/data');
    });

    it('should overwrite existing config when merge option is false', async () => {
      const existingConfig = {
        rootDir: '/existing/root',
        dataDir: '/existing/data',
        customField: 'custom-value'
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingConfig));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await configManager.saveConfig({ dataDir: '/new/data' }, false);

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenContent = writeCall[1] as string;
      const parsed = JSON.parse(writtenContent);

      expect(parsed).not.toHaveProperty('rootDir');
      expect(parsed).not.toHaveProperty('customField');
      expect(parsed.dataDir).toBe('/new/data');
    });
  });

  describe('updateDataDir', () => {
    it('should update dataDir while preserving rootDir', async () => {
      const existingConfig = {
        rootDir: '/existing/root',
        dataDir: '/existing/data'
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingConfig));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await configManager.updateDataDir('/new/data');

      expect(result).toBe(true);
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenContent = writeCall[1] as string;
      const parsed = JSON.parse(writtenContent);

      expect(parsed.rootDir).toBe('/existing/root');
      expect(parsed.dataDir).toBe('/new/data');
    });

    it('should handle missing config file gracefully', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await configManager.updateDataDir('/new/data');

      expect(result).toBe(true);
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenContent = writeCall[1] as string;
      const parsed = JSON.parse(writtenContent);

      // 当配置文件不存在时，只保存 dataDir
      expect(parsed.dataDir).toBe('/new/data');
    });
  });

  describe('getCurrentDataDir', () => {
    it('should return cached dataDir after loading', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
        rootDir: '/test',
        dataDir: '/test/data'
      }));

      await configManager.loadConfig();
      const dataDir = configManager.getCurrentDataDir();

      expect(dataDir).toBe('/test/data');
    });

    it('should return default dataDir before loading', () => {
      const dataDir = configManager.getCurrentDataDir();
      expect(dataDir).toBe(path.resolve(mockRootDir, './py-data'));
    });
  });

  describe('config file path handling', () => {
    it('should handle production environment paths', () => {
      const prodConfigPath = 'C:\\Program Files\\PromptManager\\config.json';
      const prodRootDir = 'C:\\Program Files\\PromptManager';
      const manager = new ConfigManager(prodConfigPath, prodRootDir);

      expect(manager.getConfigPath()).toBe(prodConfigPath);
    });

    it('should handle development environment paths', () => {
      const devConfigPath = '/project/config.json';
      const devRootDir = '/project';
      const manager = new ConfigManager(devConfigPath, devRootDir);

      expect(manager.getConfigPath()).toBe(devConfigPath);
    });
  });
});

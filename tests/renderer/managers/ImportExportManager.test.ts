/**
 * ImportExportManager 测试
 * 测试导入导出功能的完整备份和恢复
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImportExportManager } from '../../../src/renderer/managers/ImportExportManager';
import { progressDialog } from '../../../src/renderer/components/ProgressDialog';

// 模拟 PromptManager
const createMockApp = () => ({
  showToast: vi.fn(),
});

// 模拟 electronAPI
const mockExportFullBackup = vi.fn();
const mockImportFullBackup = vi.fn();
const mockLogError = vi.fn();
const mockRelaunchApp = vi.fn();
const mockOnBackupProgress = vi.fn();
const mockOffBackupProgress = vi.fn();

// 模拟 ProgressDialog 模块
vi.mock('../../../src/renderer/components/ProgressDialog', () => ({
  progressDialog: {
    show: vi.fn(),
    hide: vi.fn(),
    updateProgress: vi.fn(),
    complete: vi.fn(),
    error: vi.fn(),
  },
}));

beforeEach(() => {
  // 重置所有 mock
  vi.clearAllMocks();

  // 设置全局 electronAPI
  (global as any).window = {
    electronAPI: {
      exportFullBackup: mockExportFullBackup,
      importFullBackup: mockImportFullBackup,
      logError: mockLogError,
      relaunchApp: mockRelaunchApp,
      onBackupProgress: mockOnBackupProgress,
      offBackupProgress: mockOffBackupProgress,
    },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ImportExportManager', () => {
  describe('exportFullBackup', () => {
    it('应该成功导出完整备份', async () => {
      const mockApp = createMockApp();
      const manager = new ImportExportManager({ app: mockApp as any });

      const mockStats = {
        database: true,
        prompts: { count: 20 },
        images: { count: 10, size: 1024 * 1024 },
        thumbnails: { count: 10, size: 512 * 1024 },
        fonts: { count: 2, size: 1024 * 1024 },
        settings: true,
      };

      mockExportFullBackup.mockResolvedValue({
        success: true,
        filePath: 'D:/backup/prompt-manager-backup-20260327.zip',
        stats: mockStats,
      });

      const result = await manager.exportFullBackup();

      expect(result).toBe(true);
      expect(mockExportFullBackup).toHaveBeenCalledTimes(1);
      expect(progressDialog.show).toHaveBeenCalledWith({
        title: '正在创建备份...',
        status: '准备中...',
        onCancel: expect.any(Function),
      });
      expect(mockOnBackupProgress).toHaveBeenCalled();
      expect(progressDialog.complete).toHaveBeenCalledWith(
        expect.stringContaining('备份成功')
      );
      // 验证导出成功后不自动重启
      expect(mockRelaunchApp).not.toHaveBeenCalled();
    });

    it('应该处理用户取消导出', async () => {
      const mockApp = createMockApp();
      const manager = new ImportExportManager({ app: mockApp as any });

      mockExportFullBackup.mockResolvedValue({ cancelled: true });

      const result = await manager.exportFullBackup();

      expect(result).toBe(false);
      expect(progressDialog.hide).toHaveBeenCalled();
      expect(progressDialog.complete).not.toHaveBeenCalled();
    });

    it('应该处理导出失败', async () => {
      const mockApp = createMockApp();
      const manager = new ImportExportManager({ app: mockApp as any });

      mockExportFullBackup.mockRejectedValue(new Error('磁盘空间不足'));

      const result = await manager.exportFullBackup();

      expect(result).toBe(false);
      expect(progressDialog.error).toHaveBeenCalledWith(
        '备份失败：磁盘空间不足'
      );
      expect(mockLogError).toHaveBeenCalled();
      expect(mockOffBackupProgress).toHaveBeenCalled();
    });

    it('应该防止重复导出', async () => {
      const mockApp = createMockApp();
      const manager = new ImportExportManager({ app: mockApp as any });

      // 手动设置 isExporting 为 true 来模拟正在导出的状态
      (manager as any).isExporting = true;

      // 第二次调用应该被拒绝
      const result = await manager.exportFullBackup();

      expect(result).toBe(false);
      expect(mockApp.showToast).toHaveBeenCalledWith(
        '备份正在进行中，请稍候',
        'warning'
      );
      expect(mockExportFullBackup).not.toHaveBeenCalled();
    });
  });

  describe('importFullBackup', () => {
    it('应该成功导入完整备份', async () => {
      const mockApp = createMockApp();
      const manager = new ImportExportManager({ app: mockApp as any });

      const mockManifest = {
        version: '1.0.0',
        appName: 'prompt-manager',
        appVersion: '1.0.0',
        exportedAt: '2026-03-27T10:00:00.000Z',
        dataVersion: 1,
        contents: {
          database: true,
          images: { count: 10, size: 1024 * 1024 },
          thumbnails: { count: 10, size: 512 * 1024 },
          fonts: { count: 2, size: 1024 * 1024 },
          settings: true,
        },
      };

      mockImportFullBackup.mockResolvedValue({
        success: true,
        manifest: mockManifest,
        oldDataDir: 'D:/data/py-data_20260327-143022',
      });

      const result = await manager.importFullBackup();

      expect(result).toBe(true);
      expect(mockImportFullBackup).toHaveBeenCalledTimes(1);
      expect(progressDialog.show).toHaveBeenCalledWith({
        title: '正在导入备份...',
        status: '准备中...',
        onCancel: expect.any(Function),
        onComplete: expect.any(Function),
      });
      expect(mockOnBackupProgress).toHaveBeenCalled();
      expect(progressDialog.complete).toHaveBeenCalledWith(
        expect.stringContaining('导入成功')
      );

      // 验证重启应用尚未被调用（需要用户点击关闭按钮触发 onComplete）
      expect(mockRelaunchApp).not.toHaveBeenCalled();

      // 模拟用户点击关闭按钮，触发 onComplete 回调
      const showCall = (progressDialog.show as any).mock.calls[0];
      const onCompleteCallback = showCall[0].onComplete;
      onCompleteCallback();

      // 验证重启应用被调用
      expect(mockRelaunchApp).toHaveBeenCalledTimes(1);
    });

    it('应该处理用户取消导入', async () => {
      const mockApp = createMockApp();
      const manager = new ImportExportManager({ app: mockApp as any });

      mockImportFullBackup.mockResolvedValue({ cancelled: true });

      const result = await manager.importFullBackup();

      expect(result).toBe(false);
      expect(progressDialog.hide).toHaveBeenCalled();
      expect(progressDialog.complete).not.toHaveBeenCalled();
    });

    it('应该处理导入失败', async () => {
      const mockApp = createMockApp();
      const manager = new ImportExportManager({ app: mockApp as any });

      mockImportFullBackup.mockRejectedValue(new Error('备份文件损坏'));

      const result = await manager.importFullBackup();

      expect(result).toBe(false);
      expect(progressDialog.error).toHaveBeenCalledWith(
        '导入失败：备份文件损坏'
      );
      expect(mockLogError).toHaveBeenCalled();
      expect(mockOffBackupProgress).toHaveBeenCalled();
    });

    it('应该防止重复导入', async () => {
      const mockApp = createMockApp();
      const manager = new ImportExportManager({ app: mockApp as any });

      // 手动设置 isExporting 为 true 来模拟正在导入的状态
      (manager as any).isExporting = true;

      // 第二次调用应该被拒绝
      const result = await manager.importFullBackup();

      expect(result).toBe(false);
      expect(mockApp.showToast).toHaveBeenCalledWith(
        '操作正在进行中，请稍候',
        'warning'
      );
      expect(mockImportFullBackup).not.toHaveBeenCalled();
    });

    it('应该处理版本不兼容错误', async () => {
      const mockApp = createMockApp();
      const manager = new ImportExportManager({ app: mockApp as any });

      mockImportFullBackup.mockRejectedValue(
        new Error('版本不兼容：备份版本 2.0.0，当前版本 1.0.0')
      );

      const result = await manager.importFullBackup();

      expect(result).toBe(false);
      expect(progressDialog.error).toHaveBeenCalledWith(
        '导入失败：版本不兼容：备份版本 2.0.0，当前版本 1.0.0'
      );
      expect(mockLogError).toHaveBeenCalled();
    });
  });

  describe('getIsExporting', () => {
    it('应该返回正确的导出状态', async () => {
      const mockApp = createMockApp();
      const manager = new ImportExportManager({ app: mockApp as any });

      expect(manager.getIsExporting()).toBe(false);

      // 开始导出
      mockExportFullBackup.mockImplementation(() => new Promise(() => {}));
      manager.exportFullBackup();

      expect(manager.getIsExporting()).toBe(true);
    });
  });
});

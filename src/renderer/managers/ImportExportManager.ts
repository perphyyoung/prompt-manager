/**
 * 导入导出管理器
 * 负责处理数据导出功能
 */

import type { IApp } from '../app.types.ts';
import type { IScanOrphanFilesResult, IExportOrphanFilesResult } from '../../types/entities.ts';
import { progressDialog } from '../components/ProgressDialog.ts';
import { ErrorHandler } from '../renderer_utils/index.ts';

interface ImportExportManagerOptions {
  app: IApp;
}

export class ImportExportManager {
  private app: IApp;
  private isExporting: boolean = false;
  private isInitialized = false;

  constructor(options: ImportExportManagerOptions) {
    this.app = options.app;
  }

  /**
   * 初始化
   */
  init(): void {
    if (this.isInitialized) {
      return;
    }
    // 初始化时无需特殊操作
    this.isInitialized = true;
  }

  /**
   * 导出孤儿文件
   * @returns 是否成功
   */
  async exportOrphanFiles(): Promise<boolean> {
    if (this.isExporting) {
      this.app.showToast?.('导出正在进行中，请稍候', 'warning');
      return false;
    }

    this.isExporting = true;

    try {
      // 先扫描孤儿文件
      this.app.showToast?.('正在扫描孤儿文件...', 'info');
      const scanResult: IScanOrphanFilesResult = await window.electronAPI.scanOrphanFiles();

      if (scanResult.totalCount === 0) {
        this.app.showToast?.('没有发现孤儿文件', 'info');
        return false;
      }

      // 有孤儿文件时再选择导出目录
      const exportDir = await window.electronAPI.selectDirectory();
      if (!exportDir) {
        return false;
      }

      this.app.showToast?.(`发现 ${scanResult.totalCount} 个孤儿文件，正在导出...`, 'info');

      const result: IExportOrphanFilesResult = await window.electronAPI.exportOrphanFiles(exportDir);

      if (result.successCount > 0) {
        this.app.showToast?.(`成功导出 ${result.successCount} 个孤儿文件`, 'success');
        return true;
      } else if (result.failedCount > 0) {
        throw new Error(`${result.failedCount} 个文件导出失败`);
      } else {
        throw new Error('导出失败');
      }
    } catch (error) {
      ErrorHandler.handleError(
        { module: 'ImportExportManager.ts', operation: 'export orphan files' },
        error,
        { userMessage: '导出失败' }
      );
      return false;
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * 获取导出状态
   */
  getIsExporting(): boolean {
    return this.isExporting;
  }

  /**
   * 导出完整备份
   * @returns 是否成功
   */
  async exportFullBackup(): Promise<boolean> {
    if (this.isExporting) {
      this.app.showToast?.('备份正在进行中，请稍候', 'warning');
      return false;
    }

    this.isExporting = true;

    // 设置进度回调
    const handleProgress = (progress: { stage: string; percent: number; status: string; detail?: string }) => {
      progressDialog.updateProgress(progress.percent, progress.status, progress.detail);
    };

    try {
      // 显示进度对话框
      progressDialog.show({
        title: '正在创建备份...',
        status: '准备中...',
        onCancel: () => {
          // 取消操作（当前版本不支持中断，仅关闭对话框）
          progressDialog.hide();
        }
      });

      // 监听进度更新
      window.electronAPI.onBackupProgress(handleProgress);

      const result = await window.electronAPI.exportFullBackup();

      // 移除进度监听
      window.electronAPI.offBackupProgress(handleProgress);

      if ('cancelled' in result && result.cancelled) {
        progressDialog.hide();
        return false;
      }

      if ('success' in result && result.success) {
        const stats = result.stats;
        const promptsCount = stats.prompts.count;
        const imageCount = stats.images.count;

        progressDialog.complete(`备份成功！包含 ${promptsCount} 个提示词，${imageCount} 个图像\n保存位置：${result.filePath}`);

        // 等待用户点击关闭按钮，不自动关闭
        return true;
      }

      throw new Error('备份失败');
    } catch (error) {
      // 移除进度监听
      window.electronAPI.offBackupProgress(handleProgress);

      const errorMessage = error instanceof Error ? error.message : String(error);
      window.electronAPI.logError('ImportExportManager.ts', 'Failed to export full backup:', error);

      progressDialog.error('备份失败：' + errorMessage);

      return false;
    } finally {
      this.isExporting = false;
    }
  }

  /**
   * 导入完整备份
   * @returns 是否成功
   */
  async importFullBackup(): Promise<boolean> {
    if (this.isExporting) {
      this.app.showToast?.('操作正在进行中，请稍候', 'warning');
      return false;
    }

    this.isExporting = true;

    // 设置进度回调
    const handleProgress = (progress: { stage: string; percent: number; status: string; detail?: string }) => {
      progressDialog.updateProgress(progress.percent, progress.status, progress.detail);
    };

    try {
      // 显示进度对话框
      progressDialog.show({
        title: '正在导入备份...',
        status: '准备中...',
        onCancel: () => {
          // 取消操作（当前版本不支持中断，仅关闭对话框）
          progressDialog.hide();
        },
        onComplete: () => {
          // 用户点击关闭按钮后重启应用
          window.electronAPI.relaunchApp();
        }
      });

      // 监听进度更新
      window.electronAPI.onBackupProgress(handleProgress);

      const result = await window.electronAPI.importFullBackup();

      // 移除进度监听
      window.electronAPI.offBackupProgress(handleProgress);

      if ('cancelled' in result && result.cancelled) {
        progressDialog.hide();
        return false;
      }

      if ('success' in result && result.success) {
        const manifest = result.manifest;
        const exportedAt = manifest.exportedAt;

        progressDialog.complete(`导入成功！备份时间：${exportedAt}\n点击关闭按钮后将重启应用`);

        // 等待用户点击关闭按钮后再重启应用
        // 通过 onComplete 回调实现
        return true;
      }

      throw new Error('导入失败');
    } catch (error) {
      // 移除进度监听
      window.electronAPI.offBackupProgress(handleProgress);

      const errorMessage = error instanceof Error ? error.message : String(error);
      window.electronAPI.logError('ImportExportManager.ts', 'Failed to import full backup:', error);

      progressDialog.error('导入失败：' + errorMessage);

      return false;
    } finally {
      this.isExporting = false;
    }
  }
}

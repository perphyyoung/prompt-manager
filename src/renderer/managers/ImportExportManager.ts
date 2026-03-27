/**
 * 导入导出管理器
 * 负责处理数据导出功能
 */

import type PromptManager from '../app';

interface ExportOrphanFilesResult {
  successCount: number;
  failedCount: number;
  exportPath: string;
}

interface ScanOrphanFilesResult {
  totalCount: number;
  files: Array<{
    fullPath: string;
    relativePath: string;
  }>;
}

interface ImportExportManagerOptions {
  app: PromptManager;
}

export class ImportExportManager {
  private app: PromptManager;
  private isExporting: boolean = false;

  constructor(options: ImportExportManagerOptions) {
    this.app = options.app;
  }

  /**
   * 初始化
   */
  init(): void {
    // 初始化时无需特殊操作
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
      const scanResult: ScanOrphanFilesResult = await window.electronAPI.scanOrphanFiles();

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

      const result: ExportOrphanFilesResult = await window.electronAPI.exportOrphanFiles(exportDir);

      if (result.successCount > 0) {
        this.app.showToast?.(`成功导出 ${result.successCount} 个孤儿文件`, 'success');
        return true;
      } else if (result.failedCount > 0) {
        throw new Error(`${result.failedCount} 个文件导出失败`);
      } else {
        throw new Error('导出失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      window.electronAPI.logError('ImportExportManager.ts', 'Failed to export orphan files:', error);
      this.app.showToast?.('导出失败：' + errorMessage, 'error');
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
}

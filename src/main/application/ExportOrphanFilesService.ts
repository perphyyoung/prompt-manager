/**
 * 导出孤儿文件用例服务
 * 编排:扫描孤儿文件 → 建导出目录 → 原图像逐个"复制到导出目录后删除源文件"(单文件失败不中断) → 缩略图直接删除。
 * 计数语义(保持与提取前一致):exportCount 在复制成功后自增,后续删除失败计入 failedCount;
 * 职责边界:错误翻译(日志)留在路由;单文件失败计入 failedCount 属于用例语义,留在本服务。
 */

import path from "path";
import type { IScanOrphanFilesResult } from "../../types/entities.js";
import { logError } from "../mainLogger.js";

export interface ExportOrphanFilesDeps {
  /** 扫描孤儿文件(infrastructure:数据库路径与磁盘文件比对) */
  scanOrphanFiles: () => Promise<IScanOrphanFilesResult>;
  /** 导出子目录时间戳(Date.now 注入以便断言) */
  timestamp: () => number;
  /** 文件系统聚合端口,由 infrastructure 既有函数装配 */
  fs: {
    /** 递归创建目录 */
    mkdir: (dir: string) => Promise<void>;
    copyFile: (src: string, dst: string) => Promise<void>;
    unlink: (filePath: string) => Promise<void>;
  };
}

export interface ExportOrphanFilesResult {
  successCount: number;
  failedCount: number;
  exportCount: number;
  deletedCount: number;
  exportPath: string;
}

export class ExportOrphanFilesService {
  constructor(private readonly deps: ExportOrphanFilesDeps) {}

  async execute(exportDir: string): Promise<ExportOrphanFilesResult> {
    // 先扫描孤儿文件
    const scanResult = await this.deps.scanOrphanFiles();

    if (scanResult.totalCount === 0) {
      return { successCount: 0, failedCount: 0, exportCount: 0, deletedCount: 0, exportPath: "" };
    }

    // 创建导出目录
    const orphanExportDir = path.join(exportDir, `orphan_files_${this.deps.timestamp()}`);
    await this.deps.fs.mkdir(orphanExportDir);

    let exportCount = 0;
    let deletedCount = 0;
    let failedCount = 0;
    let imageSuccessCount = 0;
    let thumbnailSuccessCount = 0;

    // 1. 导出原图像，导出成功后删除源文件
    for (const file of scanResult.orphanImages) {
      try {
        const fileName = path.basename(file.fullPath);
        const targetPath = path.join(orphanExportDir, fileName);
        await this.deps.fs.copyFile(file.fullPath, targetPath);
        exportCount++;

        await this.deps.fs.unlink(file.fullPath);
        deletedCount++;
        imageSuccessCount++;
      } catch (error) {
        logError("Main", "Failed to export and delete orphan image:", {
          fullPath: file.fullPath,
          error,
        });
        failedCount++;
      }
    }

    // 2. 缩略图直接删除，不导出
    for (const file of scanResult.orphanThumbnails) {
      try {
        await this.deps.fs.unlink(file.fullPath);
        deletedCount++;
        thumbnailSuccessCount++;
      } catch (error) {
        logError("Main", "Failed to delete orphan thumbnail:", { fullPath: file.fullPath, error });
        failedCount++;
      }
    }

    return {
      successCount: imageSuccessCount + thumbnailSuccessCount,
      failedCount,
      exportCount,
      deletedCount,
      exportPath: orphanExportDir,
    };
  }
}

/**
 * 备份与维护域 IPC 路由
 * 完整备份导出/导入、孤儿文件扫描与导出。
 * 从 main/index.ts 原样迁出，逻辑未改动。
 */

import path from "path";
import { promises as fs } from "fs";
import { ipcMain, dialog } from "electron";
import * as db from "../../database.js";
import { getFormattedLocalTimeToSecond } from "../../../utils/index.js";
import { copyDirectoryWithProgress } from "../../../utils/FileUtils.js";
import { logError } from "../../mainLogger.js";
import { getCurrentDataDir, getMainWindow } from "../../runtime.js";
import { regenerateAllThumbnails } from "../../infrastructure/imageFiles.js";
import {
  buildBackupManifest,
  createTempDir,
  createZipArchive,
  extractZipArchive,
  getBackupStats,
  removeDirectory,
  scanOrphanFilesInternal,
  sendBackupProgress,
} from "../../infrastructure/backup.js";
import { handleTyped } from "./handleTyped.js";

export function registerBackupIpc() {
  // 扫描孤儿文件
  handleTyped("scanOrphanFiles", async () => {
    try {
      return await scanOrphanFilesInternal();
    } catch (error) {
      logError("Main", "Scan orphan files error:", error);
      throw error;
    }
  });

  // 导出并删除孤儿文件：原图像导出后删除，缩略图直接删除
  handleTyped("exportOrphanFiles", async (event, exportDir) => {
    try {
      // 先扫描孤儿文件
      const scanResult = await scanOrphanFilesInternal();

      if (scanResult.totalCount === 0) {
        return { successCount: 0, failedCount: 0, exportCount: 0, deletedCount: 0, exportPath: "" };
      }

      // 创建导出目录
      const orphanExportDir = path.join(exportDir, `orphan_files_${Date.now()}`);
      await fs.mkdir(orphanExportDir, { recursive: true });

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
          await fs.copyFile(file.fullPath, targetPath);
          exportCount++;

          await fs.unlink(file.fullPath);
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
          await fs.unlink(file.fullPath);
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
    } catch (error) {
      logError("Main", "Export orphan files error:", error);
      throw error;
    }
  });

  // 完整备份导出
  handleTyped("exportFullBackup", async () => {
    try {
      const mainWindow = getMainWindow();
      if (!mainWindow) throw new Error("Main window is not available");

      // 选择保存目录（先让用户选择目录）
      const { filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: "选择备份保存位置",
        properties: ["openDirectory"],
        buttonLabel: "保存备份",
      });

      if (!filePaths || filePaths.length === 0) {
        return { cancelled: true };
      }

      const exportDir = filePaths[0];

      // 发送开始进度
      sendBackupProgress({
        stage: "start",
        percent: 0,
        status: "准备中...",
        detail: "正在统计文件...",
      });

      // 在实际开始备份时生成文件名（确保时间戳准确）
      const timestamp = getFormattedLocalTimeToSecond().replace(/[:\s]/g, "-");
      const fileName = `prompt-manager-backup-${timestamp}.zip`;
      const filePath = path.join(exportDir, fileName);

      // 创建临时目录
      const tempDir = await createTempDir("prompt-manager-backup");

      try {
        // 1. 生成 manifest.json (5%)
        sendBackupProgress({
          stage: "manifest",
          percent: 5,
          status: "正在生成备份清单...",
        });

        const stats = await getBackupStats();
        const manifest = buildBackupManifest(stats);
        await fs.writeFile(
          path.join(tempDir, "manifest.json"),
          JSON.stringify(manifest, null, 2),
          "utf8",
        );

        // 2. 复制数据库 (5% -> 15%)
        sendBackupProgress({
          stage: "database",
          percent: 15,
          status: "正在复制数据库...",
        });

        const dbDir = path.join(tempDir, "database");
        await fs.mkdir(dbDir, { recursive: true });
        const dbSource = path.join(getCurrentDataDir(), "prompt-manager.db");
        const dbTarget = path.join(dbDir, "prompt-manager.db");
        await fs.copyFile(dbSource, dbTarget);

        // 3. 复制图像文件 (15% -> 80%)
        const imagesSource = path.join(getCurrentDataDir(), "images");
        const imagesTarget = path.join(tempDir, "files", "images");

        sendBackupProgress({
          stage: "images",
          percent: 15,
          status: "正在复制图像文件...",
          detail: `共 ${stats.images.count} 个文件`,
        });

        await copyDirectoryWithProgress(imagesSource, imagesTarget, {
          onProgress: (copiedCount, totalCount, fileName) => {
            const percent = 15 + (copiedCount / totalCount) * 65;
            sendBackupProgress({
              stage: "images",
              percent: Math.round(percent),
              status: `正在复制图像文件... (${copiedCount}/${totalCount})`,
              detail: fileName,
            });
          },
        });

        // 注意：缩略图、字体和设置不导出

        // 4. 压缩为 ZIP (80% -> 100%)
        sendBackupProgress({
          stage: "compress",
          percent: 80,
          status: "正在压缩备份文件...",
        });

        await createZipArchive(tempDir, filePath);

        // 完成
        sendBackupProgress({
          stage: "complete",
          percent: 100,
          status: "备份完成！",
        });

        return {
          success: true,
          filePath,
          stats,
        };
      } finally {
        // 清理临时目录
        await removeDirectory(tempDir);
      }
    } catch (error) {
      logError("Main", "Export full backup error:", error);
      sendBackupProgress({
        stage: "error",
        percent: 0,
        status: "备份失败",
        detail: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });

  // 完整备份导入
  handleTyped("importFullBackup", async () => {
    try {
      const mainWindow = getMainWindow();
      if (!mainWindow) throw new Error("Main window is not available");

      // 选择备份文件
      const { filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: "导入完整备份",
        filters: [{ name: "ZIP Files", extensions: ["zip"] }],
        properties: ["openFile"],
      });

      if (!filePaths || filePaths.length === 0) {
        return { cancelled: true };
      }

      const zipPath = filePaths[0];

      // 发送开始进度
      sendBackupProgress({
        stage: "start",
        percent: 0,
        status: "准备导入...",
        detail: "正在准备导入环境...",
      });

      // 解压到临时目录
      const tempDir = await createTempDir("prompt-manager-restore");

      try {
        // 1. 解压 ZIP (0% -> 20%)
        sendBackupProgress({
          stage: "compress",
          percent: 5,
          status: "正在解压备份文件...",
        });

        await extractZipArchive(zipPath, tempDir);

        // 2. 验证 manifest (20% -> 25%)
        sendBackupProgress({
          stage: "manifest",
          percent: 20,
          status: "正在验证备份文件...",
        });

        const manifestPath = path.join(tempDir, "manifest.json");
        let manifest;
        try {
          const manifestContent = await fs.readFile(manifestPath, "utf8");
          manifest = JSON.parse(manifestContent);
        } catch {
          throw new Error("无效的备份文件：缺少 manifest.json");
        }

        // 3. 版本兼容性检查 (25% -> 30%)
        sendBackupProgress({
          stage: "manifest",
          percent: 25,
          status: "正在检查版本兼容性...",
        });

        // 使用 dataVersion 进行数据格式兼容性检查
        const backupDataVersion = manifest.dataVersion || 1;
        const currentDataVersion = 1; // 当前支持的数据格式版本

        if (backupDataVersion !== currentDataVersion) {
          throw new Error(
            `数据格式版本不兼容：备份数据版本 ${backupDataVersion}，当前支持版本 ${currentDataVersion}`,
          );
        }

        // 4. 备份当前数据 (30% -> 40%)
        sendBackupProgress({
          stage: "database",
          percent: 30,
          status: "正在备份当前数据...",
        });

        const dataDir = getCurrentDataDir();

        // 关闭数据库连接以释放文件锁
        await db.closeDatabase();

        const timestamp = getFormattedLocalTimeToSecond().replace(/[:\s]/g, "-");
        const backupDir = `${dataDir}_${timestamp}`;
        await fs.rename(dataDir, backupDir);

        try {
          // 5. 恢复数据
          await fs.mkdir(dataDir, { recursive: true });

          // 恢复数据库 (40% -> 50%)
          sendBackupProgress({
            stage: "database",
            percent: 40,
            status: "正在恢复数据库...",
          });

          const dbSource = path.join(tempDir, "database", "prompt-manager.db");
          const dbTarget = path.join(dataDir, "prompt-manager.db");
          await fs.copyFile(dbSource, dbTarget);

          // 重新初始化数据库连接
          await db.initDatabase(dataDir);

          // 恢复图像 (50% -> 80%)
          const imagesSource = path.join(tempDir, "files", "images");
          const imagesTarget = path.join(dataDir, "images");
          const imageStats = manifest.contents?.images || { count: 0 };

          sendBackupProgress({
            stage: "images",
            percent: 50,
            status: "正在恢复图像文件...",
            detail: `共 ${imageStats.count} 个文件`,
          });

          await copyDirectoryWithProgress(imagesSource, imagesTarget, {
            onProgress: (copiedCount, totalCount, fileName) => {
              const percent = 50 + (copiedCount / totalCount) * 40;
              sendBackupProgress({
                stage: "images",
                percent: Math.round(percent),
                status: `正在恢复图像文件... (${copiedCount}/${totalCount})`,
                detail: fileName,
              });
            },
          });

          // 重新生成缩略图 (90% -> 100%)
          sendBackupProgress({
            stage: "thumbnails",
            percent: 90,
            status: "正在重新生成缩略图...",
          });

          await regenerateAllThumbnails((current, total, fileName) => {
            const percent = 90 + (current / total) * 10;
            sendBackupProgress({
              stage: "thumbnails",
              percent: Math.round(percent),
              status: "正在重新生成缩略图...",
              detail: `${current}/${total} ${fileName || ""}`,
            });
          });

          // 完成
          sendBackupProgress({
            stage: "complete",
            percent: 100,
            status: "导入完成！",
          });

          return {
            success: true,
            manifest,
            oldDataDir: backupDir,
          };
        } catch (error) {
          // 恢复失败，尝试回滚
          logError("Main", "Restore failed, attempting rollback:", error);
          sendBackupProgress({
            stage: "error",
            percent: 0,
            status: "导入失败，正在回滚...",
            detail: "正在恢复到原数据...",
          });
          await removeDirectory(dataDir);
          await fs.rename(backupDir, dataDir);
          throw new Error("导入失败，已自动回滚到原数据");
        }
      } finally {
        // 清理临时目录
        await removeDirectory(tempDir);
      }
    } catch (error) {
      logError("Main", "Import full backup error:", error);
      sendBackupProgress({
        stage: "error",
        percent: 0,
        status: "导入失败",
        detail: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });
}

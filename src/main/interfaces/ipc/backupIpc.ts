/**
 * 备份与维护域 IPC 路由
 * 完整备份导出/导入、孤儿文件扫描与导出。
 * 从 main/index.ts 原样迁出，逻辑未改动。
 */

import { promises as fs } from "fs";
import { dialog } from "electron";
import * as db from "../../database.js";
import { getFormattedLocalTimeToSecond } from "../../../utils/index.js";
import { copyDirectoryWithProgress } from "../../../utils/FileUtils.js";
import { logError } from "../../mainLogger.js";
import { getCurrentDataDir, getMainWindow } from "../../runtime.js";
import { regenerateAllThumbnails } from "../../infrastructure/imageFiles.js";
import {
  createTempDir,
  createZipArchive,
  extractZipArchive,
  getBackupStats,
  removeDirectory,
  scanOrphanFilesInternal,
  sendBackupProgress,
} from "../../infrastructure/backup.js";
import { ExportFullBackupService } from "../../application/ExportFullBackupService.js";
import { ExportOrphanFilesService } from "../../application/ExportOrphanFilesService.js";
import { ImportFullBackupService } from "../../application/ImportFullBackupService.js";
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
    // 依赖装配:错误翻译留在路由,计数语义(单文件失败不中断)在 application 层
    const service = new ExportOrphanFilesService({
      scanOrphanFiles: scanOrphanFilesInternal,
      timestamp: () => Date.now(),
      fs: {
        mkdir: async (dir) => {
          await fs.mkdir(dir, { recursive: true });
        },
        copyFile: (src, dst) => fs.copyFile(src, dst),
        unlink: (filePath) => fs.unlink(filePath),
      },
    });

    try {
      return await service.execute(exportDir);
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

      // 依赖装配:目录选择与错误翻译留在路由,编排进 application 层
      const service = new ExportFullBackupService({
        getDataDir: getCurrentDataDir,
        getBackupStats,
        onProgress: sendBackupProgress,
        timestamp: () => getFormattedLocalTimeToSecond().replace(/[:\s]/g, "-"),
        createZip: createZipArchive,
        fs: {
          writeFile: (filePath, content) => fs.writeFile(filePath, content, "utf8"),
          mkdir: async (dir) => {
            await fs.mkdir(dir, { recursive: true });
          },
          copyFile: (src, dst) => fs.copyFile(src, dst),
          copyDirWithProgress: async (src, dst, onFile) => {
            await copyDirectoryWithProgress(src, dst, { onProgress: onFile });
          },
          createTempDir: createTempDir,
          removeDir: removeDirectory,
        },
      });

      return await service.execute(filePaths[0]);
    } catch (error) {
      // 错误翻译:日志 + error 进度(边界层职责)
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

      // 依赖装配:文件选择与错误翻译留在路由,编排进 application 层
      const service = new ImportFullBackupService({
        closeDatabase: () => db.closeDatabase(),
        initDatabase: (dataDir) => db.initDatabase(dataDir),
        getDataDir: getCurrentDataDir,
        onProgress: sendBackupProgress,
        timestamp: () => getFormattedLocalTimeToSecond().replace(/[:\s]/g, "-"),
        regenerateThumbnails: regenerateAllThumbnails,
        fs: {
          extractZip: extractZipArchive,
          copyFile: (src, dst) => fs.copyFile(src, dst),
          rename: (from, to) => fs.rename(from, to),
          mkdir: async (dir) => {
            await fs.mkdir(dir, { recursive: true });
          },
          readFile: async (filePath) => (await fs.readFile(filePath, "utf8")) as string,
          copyDirWithProgress: async (src, dst, onFile) => {
            await copyDirectoryWithProgress(src, dst, { onProgress: onFile });
          },
          removeDir: removeDirectory,
          createTempDir: createTempDir,
        },
      });

      return await service.execute(filePaths[0]);
    } catch (error) {
      // 错误翻译:日志 + error 进度(边界层职责)
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

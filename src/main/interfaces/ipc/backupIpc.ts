/**
 * 备份与维护域 IPC 路由
 * 职责仅剩边界翻译:文件对话框、错误日志与 error 进度;用例装配见 application/index.ts。
 */

import { dialog } from "electron";
import { logError } from "../../mainLogger.js";
import { getMainWindow } from "../../runtime.js";
import { sendBackupProgress } from "../../infrastructure/backup.js";
import { backupUseCases } from "../../application/index.js";
import { handleTyped } from "./handleTyped.js";

export function registerBackupIpc() {
  // 扫描孤儿文件
  handleTyped("scanOrphanFiles", async () => {
    try {
      return await backupUseCases.scanOrphanFiles();
    } catch (error) {
      logError("Main", "Scan orphan files error:", error);
      throw error;
    }
  });

  // 导出并删除孤儿文件：原图像导出后删除，缩略图直接删除
  handleTyped("exportOrphanFiles", async (event, exportDir) => {
    try {
      return await backupUseCases.exportOrphanFiles.execute(exportDir);
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

      return await backupUseCases.exportFullBackup.execute(filePaths[0]);
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

      return await backupUseCases.importFullBackup.execute(filePaths[0]);
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

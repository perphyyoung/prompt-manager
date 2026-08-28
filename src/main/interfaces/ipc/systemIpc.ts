/**
 * 系统域 IPC 路由
 * 应用版本/重启、数据目录、全屏、统计、数据库维护、字体、渲染进程日志。
 * 从 main/index.ts 原样迁出，逻辑未改动。
 */

import path from "path";
import { promises as fs } from "fs";
import { ipcMain, app, dialog, shell, clipboard } from "electron";
import * as db from "../../database.js";
import { logInfo, logError, logWarn, logDebug } from "../../mainLogger.js";
import { getCurrentDataDir, getDataDir, getMainWindow } from "../../runtime.js";
import { relaunchApp } from "../../bootstrap.js";

export function registerSystemIpc() {
  // 重启应用
  ipcMain.handle("relaunch-app", async (event, oldDataDir) => {
    await relaunchApp(oldDataDir);
  });

  // 复制到剪贴板
  ipcMain.handle("copy-to-clipboard", async (event, text) => {
    clipboard.writeText(text);
    return true;
  });

  // 设置全屏模式
  ipcMain.handle("set-fullscreen", async (event, flag) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.setFullScreen(flag);
      // 全屏时隐藏菜单栏，退出全屏时恢复
      if (flag) {
        mainWindow.setMenuBarVisibility(false);
      } else {
        mainWindow.setMenuBarVisibility(true);
      }
      return true;
    }
    return false;
  });

  // 获取数据目录路径
  ipcMain.handle("get-data-path", async () => {
    return getDataDir();
  });

  // 打开数据目录
  ipcMain.handle("open-data-directory", async () => {
    await shell.openPath(getCurrentDataDir());
  });

  // 选择目录（通用）
  ipcMain.handle("select-directory", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择导出目录",
      properties: ["openDirectory"],
      defaultPath: getCurrentDataDir(),
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }

    return null;
  });

  // 清空所有数据
  ipcMain.handle("clear-all-data", async () => {
    try {
      return await db.clearAllData(getCurrentDataDir());
    } catch (error) {
      logError("Main", "Clear all data error:", error);
      throw error;
    }
  });

  // 获取统计数据（SQL 聚合）
  ipcMain.handle("get-statistics", async (event, isSafeOnly: boolean) => {
    try {
      return await db.getStatistics(isSafeOnly);
    } catch (error) {
      logError("Main", "Get statistics error:", error);
      throw error;
    }
  });

  // 优化数据库
  ipcMain.handle("optimize-database", async () => {
    try {
      return await db.optimizeDatabase();
    } catch (error) {
      logError("Main", "Optimize database error:", error);
      throw error;
    }
  });

  // 获取应用版本号
  ipcMain.handle("get-app-version", async () => {
    return app.getVersion();
  });

  // 渲染进程日志（通过 IPC 写入 debug.log）
  ipcMain.handle("renderer-log", async (event, level, component, message, data) => {
    const logFn =
      level === "error"
        ? logError
        : level === "warn"
          ? logWarn
          : level === "debug"
            ? logDebug
            : logInfo;
    logFn(component, message, data);
    return true;
  });

  // 选择并安装自定义字体文件
  ipcMain.handle("select-and-install-font", async () => {
    try {
      // 打开字体文件选择对话框
      const result = await dialog.showOpenDialog({
        title: "选择字体文件",
        properties: ["openFile"],
        filters: [
          { name: "字体文件", extensions: ["ttf", "otf", "ttc", "woff", "woff2"] },
          { name: "所有文件", extensions: ["*"] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      const sourcePath = result.filePaths[0];
      const fileName = path.basename(sourcePath);
      const fontName = fileName.replace(/\.(ttf|otf|ttc|woff|woff2)$/i, "");

      // 创建应用字体目录
      const fontsDir = path.join(getCurrentDataDir(), "fonts");
      await fs.mkdir(fontsDir, { recursive: true });

      // 复制字体文件到应用目录
      const targetPath = path.join(fontsDir, fileName);
      await fs.copyFile(sourcePath, targetPath);

      return {
        fontName,
        fileName,
        filePath: targetPath,
      };
    } catch (error) {
      logError("Main", "Failed to select and install font:", error);
      throw error;
    }
  });

  // 获取已安装的自定义字体列表
  ipcMain.handle("get-installed-fonts", async () => {
    try {
      const fontsDir = path.join(getCurrentDataDir(), "fonts");

      try {
        await fs.access(fontsDir);
      } catch {
        return [];
      }

      const files = await fs.readdir(fontsDir);
      const fonts = files
        .filter((file) => /\.(ttf|otf|ttc|woff|woff2)$/i.test(file))
        .map((file) => ({
          fontName: file.replace(/\.(ttf|otf|ttc|woff|woff2)$/i, ""),
          fileName: file,
          filePath: path.join(fontsDir, file),
        }));

      return fonts;
    } catch (error) {
      logError("Main", "Failed to get installed fonts:", error);
      return [];
    }
  });
}

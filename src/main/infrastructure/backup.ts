/**
 * 备份与维护基础设施
 * ZIP 压缩/解压、目录遍历与删除、孤儿文件扫描、备份统计、备份进度推送。
 * 从 main/index.ts 原样迁出，逻辑未改动。
 */

import path from "path";
import os from "os";
import { promises as fs } from "fs";
import * as db from "../database.js";
import { localTime } from "../../utils/index.js";
import { logError } from "../mainLogger.js";
import { getCurrentDataDir, getMainWindow } from "../runtime.js";
import { getImagesDir, getThumbnailsDir } from "./imageFiles.js";

/**
 * 递归删除目录
 * @param {string} dir - 要删除的目录
 */
export async function removeDirectory(dir: string) {
  try {
    await fs.access(dir);
  } catch {
    return; // 目录不存在
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await removeDirectory(fullPath);
    } else {
      await fs.unlink(fullPath);
    }
  }

  await fs.rmdir(dir);
}

/**
 * 创建 ZIP 压缩包
 * @param {string} sourceDir - 源目录
 * @param {string} zipPath - ZIP 文件路径
 */
export async function createZipArchive(sourceDir: string, zipPath: string) {
  const { exec } = require("child_process");
  const { promisify } = require("util");
  const execAsync = promisify(exec);

  // 使用系统命令创建 ZIP（Windows 使用 PowerShell，其他使用 zip 命令）
  const isWindows = process.platform === "win32";

  if (isWindows) {
    // Windows: 使用 PowerShell Compress-Archive
    await execAsync(
      `powershell -command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${zipPath}' -Force"`,
    );
  } else {
    // Linux/Mac: 使用 zip 命令
    const parentDir = path.dirname(sourceDir);
    const dirName = path.basename(sourceDir);
    await execAsync(`cd "${parentDir}" && zip -r "${zipPath}" "${dirName}"`);
  }
}

/**
 * 解压 ZIP 压缩包
 * @param {string} zipPath - ZIP 文件路径
 * @param {string} targetDir - 目标目录
 */
export async function extractZipArchive(zipPath: string, targetDir: string) {
  const { exec } = require("child_process");
  const { promisify } = require("util");
  const execAsync = promisify(exec);

  const isWindows = process.platform === "win32";

  if (isWindows) {
    // Windows: 使用 PowerShell Expand-Archive
    await execAsync(
      `powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${targetDir}' -Force"`,
    );
  } else {
    // Linux/Mac: 使用 unzip 命令
    await execAsync(`unzip -o "${zipPath}" -d "${targetDir}"`);
  }
}

/**
 * 递归获取目录下所有文件
 * @param {string} dir - 目录路径
 * @param {string} baseDir - 基础目录（用于计算相对路径）
 * @returns {Array} 文件列表（包含相对路径和绝对路径）
 */
export async function getAllFiles(
  dir: string,
  baseDir: string,
): Promise<Array<{ relativePath: string; fullPath: string; size: number }>> {
  const files: Array<{ relativePath: string; fullPath: string; size: number }> = [];
  const items = await fs.readdir(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (item.isDirectory()) {
      const subFiles = await getAllFiles(fullPath, baseDir);
      files.push(...subFiles);
    } else {
      const stats = await fs.stat(fullPath);
      files.push({
        relativePath: relativePath.replace(/\\/g, "/"),
        fullPath,
        size: stats.size,
      });
    }
  }

  return files;
}

/**
 * 扫描孤儿文件（内部函数）
 * @returns {Promise<Object>} 扫描结果
 */
export async function scanOrphanFilesInternal() {
  const imagesDir = getImagesDir();
  const thumbnailsDir = getThumbnailsDir();
  const dataDir = getCurrentDataDir();

  // 获取数据库中所有图像的路径
  const allImages = await db.getAllImages({ forCleanup: true });
  const dbImagePaths = new Set(allImages.map((img) => img.relative_path).filter(Boolean));
  const dbThumbnailPaths = new Set(allImages.map((img) => img.thumbnail_path).filter(Boolean));

  // 扫描实际文件
  let actualImageFiles: Array<{ relativePath: string; fullPath: string; size: number }> = [];
  let actualThumbnailFiles: Array<{ relativePath: string; fullPath: string; size: number }> = [];

  try {
    actualImageFiles = await getAllFiles(imagesDir, dataDir);
  } catch (err) {
    logError("Main", "Failed to get image files:", err);
    // 目录可能不存在
  }

  try {
    actualThumbnailFiles = await getAllFiles(thumbnailsDir, dataDir);
  } catch (err) {
    logError("Main", "Failed to get image thumb files:", err);
    // 目录可能不存在
  }

  // 找出孤儿文件
  const orphanImages = actualImageFiles.filter((file) => !dbImagePaths.has(file.relativePath));
  const orphanThumbnails = actualThumbnailFiles.filter(
    (file) => !dbThumbnailPaths.has(file.relativePath),
  );

  // 计算总大小
  const orphanImageSize = orphanImages.reduce((sum, f) => sum + f.size, 0);
  const orphanThumbnailSize = orphanThumbnails.reduce((sum, f) => sum + f.size, 0);

  return {
    orphanImages,
    orphanThumbnails,
    orphanImageCount: orphanImages.length,
    orphanThumbnailCount: orphanThumbnails.length,
    orphanImageSize: (orphanImageSize / 1024 / 1024).toFixed(2),
    orphanThumbnailSize: (orphanThumbnailSize / 1024 / 1024).toFixed(2),
    totalCount: orphanImages.length + orphanThumbnails.length,
    totalSize: ((orphanImageSize + orphanThumbnailSize) / 1024 / 1024).toFixed(2),
  };
}

/**
 * 获取备份统计信息
 * @returns {Promise<Object>} 统计信息
 */
export async function getBackupStats() {
  const stats = {
    database: true,
    prompts: { count: 0 },
    images: { count: 0, size: 0 },
  };

  // 统计提示词
  try {
    const prompts = await db.getPrompts();
    stats.prompts.count = prompts.length;
  } catch {
    // 数据库可能为空
  }

  // 统计图像
  try {
    const imagesDir = getImagesDir();
    const imageFiles = await getAllFiles(imagesDir, getCurrentDataDir());
    stats.images.count = imageFiles.length;
    stats.images.size = imageFiles.reduce((sum, f) => sum + f.size, 0);
  } catch {
    // 目录可能不存在
  }

  return stats;
}

/**
 * 生成备份 manifest（导出与导入共用）
 */
export function buildBackupManifest(stats: Awaited<ReturnType<typeof getBackupStats>>) {
  return {
    version: "1.0.0",
    appName: "prompt-manager",
    exportedAt: localTime(),
    dataVersion: 1,
    contents: stats,
  };
}

/**
 * 发送备份进度到渲染进程
 */
export function sendBackupProgress(progress: {
  stage: string;
  percent: number;
  status: string;
  detail?: string;
}) {
  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("backup-progress", progress);
  }
}

/**
 * 创建临时目录（导出/导入备份共用）
 */
export async function createTempDir(prefix: string): Promise<string> {
  const tempDir = path.join(os.tmpdir(), `${prefix}-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

/**
 * 文件工具模块
 * 提供统一的文件/目录复制功能
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * 复制文件
 * @param source - 源文件路径
 * @param target - 目标文件路径
 */
export async function copyFile(source: string, target: string): Promise<void> {
  await fs.copyFile(source, target);
}

/**
 * 复制目录（基础版）
 * @param source - 源目录路径
 * @param target - 目标目录路径
 */
export async function copyDirectory(source: string, target: string): Promise<void> {
  try {
    await fs.access(source);
  } catch {
    throw new Error(`Source directory does not exist: ${source}`);
  }

  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

/**
 * 复制目录选项
 */
interface CopyDirectoryWithProgressOptions {
  /** 进度回调 */
  onProgress?: (progress: number, fileName: string) => void;
  /** 总大小（用于计算进度） */
  totalSize?: number;
  /** 基础进度值 */
  baseProgress?: number;
  /** 进度权重 */
  progressWeight?: number;
}

/**
 * 复制结果
 */
interface CopyResult {
  /** 复制的文件数 */
  copiedCount: number;
  /** 复制的字节数 */
  copiedSize: number;
}

/**
 * 复制目录（带进度回调）
 * @param source - 源目录路径
 * @param target - 目标目录路径
 * @param options - 选项
 */
export async function copyDirectoryWithProgress(
  source: string,
  target: string,
  options: CopyDirectoryWithProgressOptions = {}
): Promise<CopyResult> {
  const { onProgress, totalSize = 0, baseProgress = 0, progressWeight = 1 } = options;

  try {
    await fs.access(source);
  } catch {
    return { copiedCount: 0, copiedSize: 0 };
  }

  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  let copiedCount = 0;
  let copiedSize = 0;

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      const result = await copyDirectoryWithProgress(sourcePath, targetPath, options);
      copiedCount += result.copiedCount;
      copiedSize += result.copiedSize;
    } else {
      const stats = await fs.stat(sourcePath);
      await fs.copyFile(sourcePath, targetPath);
      copiedCount++;
      copiedSize += stats.size;

      if (onProgress && totalSize > 0) {
        const fileProgress = (copiedSize / totalSize) * progressWeight;
        onProgress(baseProgress + fileProgress, entry.name);
      }
    }
  }

  return { copiedCount, copiedSize };
}

/**
 * 计算目录总大小
 * @param dir - 目录路径
 * @returns 总字节数
 */
export async function calculateDirectorySize(dir: string): Promise<number> {
  try {
    await fs.access(dir);
  } catch {
    return 0;
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  let totalSize = 0;

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      totalSize += await calculateDirectorySize(fullPath);
    } else {
      const stats = await fs.stat(fullPath);
      totalSize += stats.size;
    }
  }

  return totalSize;
}

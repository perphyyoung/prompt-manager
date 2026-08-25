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
  /** 进度回调：每复制完一个文件触发，报告已复制数量与总数 */
  onProgress?: (copiedCount: number, totalCount: number, fileName: string) => void;
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
  const { onProgress } = options;

  try {
    await fs.access(source);
  } catch {
    return { copiedCount: 0, copiedSize: 0 };
  }

  const totalCount = await countFiles(source);

  let copiedCount = 0;
  let copiedSize = 0;

  async function walk(src: string, dst: string): Promise<void> {
    await fs.mkdir(dst, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(src, entry.name);
      const targetPath = path.join(dst, entry.name);

      if (entry.isDirectory()) {
        await walk(sourcePath, targetPath);
      } else {
        const stats = await fs.stat(sourcePath);
        await fs.copyFile(sourcePath, targetPath);
        copiedCount++;
        copiedSize += stats.size;

        if (onProgress && totalCount > 0) {
          onProgress(copiedCount, totalCount, entry.name);
        }
      }
    }
  }

  await walk(source, target);

  return { copiedCount, copiedSize };
}

/**
 * 递归统计目录下文件总数
 * @param dir - 目录路径
 * @returns 文件总数
 */
async function countFiles(dir: string): Promise<number> {
  let count = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += await countFiles(path.join(dir, entry.name));
    } else {
      count++;
    }
  }

  return count;
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
